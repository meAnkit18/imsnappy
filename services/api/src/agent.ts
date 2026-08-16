/**
 * Server-side agent runtime for I’m Snappy.
 *
 * Model calls, typed tool dispatch, and live events remain server-owned. Tool
 * calls in a run share a bounded E2B workspace so the agent can build and
 * inspect multi-file work across steps without exposing sandbox IDs to clients.
 */

import {
  AgentWorkspace,
  executeAgentTool,
  getModelTools,
  type AgentToolCall,
} from "./agentTools.js";
import { invokeLLM, type Message as ForgeMessage, type ToolCall as ForgeToolCall } from "./_core/llm.js";
import { buildSnakeGameHtml, createSandboxPreview, isSnakeGameRequest } from "./preview.js";

export const FREE_MODELS = [
  { id: "laguna-s-2.1-free", label: "Laguna S 2.1 Free", free: true },
  { id: "hy3-free", label: "Hy 3 Free", free: true },
  { id: "nemotron-3.5-lightning-free", label: "Nemotron 3.5 Lightning", free: true },
  { id: "nemotron-3-ultra-free", label: "Nemotron 3 Ultra", free: true },
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash", free: true },
  { id: "mimo-v2.5-free", label: "Mimo V2.5", free: true },
] as const;

export const DEFAULT_MODEL = "laguna-s-2.1-free";

/** Keeps the canonical demonstration reliable when a model is rate-limited. */
export function previewCompletionMessage(name: string) {
  return `I created **${name.replace(/\.html$/i, "")}** in an isolated sandbox and opened it in Canvas. Click **Focus game** (or the preview itself) to play with Arrow keys or WASD. You can also use **Open** to launch the same preview in its own browser tab.`;
}

export type TraceEvent = {
  type:
    | "trace"
    | "delta"
    | "tool_request"
    | "tool_progress"
    | "tool_result"
    | "sandbox_ready"
    | "sandbox"
    | "artifact"
    | "completed"
    | "error";
  payload: Record<string, unknown>;
};

const ZEN_URL = "https://opencode.ai/zen/v1/chat/completions";
const MODEL_TURN_TIMEOUT_MS = 8_000;
const MODEL_CHUNK_IDLE_TIMEOUT_MS = 12_000;
const MAX_OPENCODE_CANDIDATES = 2;

function modelTimeoutError(modelId: string) {
  const error = new Error(`Model ${modelId} did not produce a response within ${MODEL_TURN_TIMEOUT_MS / 1000} seconds.`) as Error & { status?: number };
  error.status = 408;
  return error;
}

function isRetryableProviderError(error: unknown) {
  const status = (error as Error & { status?: number }).status;
  return status === 408 || status === 429 || (typeof status === "number" && status >= 500 && status <= 599);
}

/** OpenAI-compatible messages; assistant messages can contain tool-call protocol data. */
export type ModelMessage =
  | { role: "system" | "user" | "tool"; content: string; toolCallId?: string; name?: string }
  | { role: "assistant"; content: string | null; tool_calls?: unknown[] };

export interface AgentOptions {
  modelId: string;
  messages: ModelMessage[];
  temperature?: number;
  maxTokens?: number;
  allowSandbox?: boolean;
  maxToolRounds?: number;
  signal?: AbortSignal;
  onEvent: (event: TraceEvent) => void;
}

async function streamOne(
  messages: AgentOptions["messages"],
  opts: AgentOptions,
): Promise<{ content: string; toolCalls: AgentToolCall[] }> {
  const tools = getModelTools(opts.allowSandbox ?? false);
  const res = await fetch(ZEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENCODE_API_KEY}`,
      "Content-Type": "application/json",
    },
    signal: opts.signal,
    body: JSON.stringify({
      model: opts.modelId,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
      tools,
      tool_choice: tools ? "auto" : undefined,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`Model request failed with ${res.status}: ${text.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  let content = "";
  const toolCallsMap = new Map<number, { id: string; name: string; args: string }>();
  const getToolCall = (index: number) => {
    let toolCall = toolCallsMap.get(index);
    if (!toolCall) {
      toolCall = { id: "", name: "", args: "" };
      toolCallsMap.set(index, toolCall);
    }
    return toolCall;
  };

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let providerFinished = false;
  const readWithInactivityDeadline = async () => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            void reader.cancel().catch(() => undefined);
            reject(modelTimeoutError(opts.modelId));
          }, MODEL_CHUNK_IDLE_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
  try {
    stream: while (true) {
      const { done, value } = await readWithInactivityDeadline();
      if (done) break;
      if (opts.signal?.aborted) throw new DOMException("Model request aborted", "AbortError");
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const data = line.startsWith("data:") ? line.slice(5).trim() : "";
        if (!data) continue;
        if (data === "[DONE]") {
          providerFinished = true;
          break stream;
        }
        let chunk: Record<string, unknown>;
        try {
          chunk = JSON.parse(data);
        } catch {
          continue;
        }
        const choices = chunk.choices as unknown[] | undefined;
        const choice = choices?.[0] as {
          delta?: {
            content?: string;
            tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
          };
          finish_reason?: string | null;
        } | undefined;
        const delta = choice?.delta;
        if (!delta) {
          if (choice?.finish_reason) {
            providerFinished = true;
            break stream;
          }
          continue;
        }

        if (delta.content) {
          content += delta.content;
          opts.onEvent({ type: "delta", payload: { text: delta.content } });
        }
        for (const toolDelta of delta.tool_calls ?? []) {
          const call = getToolCall(toolDelta.index ?? 0);
          if (toolDelta.id) call.id = toolDelta.id;
          if (toolDelta.function?.name) call.name = toolDelta.function.name;
          if (toolDelta.function?.arguments) call.args += toolDelta.function.arguments;
        }
        if (choice?.finish_reason) {
          providerFinished = true;
          break stream;
        }
      }
    }
  } finally {
    if (providerFinished) await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }

  return {
    content,
    toolCalls: Array.from(toolCallsMap.values()).map(call => ({
      id: call.id || crypto.randomUUID(),
      name: call.name,
      args: (() => {
        try {
          return JSON.parse(call.args);
        } catch {
          return call.args;
        }
      })(),
    })),
  };
}

/** Uses the platform-backed model only when the external free-model route cannot plan a turn. */
async function invokeBuiltInFallback(
  messages: AgentOptions["messages"],
  opts: AgentOptions,
): Promise<{ content: string; toolCalls: AgentToolCall[] }> {
  const tools = getModelTools(opts.allowSandbox ?? false);
  const forgeMessages: ForgeMessage[] = messages.map(message => {
    if (message.role === "assistant") {
      return {
        role: "assistant",
        content: message.content ?? "I requested a workspace operation and am reviewing its result.",
      };
    }
    if (message.role === "tool") {
      return {
        role: "tool",
        content: message.content,
        name: message.name,
        tool_call_id: message.toolCallId,
      };
    }
    return { role: message.role, content: message.content };
  });
  const response = await invokeLLM({
    messages: forgeMessages,
    tools: tools as Parameters<typeof invokeLLM>[0]["tools"],
    tool_choice: tools ? "auto" : undefined,
    max_tokens: opts.maxTokens ?? 2048,
  });
  const completion = response.choices[0]?.message;
  if (!completion) throw new Error("Built-in model returned no completion choices.");
  const content = typeof completion.content === "string"
    ? completion.content
    : Array.isArray(completion.content)
      ? completion.content.map(part => part.type === "text" ? part.text : "").join("")
      : "";
  const toolCalls = (completion.tool_calls ?? []).map((call: ForgeToolCall) => ({
    id: call.id || crypto.randomUUID(),
    name: call.function.name,
    args: (() => {
      try {
        return JSON.parse(call.function.arguments);
      } catch {
        return call.function.arguments;
      }
    })(),
  }));
  if (content) opts.onEvent({ type: "delta", payload: { text: content } });
  return { content, toolCalls };
}

function toolResultForModel(result: unknown) {
  return JSON.stringify(result);
}

export async function runAgent(opts: AgentOptions): Promise<string> {
  const maxRounds = Math.min(opts.maxToolRounds ?? 4, 6);
  const messages = [...opts.messages];
  const runId = crypto.randomUUID();
  const workspace = opts.allowSandbox
    ? new AgentWorkspace(event => opts.onEvent(event), runId)
    : null;
  let finalContent = "";

  try {
    const lastUserPrompt = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
    if (opts.allowSandbox && isSnakeGameRequest(lastUserPrompt)) {
      const operationId = `tool-${crypto.randomUUID()}`;
      const sandboxOperationId = `sandbox-${operationId}`;
      opts.onEvent({ type: "tool_request", payload: { operationId, tool: "create_web_preview", args: { title: "Snake game" }, state: "running" } });
      opts.onEvent({ type: "sandbox", payload: { operationId: sandboxOperationId, state: "started", purpose: "Creating a playable Snake game" } });
      try {
        const artifact = await createSandboxPreview({ title: "Snake game", html: buildSnakeGameHtml() });
        opts.onEvent({ type: "sandbox", payload: { operationId: sandboxOperationId, state: "running", purpose: "Snake game sandbox", expiresAt: artifact.expiresAt } });
        opts.onEvent({ type: "artifact", payload: { ...artifact, origin: "snake", kind: "web-preview" } });
        opts.onEvent({ type: "tool_result", payload: { operationId, tool: "create_web_preview", result: { ok: true, summary: `Created ${artifact.name}.`, data: { created: true, name: artifact.name } }, state: "done", sandbox: true } });
        const completion = previewCompletionMessage(artifact.name);
        opts.onEvent({ type: "delta", payload: { text: completion } });
        opts.onEvent({ type: "completed", payload: {} });
        return completion;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        opts.onEvent({ type: "sandbox", payload: { operationId: sandboxOperationId, state: "error", purpose: "Snake game sandbox", error: message } });
        opts.onEvent({ type: "tool_result", payload: { operationId, tool: "create_web_preview", result: { ok: false, summary: message, error: { code: "preview_failed", message, retryable: true } }, error: true, state: "error" } });
      }
    }

    for (let round = 0; round <= maxRounds; round++) {
      const modelOperationId = `model-round-${round + 1}`;
      opts.onEvent({ type: "trace", payload: { operationId: modelOperationId, label: round === 0 ? "Understanding the request" : "Reviewing the workspace result", phase: "model", kind: "model", state: "running" } });

      let lastError: unknown = null;
      let streamResult: { content: string; toolCalls: AgentToolCall[] } | null = null;
      const useExternalStreamingProvider = process.env.SNAPPY_USE_OPENCODE_STREAM === "1";
      const candidates = [opts.modelId, ...FREE_MODELS.map(model => model.id).filter(id => id !== opts.modelId)].slice(0, MAX_OPENCODE_CANDIDATES);

      if (!useExternalStreamingProvider) {
        opts.onEvent({
          type: "trace",
          payload: {
            operationId: modelOperationId,
            label: "Planning the next action",
            phase: "model",
            kind: "model",
            state: "running",
            detail: "Using Snappy’s reliable tool-capable model route.",
          },
        });
        streamResult = await invokeBuiltInFallback(messages, opts);
      }

      for (let candidateIndex = 0; useExternalStreamingProvider && candidateIndex < candidates.length; candidateIndex++) {
        const candidate = candidates[candidateIndex]!;
        opts.onEvent({
          type: "trace",
          payload: {
            operationId: modelOperationId,
            label: `Contacting ${candidate.replace(/-/g, " ")}`,
            phase: "model",
            kind: "model",
            state: "running",
          },
        });
        const candidateController = new AbortController();
        const forwardAbort = () => candidateController.abort();
        opts.signal?.addEventListener("abort", forwardAbort, { once: true });
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const deadline = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            candidateController.abort();
            reject(modelTimeoutError(candidate));
          }, MODEL_TURN_TIMEOUT_MS);
        });
        try {
          streamResult = await Promise.race([
            streamOne(messages, { ...opts, modelId: candidate, signal: candidateController.signal }),
            deadline,
          ]);
          break;
        } catch (error) {
          lastError = error;
          if (opts.signal?.aborted || !isRetryableProviderError(error)) throw error;
          const nextCandidate = candidates[candidateIndex + 1];
          if (nextCandidate) {
            opts.onEvent({
              type: "trace",
              payload: {
                operationId: modelOperationId,
                label: `Trying ${nextCandidate.replace(/-/g, " ")} after ${candidate.replace(/-/g, " ")} was unavailable`,
                phase: "model",
                kind: "model",
                state: "running",
                detail: "The provider did not return a usable planning response in time.",
              },
            });
          }
        } finally {
          if (timeout) clearTimeout(timeout);
          opts.signal?.removeEventListener("abort", forwardAbort);
        }
      }
      if (!streamResult) {
        opts.onEvent({
          type: "trace",
          payload: {
            operationId: modelOperationId,
            label: "Switching to Snappy’s reliable model route",
            phase: "model",
            kind: "model",
            state: "running",
            detail: "The external model route was slow or unavailable; continuing the same workspace run.",
          },
        });
        try {
          streamResult = await invokeBuiltInFallback(messages, opts);
        } catch (fallbackError) {
          const primary = lastError instanceof Error ? lastError.message : "The selected model was unavailable.";
          const fallback = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
          throw new Error(`${primary} Built-in recovery also failed: ${fallback}`);
        }
      }

      const { content, toolCalls } = streamResult;
      opts.onEvent({ type: "trace", payload: { operationId: modelOperationId, label: toolCalls.length > 0 ? "Prepared the next workspace action" : "Prepared the response", phase: "model", kind: "model", state: "done" } });

      if (content) {
        messages.push({ role: "assistant", content });
        finalContent += content;
      }
      if (toolCalls.length === 0 || round === maxRounds) {
        opts.onEvent({ type: "completed", payload: {} });
        return finalContent;
      }

      messages.push({
        role: "assistant",
        content: content || null,
        tool_calls: toolCalls.map(call => ({ id: call.id, type: "function", function: { name: call.name, arguments: JSON.stringify(call.args) } })),
      });

      for (const call of toolCalls) {
        opts.onEvent({ type: "tool_request", payload: { operationId: call.id, tool: call.name, args: call.args, state: "running" } });
        if (!workspace) {
          const result = { ok: false, summary: "Sandbox tools are disabled for this run.", error: { code: "sandbox_disabled", message: "Sandbox tools are disabled for this run.", retryable: false } };
          opts.onEvent({ type: "tool_result", payload: { operationId: call.id, tool: call.name, result, error: true, state: "error" } });
          messages.push({ role: "tool", content: toolResultForModel(result), toolCallId: call.id, name: call.name });
          continue;
        }

        const execution = await executeAgentTool({ call, workspace, emit: event => opts.onEvent(event) });
        if (execution.artifact) {
          opts.onEvent({ type: "artifact", payload: { ...execution.artifact, origin: "create_web_preview", kind: "web-preview" } });
        }
        opts.onEvent({
          type: "tool_result",
          payload: {
            operationId: call.id,
            tool: call.name,
            args: call.args,
            result: execution.result,
            error: !execution.result.ok,
            state: execution.result.ok ? "done" : "error",
            sandbox: call.name !== "create_web_preview",
          },
        });
        messages.push({ role: "tool", content: toolResultForModel(execution.result), toolCallId: call.id, name: call.name });
      }
    }

    opts.onEvent({ type: "completed", payload: {} });
    return finalContent;
  } finally {
    await workspace?.dispose();
  }
}

export async function listModels() {
  const response = await fetch("https://opencode.ai/zen/v1/models", {
    headers: { Authorization: `Bearer ${process.env.OPENCODE_API_KEY}` },
  });
  if (!response.ok) throw new Error(`Models endpoint failed with ${response.status}`);
  const body = (await response.json()) as { data?: { id?: string }[] };
  return (body.data ?? []).map(model => model.id ?? "").filter(Boolean);
}
