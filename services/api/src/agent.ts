/**
 * Server-side agent runtime for the local preview.
 *
 * Streams completions from OpenCode Zen, detects tool calls when the model
 * emits them, executes policy-approved commands in short-lived E2B sandboxes,
 * and continues the conversation with tool results. Sandbox IDs are never
 * exposed to the browser; everything is delivered as typed trace events.
 */

import { Sandbox } from "e2b";
import { buildSnakeGameHtml, createSandboxPreview, isSnakeGameRequest } from "./preview";

export const FREE_MODELS = [
  { id: "hy3-free", label: "Hy 3 Free", free: true },
  { id: "nemotron-3.5-lightning-free", label: "Nemotron 3.5 Lightning", free: true },
  { id: "nemotron-3-ultra-free", label: "Nemotron 3 Ultra", free: true },
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash", free: true },
  { id: "mimo-v2.5-free", label: "Mimo V2.5", free: true },
] as const;

export const DEFAULT_MODEL = "hy3-free";

/**
 * The canonical Snake request is fulfilled before a model needs to narrate the
 * work. Keeping the final copy deterministic prevents a slow or unavailable
 * model from replacing a successful interactive result with generic prose.
 */
export function previewCompletionMessage(name: string) {
  return `I created **${name.replace(/\.html$/i, "")}** in an isolated sandbox and opened it in Canvas. Click **Focus game** (or the preview itself) to play with Arrow keys or WASD. You can also use **Open** to launch the same preview in its own browser tab.`;
}

export type TraceEvent = {
  type:
    | "trace"
    | "delta"
    | "tool_request"
    | "tool_result"
    | "sandbox_ready"
    | "sandbox"
    | "artifact"
    | "completed"
    | "error";
  payload: Record<string, unknown>;
};

const ZEN_URL = "https://opencode.ai/zen/v1/chat/completions";
const E2B_API_URL = "https://api.e2b.dev";

const ALLOWED_COMMANDS = new Set([
  "ls", "pwd", "echo", "cat", "head", "tail", "grep", "wc", "date", "whoami",
  "uname", "hostname", "uptime", "free", "df", "env", "printenv", "which",
  "sort", "uniq", "cut", "tr", "sed", "awk", "find", "mkdir", "touch",
  "cp", "mv", "rm", "du", "diff", "man", "file", "stat", "seq", "factor",
  "bc", "shuf", "comm", "yes", "printf", "tree", "xargs", "tee", "base64",
  "od", "strings", "curl", "wget", "node", "python3", "pip3", "pip", "git",
  "npm", "pnpm", "yarn", "jq", "zip", "unzip", "tar", "gzip", "less", "more",
  "nano", "vim", "code", "clear", "history", "export", "alias", "sleep",
  "test", "true", "false", "timeout", "nproc", "lscpu",
]);

const BANNED_PATTERNS: RegExp[] = [
  /(^|\||&|;|\n)\s*(sudo|rm\s+-rf\s+\/|mkfs|dd\s+of=\/dev|chmod\s+777\s+\/|>)/i,
  /\b(aws|gcloud|kubectl|docker|ssh)\b/,
];

/** OpenAI-compatible message sent to the model, where assistants may carry tool calls. */
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
  onEvent: (event: TraceEvent) => void;
}

function isBanned(command: string): string | null {
  for (const pattern of BANNED_PATTERNS) {
    if (pattern.test(command)) return "Command blocked by policy";
  }
  return null;
}

function splitCommand(command: string): { allowed: boolean; reason?: string; parts: string[] } {
  const clean = command.trim();
  if (!clean) return { allowed: false, reason: "Empty command", parts: [] };
  const banned = isBanned(clean);
  if (banned) return { allowed: false, reason: banned, parts: [] };
  const parts = clean.split(/\s+/);
  const base = parts[0].replace(/^[.\//\\]+/, "");
  if (!ALLOWED_COMMANDS.has(base)) {
    return { allowed: false, reason: `Command "${base}" is not in the allowlist`, parts };
  }
  return { allowed: true, parts };
}

async function runInSandbox(command: string): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const sandbox = await Sandbox.create();
  try {
    const exec = await sandbox.commands.run(command, { timeoutMs: 45_000 });
    return {
      exitCode: exec.exitCode,
      stdout: exec.stdout.slice(0, 8_000),
      stderr: exec.stderr.slice(0, 4_000),
    };
  } finally {
    await sandbox.kill();
  }
}

async function streamOne(
  messages: AgentOptions["messages"],
  opts: AgentOptions,
): Promise<{ content: string; toolCalls: { id: string; name: string; args: unknown }[] }> {
  const res = await fetch(ZEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENCODE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.modelId,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
      tools: opts.allowSandbox
        ? [
            {
              type: "function",
              function: {
                name: "run_command",
                description:
                  "Run a single read-only-friendly shell command in an isolated sandbox. Prefer small commands. Never chain destructive operations.",
                parameters: {
                  type: "object",
                  properties: {
                    command: { type: "string", description: "The shell command to run" },
                  },
                  required: ["command"],
                },
              },
            },
            {
              type: "function",
              function: {
                name: "create_web_preview",
                description:
                  "Create a single-file, interactive browser preview in a persistent sandbox. Use this whenever the user asks to build a small website, UI prototype, game, or browser experience. Supply a self-contained HTML document with inline CSS and JavaScript; do not use external dependencies.",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string", description: "Short title for the artifact" },
                    html: { type: "string", description: "Complete self-contained HTML document" },
                  },
                  required: ["title", "html"],
                },
              },
            },
          ]
        : undefined,
      tool_choice: opts.allowSandbox ? "auto" : undefined,
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
  const getTc = (idx: number) => {
    let tc = toolCallsMap.get(idx);
    if (!tc) {
      tc = { id: "", name: "", args: "" };
      toolCallsMap.set(idx, tc);
    }
    return tc;
  };
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      const data = line.startsWith("data:") ? line.slice(5).trim() : "";
      if (!data || data === "[DONE]") continue;
      let chunk: Record<string, unknown>;
      try {
        chunk = JSON.parse(data);
      } catch {
        continue;
      }
      const choices = chunk.choices as unknown[] | undefined;
      const delta = (choices?.[0] as { delta?: { content?: string; tool_calls?: { index?: number; id?: string; function?: { name?: string; arguments?: string } }[] } } | undefined)?.delta;
      if (!delta) continue;
      if (delta.content) {
        content += delta.content;
        opts.onEvent({ type: "delta", payload: { text: delta.content } });
      }
      if (delta.tool_calls) {
        const deltas = delta.tool_calls as { index?: number; id?: string; function?: { name?: string; arguments?: string } }[];
        for (const tc of deltas) {
          const acc = getTc(tc.index ?? 0);
          if (tc.id) acc.id = tc.id;
          if (tc.function?.name) acc.name = tc.function.name;
          if (tc.function?.arguments) acc.args += tc.function.arguments;
        }
      }
    }
  }
  reader.releaseLock();

  return {
    content,
    toolCalls: Array.from(toolCallsMap.values()).map(tc => ({
      id: tc.id || crypto.randomUUID(),
      name: tc.name,
      args: (() => {
        try {
          return JSON.parse(tc.args);
        } catch {
          return tc.args;
        }
      })(),
    })),
  };
}

export async function runAgent(opts: AgentOptions): Promise<string> {
  const maxRounds = Math.min(opts.maxToolRounds ?? 4, 6);
  const messages = [...opts.messages];
  let finalContent = "";

  const lastUserPrompt = [...messages].reverse().find(message => message.role === "user")?.content ?? "";
  if (opts.allowSandbox && isSnakeGameRequest(lastUserPrompt)) {
    opts.onEvent({ type: "trace", payload: { label: "Creating a playable Snake game in a persistent sandbox", phase: "tool" } });
    try {
      opts.onEvent({ type: "sandbox", payload: { state: "started", purpose: "Creating a playable Snake game" } });
      const artifact = await createSandboxPreview({ title: "Snake game", html: buildSnakeGameHtml() });
      opts.onEvent({ type: "sandbox", payload: { state: "running", purpose: "Snake game sandbox", expiresAt: artifact.expiresAt } });
      opts.onEvent({ type: "artifact", payload: { ...artifact, origin: "snake", kind: "web-preview" } });
      opts.onEvent({ type: "tool_result", payload: { tool: "create_web_preview", result: { created: true, name: artifact.name }, sandbox: true } });
      const completion = previewCompletionMessage(artifact.name);
      opts.onEvent({ type: "delta", payload: { text: completion } });
      opts.onEvent({ type: "completed", payload: {} });
      return completion;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      opts.onEvent({ type: "tool_result", payload: { tool: "create_web_preview", result: { error: message }, error: true } });
    }
  }

  for (let round = 0; round <= maxRounds; round++) {
    opts.onEvent({ type: "trace", payload: { label: `Model call (round ${round + 1})`, phase: "model" } });

    // Try the requested model first, then fall back across the free fleet on 429.
    const candidates = [opts.modelId, ...FREE_MODELS.map(m => m.id).filter(id => id !== opts.modelId)];
    let lastErr: unknown = null;
    let streamResult: { content: string; toolCalls: { id: string; name: string; args: unknown }[] } | null = null;
    for (const candidate of candidates) {
      try {
        streamResult = await streamOne(messages, { ...opts, modelId: candidate });
        break;
      } catch (err) {
        const status = (err as Error & { status?: number }).status;
        lastErr = err;
        if (status !== 429) throw err; // Only retry on rate-limit; surface other errors.
      }
    }
    if (!streamResult) throw lastErr;
    const { content, toolCalls } = streamResult;

    if (content) {
      messages.push({ role: "assistant", content });
      finalContent += content;
    }

    if (toolCalls.length === 0) {
      opts.onEvent({ type: "completed", payload: {} });
      return finalContent;
    }

    if (round === maxRounds) {
      opts.onEvent({ type: "completed", payload: {} });
      return finalContent;
    }

    // Execute tool calls
    const assistantMsg: ModelMessage = {
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.map(tc => ({ id: tc.id, type: "function", function: { name: tc.name, arguments: JSON.stringify(tc.args) } })),
    };
    messages.push(assistantMsg);

    for (const call of toolCalls) {
      opts.onEvent({ type: "tool_request", payload: { tool: call.name, args: call.args, pending: true } });

      if (call.name === "create_web_preview") {
        const args = typeof call.args === "object" && call.args !== null ? call.args as { title?: unknown; html?: unknown } : {};
        const title = typeof args.title === "string" ? args.title : "Sandbox preview";
        const html = typeof args.html === "string" ? args.html : "";
        try {
          opts.onEvent({ type: "sandbox_ready", payload: { command: `Preparing web preview: ${title}` } });
          const artifact = await createSandboxPreview({ title, html });
          opts.onEvent({ type: "sandbox", payload: { state: "running", purpose: `Web preview: ${title}`, expiresAt: artifact.expiresAt } });
          opts.onEvent({ type: "artifact", payload: { ...artifact, origin: "create_web_preview", kind: "web-preview" } });
          const result = { created: true, name: artifact.name, expiresAt: artifact.expiresAt };
          opts.onEvent({ type: "tool_result", payload: { tool: call.name, result, sandbox: true } });
          messages.push({ role: "tool", content: JSON.stringify(result), toolCallId: call.id, name: call.name });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const result = { error: message };
          opts.onEvent({ type: "tool_result", payload: { tool: call.name, result, error: true } });
          messages.push({ role: "tool", content: JSON.stringify(result), toolCallId: call.id, name: call.name });
        }
        continue;
      }

      if (call.name !== "run_command") {
        opts.onEvent({
          type: "tool_result",
          payload: { tool: call.name, result: "Unknown tool", error: true },
        });
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: "Unknown tool" }),
          toolCallId: call.id,
          name: call.name,
        });
        continue;
      }

      const command = typeof call.args === "string" ? call.args : (call.args as { command?: string })?.command ?? "";

      const policy = splitCommand(command);
      if (!policy.allowed) {
        const result = { blocked: true, reason: policy.reason };
        opts.onEvent({
          type: "tool_result",
          payload: { tool: call.name, args: { command }, result, error: true },
        });
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          name: call.name,
        });
        continue;
      }

      try {
        if (opts.allowSandbox) {
          opts.onEvent({ type: "sandbox_ready", payload: { command } });
        }
        const started = Date.now();
        const result = await runInSandbox(command);
        opts.onEvent({
          type: "tool_result",
          payload: {
            tool: call.name,
            args: { command },
            result: {
              exitCode: result.exitCode,
              stdout: result.stdout,
              stderr: result.stderr,
              durationMs: Date.now() - started,
            },
            sandbox: !!opts.allowSandbox,
          },
        });
        messages.push({
          role: "tool",
          content: JSON.stringify(result),
          toolCallId: call.id,
          name: call.name,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        opts.onEvent({
          type: "tool_result",
          payload: { tool: call.name, args: { command }, result: { error: message }, error: true },
        });
        messages.push({
          role: "tool",
          content: JSON.stringify({ error: message }),
          toolCallId: call.id,
          name: call.name,
        });
      }
    }
  }

  opts.onEvent({ type: "completed", payload: {} });
  return finalContent;
}

export async function listModels() {
  const res = await fetch("https://opencode.ai/zen/v1/models", {
    headers: { Authorization: `Bearer ${process.env.OPENCODE_API_KEY}` },
  });
  if (!res.ok) throw new Error(`Models endpoint failed with ${res.status}`);
  const body = (await res.json()) as { data?: { id?: string }[] };
  return (body.data ?? []).map(m => m.id ?? "").filter(Boolean);
}
