/**
 * Private I’m Snappy harness route.
 * It is intentionally a thin execution boundary: it never exposes an E2B sandbox ID,
 * provider key, or raw upstream error to browser-facing callers.
 */
import { randomUUID, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { Router } from "express";
import { Sandbox } from "e2b";
import { z } from "zod";
import type { RunEventType, RunRequest, StreamEvent } from "@imsnappy/contracts";
import type { HarnessConfig } from "../config.js";

const runRequestSchema = z.object({
  runId: z.string().min(1),
  userId: z.string().min(1),
  conversationId: z.string().min(1),
  messageId: z.string().min(1),
  prompt: z.string().min(1).max(100_000),
  model: z.object({ provider: z.literal("opencode"), modelId: z.string().min(1).max(200) }),
  toolPolicy: z.object({
    allowSandbox: z.boolean(),
    requireApprovalForCommands: z.boolean(),
    allowedCommands: z.array(z.string().min(1).max(80)).max(64),
  }),
  idempotencyKey: z.string().min(1).max(200),
}).strict();

type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface ToolCallFragment {
  index: number;
  id?: string;
  type?: "function";
  function?: { name?: string; arguments?: string };
}

interface ModelTurn {
  text: string;
  toolCalls: ToolCall[];
}

const blockedShellSyntax = /[\n\r;&|><`$()]/;

function serviceTokenMatches(received: string | undefined, expected: string): boolean {
  if (!received) return false;
  const provided = Buffer.from(received);
  const target = Buffer.from(expected);
  return provided.length === target.length && timingSafeEqual(provided, target);
}

function assertInternalAccess(request: Request, config: HarnessConfig): boolean {
  const token = request.header("x-imsnappy-service-token") ?? undefined;
  return serviceTokenMatches(token, config.internalServiceToken) && Boolean(request.header("x-request-id"));
}

function createEventEmitter(response: Response, runId: string) {
  return (type: RunEventType, payload: Record<string, unknown>) => {
    const event: StreamEvent = {
      id: randomUUID(),
      runId,
      type,
      occurredAt: new Date().toISOString(),
      payload,
    };
    response.write(`id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  };
}

function normalizeCommand(command: string, allowedCommands: readonly string[]): { command: string; program: string } | null {
  const trimmed = command.trim();
  if (!trimmed || trimmed.length > 4_000 || blockedShellSyntax.test(trimmed)) return null;
  const program = trimmed.split(/\s+/, 1)[0] ?? "";
  return allowedCommands.includes(program) ? { command: trimmed, program } : null;
}

function makeSystemPrompt(request: RunRequest): string {
  const sandboxInstruction = request.toolPolicy.allowSandbox
    ? "You may call run_sandbox_command only when isolated computation or file inspection is genuinely needed. Prefer a direct, useful answer when no tool is necessary."
    : "Sandbox tools are disabled for this run. Do not claim that you executed commands.";
  return [
    "You are I’m Snappy, a goal-oriented cloud agent.",
    "Complete the user’s request with clear, concise, accurate reasoning and communicate results directly.",
    "Never expose provider credentials, internal service configuration, or sandbox identifiers.",
    sandboxInstruction,
  ].join(" ");
}

function e2bResultText(result: unknown): string {
  if (!result || typeof result !== "object") return "Command completed with no textual result.";
  const candidate = result as { stdout?: unknown; stderr?: unknown; exitCode?: unknown };
  const stdout = typeof candidate.stdout === "string" ? candidate.stdout.trim() : "";
  const stderr = typeof candidate.stderr === "string" ? candidate.stderr.trim() : "";
  const status = typeof candidate.exitCode === "number" ? `Exit code: ${candidate.exitCode}.` : "Command completed.";
  return [status, stdout && `Output:\n${stdout}`, stderr && `Diagnostics:\n${stderr}`].filter(Boolean).join("\n\n").slice(0, 20_000);
}

async function runSandboxCommand(
  config: HarnessConfig,
  normalized: { command: string; program: string },
  requestedTimeoutMs: unknown,
): Promise<string> {
  if (!config.e2bApiKey) throw new Error("Sandbox execution is not configured for this runtime.");
  const timeoutMs = typeof requestedTimeoutMs === "number" && Number.isFinite(requestedTimeoutMs)
    ? Math.min(Math.max(1_000, requestedTimeoutMs), config.maxCommandTimeoutMs)
    : config.maxCommandTimeoutMs;
  let sandbox: Sandbox | undefined;
  try {
    sandbox = await Sandbox.create({ apiKey: config.e2bApiKey, template: config.e2bTemplate });
    const result = await sandbox.commands.run(normalized.command, { timeoutMs });
    return e2bResultText(result);
  } finally {
    if (sandbox) await sandbox.kill().catch(() => undefined);
  }
}

async function streamModelTurn(
  config: HarnessConfig,
  request: RunRequest,
  messages: AgentMessage[],
  emit: (type: RunEventType, payload: Record<string, unknown>) => void,
  signal: AbortSignal,
): Promise<ModelTurn> {
  const tools = request.toolPolicy.allowSandbox ? [{
    type: "function",
    function: {
      name: "run_sandbox_command",
      description: "Run one allowlisted command in an isolated, short-lived E2B sandbox. Use only for computation, structured inspection, or task work that cannot be completed reliably without execution.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          command: { type: "string", description: "A single command without shell chaining, redirection, or substitution." },
          timeoutMs: { type: "number", description: "Optional execution limit in milliseconds, capped by policy." },
        },
        required: ["command"],
      },
    },
  }] : undefined;
  const response = await fetch(`${config.openCodeBaseUrl}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${config.openCodeApiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: request.model.modelId, messages, stream: true, ...(tools ? { tools, tool_choice: "auto" } : {}) }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`OpenCode response unavailable (${response.status}).`);
  }

  let pending = "";
  let text = "";
  const toolCalls = new Map<number, ToolCall>();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    pending += decoder.decode(chunk.value, { stream: true });
    const records = pending.split("\n\n");
    pending = records.pop() ?? "";
    for (const record of records) {
      const raw = record.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
      if (!raw || raw === "[DONE]") continue;
      let parsed: { choices?: Array<{ delta?: { content?: unknown; tool_calls?: ToolCallFragment[] } }> };
      try { parsed = JSON.parse(raw) as typeof parsed; } catch { continue; }
      const delta = parsed.choices?.[0]?.delta;
      if (typeof delta?.content === "string" && delta.content) {
        text += delta.content;
        emit("run.delta", { text: delta.content });
      }
      for (const fragment of delta?.tool_calls ?? []) {
        const prior = toolCalls.get(fragment.index) ?? { id: fragment.id ?? randomUUID(), type: "function" as const, function: { name: "", arguments: "" } };
        if (fragment.id) prior.id = fragment.id;
        if (fragment.function?.name) prior.function.name += fragment.function.name;
        if (fragment.function?.arguments) prior.function.arguments += fragment.function.arguments;
        toolCalls.set(fragment.index, prior);
      }
    }
  }
  return { text, toolCalls: [...toolCalls.values()] };
}

export function createRunsRouter(config: HarnessConfig): Router {
  const router = Router();

  router.post("/runs", async (request, response) => {
    if (!assertInternalAccess(request, config)) {
      response.status(401).json({ error: "unauthorized_internal_request" });
      return;
    }
    const parsed = runRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: "invalid_run_request", details: parsed.error.flatten() });
      return;
    }

    const run = parsed.data;
    response.status(200).set({
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    });
    response.flushHeaders();
    const emit = createEventEmitter(response, run.runId);
    const controller = new AbortController();
    const heartbeat = setInterval(() => response.write(": heartbeat\n\n"), 15_000);
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    request.on("close", () => controller.abort());

    try {
      emit("run.trace", { phase: "planning", label: "Task received", detail: "Preparing an execution plan." });
      const messages: AgentMessage[] = [
        { role: "system", content: makeSystemPrompt(run) },
        { role: "user", content: run.prompt },
      ];
      let finalText = "";
      for (let round = 0; round <= config.maxToolRounds; round += 1) {
        emit("run.trace", { phase: "model", label: round === 0 ? "Consulting model" : "Synthesizing tool results" });
        const turn = await streamModelTurn(config, run, messages, emit, controller.signal);
        finalText += turn.text;
        if (turn.toolCalls.length === 0) {
          emit("run.completed", { text: finalText.trim() || "The agent completed the run without a text response." });
          return;
        }
        if (round === config.maxToolRounds) throw new Error("Tool execution limit reached before the task could be completed.");
        messages.push({ role: "assistant", content: turn.text || null, tool_calls: turn.toolCalls });
        for (const call of turn.toolCalls) {
          if (call.function.name !== "run_sandbox_command") {
            messages.push({ role: "tool", tool_call_id: call.id, content: "This tool is not available." });
            continue;
          }
          let argumentsValue: { command?: unknown; timeoutMs?: unknown };
          try { argumentsValue = JSON.parse(call.function.arguments) as { command?: unknown; timeoutMs?: unknown }; } catch { argumentsValue = {}; }
          const normalized = typeof argumentsValue.command === "string"
            ? normalizeCommand(argumentsValue.command, run.toolPolicy.allowedCommands)
            : null;
          if (!normalized) {
            const detail = "The requested command was rejected by the sandbox allowlist policy.";
            emit("run.tool_result", { tool: "run_sandbox_command", ok: false, summary: detail });
            messages.push({ role: "tool", tool_call_id: call.id, content: detail });
            continue;
          }
          emit("run.tool_request", { tool: "run_sandbox_command", command: normalized.program, requiresApproval: run.toolPolicy.requireApprovalForCommands });
          if (run.toolPolicy.requireApprovalForCommands) {
            emit("run.awaiting_approval", { tool: "run_sandbox_command", command: normalized.command, message: "A user approval is required before this sandbox command can run." });
            return;
          }
          try {
            emit("run.trace", { phase: "tool", label: `Running ${normalized.program} in an isolated sandbox` });
            const result = await runSandboxCommand(config, normalized, argumentsValue.timeoutMs);
            emit("run.tool_result", { tool: "run_sandbox_command", ok: true, summary: result.slice(0, 2_000) });
            messages.push({ role: "tool", tool_call_id: call.id, content: result });
          } catch (error) {
            const detail = error instanceof Error ? error.message : "Sandbox command failed.";
            emit("run.tool_result", { tool: "run_sandbox_command", ok: false, summary: detail });
            messages.push({ role: "tool", tool_call_id: call.id, content: `Sandbox command failed: ${detail}` });
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "The agent run exceeded its execution time limit."
        : "The agent runtime could not complete this request.";
      console.error("Harness run failed", { runId: run.runId, error });
      emit("run.failed", { code: "agent_runtime_failed", message });
    } finally {
      clearInterval(heartbeat);
      clearTimeout(timeout);
      response.end();
    }
  });

  return router;
}
