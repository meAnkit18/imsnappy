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
  state: SandboxLifecycleState;
  purpose?: string;
  expiresAt?: string;
  error?: string;
};

export function readSandboxLifecycle(payload: Record<string, unknown> | undefined): SandboxLifecycleEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const state = payload.state;
  if (typeof state !== "string") return null;
  if (!isSandboxLifecycleState(state)) return null;
  return {
    state,
    purpose: typeof payload.purpose === "string" ? payload.purpose : undefined,
    expiresAt: typeof payload.expiresAt === "string" ? payload.expiresAt : undefined,
    error: typeof payload.error === "string" ? payload.error : undefined,
  };
}

function isSandboxLifecycleState(value: string): value is SandboxLifecycleState {
  return value === "started" || value === "running" || value === "stopping" || value === "expired" || value === "error";
}

export type WorkTraceEntry = {
  id: string;
  occurredAt: string;
  kind: "model" | "tool" | "sandbox" | "artifact" | "trace";
  label: string;
  detail?: string;
  status: "pending" | "running" | "done" | "error";
};

/**
 * Deterministic, user-friendly labels for the visible working log.
 * The server keeps raw tool arguments opaque; the UI decides what is safe to show.
 */
export function formatToolRequest(tool: unknown, args: unknown): { label: string; detail?: string } {
  const name = typeof tool === "string" ? tool : "tool_call";
  if (name === "run_command") {
    const command = typeof args === "string" ? args : (args as { command?: unknown })?.command;
    const detail = typeof command === "string" ? command : undefined;
    return { label: "Run shell command in sandbox", detail };
  }
  if (name === "create_web_preview") {
    const title = (args as { title?: unknown })?.title;
    const detail = typeof title === "string" ? title : undefined;
    return { label: "Build interactive browser preview", detail };
  }
  return { label: `Use tool: ${name}` };
}

export function formatToolResult(tool: unknown, result: unknown, error: unknown): { label: string; detail?: string; status: "done" | "error" } {
  const base = { label: `Tool finished: ${typeof tool === "string" ? tool : "tool_call"}` as string, status: "done" as const };
  if (error) return { ...base, status: "error" };
  const res = result as { blocked?: boolean; reason?: string; exitCode?: number; durationMs?: number; stdout?: string; stderr?: string; name?: string } | undefined;
  if (!res) return base;
  if (res.blocked) return { label: "Command blocked by policy", detail: res.reason, status: "error" };
  if (typeof res.exitCode === "number") return { ...base, status: res.exitCode === 0 ? "done" : "error" };
  return base;
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
