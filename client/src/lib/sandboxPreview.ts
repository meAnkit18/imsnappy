export type SandboxPreviewArtifact = {
  artifactId: string;
  name: string;
  contentType: "text/html";
  url: string;
  expiresAt?: string;
  origin?: string;
  kind?: string;
  preview: true;
};

export type SandboxLifecycleState = "started" | "running" | "stopping" | "expired" | "error";

export type SandboxLifecycleEvent = {
  operationId?: string;
  state: SandboxLifecycleState;
  purpose?: string;
  expiresAt?: string;
  error?: string;
};

export function readSandboxLifecycle(payload: Record<string, unknown> | undefined): SandboxLifecycleEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const state = payload.state;
  if (typeof state !== "string" || !isSandboxLifecycleState(state)) return null;
  return {
    operationId: typeof payload.operationId === "string" ? payload.operationId : undefined,
    state,
    purpose: safeActivityText(payload.purpose, 180),
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
    error: safeActivityText(payload.error, 240),
  };
}

function isSandboxLifecycleState(value: string): value is SandboxLifecycleState {
  return value === "started" || value === "running" || value === "stopping" || value === "expired" || value === "error";
}

export type WorkTraceKind = "run" | "model" | "tool" | "sandbox" | "file" | "browser" | "trace";
export type WorkTraceStatus = "pending" | "running" | "done" | "error";

export type WorkTraceEntry = {
  id: string;
  operationId: string;
  parentOperationId?: string;
  occurredAt: string;
  kind: WorkTraceKind;
  label: string;
  detail?: string;
  summary?: string;
  output?: string;
  durationMs?: number;
  status: WorkTraceStatus;
};

export type ActivityPresentation = Pick<WorkTraceEntry, "kind" | "label" | "detail">;

const SECRET_ASSIGNMENT = /\b([A-Z][A-Z0-9_]*(?:KEY|SECRET|TOKEN|PASSWORD)|authorization)\s*[=:]\s*(?:"[^"]*"|'[^']*'|\S+)/gi;
const TOKEN_LIKE_VALUE = /\b(?:sk|e2b|ghp|github_pat)_[A-Za-z0-9_-]+\b|\bBearer\s+[A-Za-z0-9._-]+\b/gi;

/** Redact obvious credentials and bound payload size before an execution detail reaches the UI. */
export function safeActivityText(value: unknown, limit = 320): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = value
    .replace(SECRET_ASSIGNMENT, "$1=[redacted]")
    .replace(TOKEN_LIKE_VALUE, "[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return undefined;
  return clean.length > limit ? `${clean.slice(0, Math.max(0, limit - 1))}…` : clean;
}

function commandPresentation(command: string): ActivityPresentation {
  const base = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const detail = safeActivityText(command, 240);
  if (["cat", "head", "tail", "less", "more", "sed", "awk"].includes(base)) return { kind: "file", label: "Reading a file in the sandbox", detail };
  if (["grep", "find", "rg", "fd"].includes(base)) return { kind: "file", label: "Searching sandbox files", detail };
  if (["ls", "tree", "pwd", "du", "stat", "file", "wc"].includes(base)) return { kind: "sandbox", label: "Inspecting the sandbox workspace", detail };
  if (["mkdir", "touch", "cp", "mv", "rm", "tee"].includes(base)) return { kind: "file", label: "Updating sandbox files", detail };
  if (["python3", "node", "npm", "pnpm", "yarn", "pip", "pip3"].includes(base)) return { kind: "sandbox", label: "Running a sandbox command", detail };
  if (["curl", "wget"].includes(base)) return { kind: "browser", label: "Requesting a web resource", detail };
  return { kind: "tool", label: "Running a shell command in the sandbox", detail };
}

/**
 * Deterministic, user-friendly labels for live tool activity. Raw arguments are
 * retained only as redacted, bounded details that can be expanded by the user.
 */
export function formatToolRequest(tool: unknown, args: unknown): ActivityPresentation {
  const name = typeof tool === "string" ? tool : "tool_call";
  if (name === "run_command") {
    const command = typeof args === "string" ? args : (args as { command?: unknown })?.command;
    return typeof command === "string" ? commandPresentation(command) : { kind: "tool", label: "Preparing a sandbox command" };
  }
  if (name === "create_web_preview") {
    const title = (args as { title?: unknown })?.title;
    return { kind: "browser", label: "Building an interactive browser preview", detail: safeActivityText(title, 160) };
  }
  return { kind: "tool", label: `Using ${name.replace(/_/g, " ")}` };
}

export function formatToolResult(
  tool: unknown,
  result: unknown,
  error: unknown,
): Pick<WorkTraceEntry, "status" | "summary" | "output" | "durationMs"> {
  if (error) return { status: "error", summary: "The operation could not be completed." };
  const res = result as { blocked?: boolean; reason?: string; exitCode?: number; durationMs?: number; stdout?: string; stderr?: string; name?: string; error?: string } | undefined;
  if (!res) return { status: "done" };
  if (res.blocked) return { status: "error", summary: safeActivityText(res.reason, 220) ?? "Blocked by the sandbox policy." };
  if (res.error) return { status: "error", summary: safeActivityText(res.error, 220) ?? "The operation could not be completed." };
  if (typeof res.exitCode === "number") {
    const output = safeActivityText(res.stdout || res.stderr, 700);
    return {
      status: res.exitCode === 0 ? "done" : "error",
      summary: res.exitCode === 0 ? "Completed in the sandbox." : `Exited with code ${res.exitCode}.`,
      output,
      durationMs: typeof res.durationMs === "number" ? res.durationMs : undefined,
    };
  }
  if (typeof res.name === "string") return { status: "done", summary: `${res.name.replace(/\.html$/i, "")} is ready.` };
  if (tool === "create_web_preview") return { status: "done", summary: "Interactive preview is ready." };
  return { status: "done" };
}

/** Update matching operations in place so a tool row visibly progresses instead of duplicating after completion. */
export function upsertWorkTrace(entries: WorkTraceEntry[], incoming: WorkTraceEntry): WorkTraceEntry[] {
  const index = entries.findIndex((entry) => entry.operationId === incoming.operationId);
  if (index < 0) return [...entries, incoming];
  const existing = entries[index];
  const next = [...entries];
  next[index] = {
    ...existing,
    ...incoming,
    id: existing.id,
    occurredAt: existing.occurredAt,
    label: incoming.label || existing.label,
    detail: incoming.detail ?? existing.detail,
    summary: incoming.summary ?? existing.summary,
    output: incoming.output ?? existing.output,
  };
  return next;
}

function isPublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/** Parse only explicitly marked HTML preview artifacts from the server event stream. */
export function readSandboxPreviewArtifact(payload: Record<string, unknown> | undefined): SandboxPreviewArtifact | null {
  if (!payload || payload.preview !== true || payload.contentType !== "text/html") return null;
  if (typeof payload.artifactId !== "string" || typeof payload.name !== "string" || typeof payload.url !== "string") return null;
  if (!isPublicHttpsUrl(payload.url)) return null;
  return {
    artifactId: payload.artifactId,
    name: payload.name,
    contentType: "text/html",
    url: payload.url,
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
    origin: typeof payload.origin === "string" ? payload.origin : undefined,
    kind: typeof payload.kind === "string" ? payload.kind : undefined,
    preview: true,
  };
}

/**
 * A browser artifact is already a completed, useful result. This copy provides
 * a resilient client-side handoff if an upstream stream closes after the
 * artifact event but before its human-readable completion delta arrives.
 */
export function sandboxPreviewCompletionMessage(artifact: SandboxPreviewArtifact): string {
  const title = artifact.name.replace(/\.html$/i, "");
  return `I created **${title}** in an isolated sandbox and opened it in Canvas. Click **Focus game** (or the preview itself) to play with Arrow keys or WASD. You can also use **Open** to launch the same preview in its own browser tab.`;
}

/** Keep the interface responsive while the server provisions an interactive browser artifact. */
export function isSandboxPreviewRequest(prompt: string): boolean {
  const normalized = prompt.toLowerCase();
  return /\b(game|website|web app|prototype|browser app|landing page|canvas)\b/.test(normalized)
    && /\b(build|make|create|code|preview|open|run)\b/.test(normalized);
}
