import { posix as path } from "node:path";
import { Sandbox } from "e2b";
import { z } from "zod";
import { createSandboxPreview, type SandboxPreviewArtifact } from "./preview.js";

export const AGENT_WORKSPACE_ROOT = "/home/oai/share";
const MAX_FILE_BYTES = 120_000;
const MAX_READ_BYTES = 24_000;
const MAX_LIST_ENTRIES = 80;
const COMMAND_TIMEOUT_MS = 45_000;
const WORKSPACE_TIMEOUT_MS = 10 * 60_000;

export type AgentToolCall = { id: string; name: string; args: unknown };

export type AgentToolResult = {
  ok: boolean;
  summary: string;
  data?: Record<string, unknown>;
  error?: { code: string; message: string; retryable: boolean };
};

export type AgentToolExecution = {
  tool: string;
  result: AgentToolResult;
  artifact?: SandboxPreviewArtifact;
};

export type AgentToolEvent = {
  type: "tool_progress" | "sandbox";
  payload: Record<string, unknown>;
};

type ToolEventEmitter = (event: AgentToolEvent) => void;

export type ModelToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

class AgentToolError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly retryable = true,
  ) {
    super(message);
  }
}

const relativePathSchema = z.string().trim().min(1).max(240);

const listFilesSchema = z.object({ path: z.string().trim().max(240).optional() });
const readFileSchema = z.object({ path: relativePathSchema });
const writeFileSchema = z.object({ path: relativePathSchema, content: z.string().max(MAX_FILE_BYTES) });
const runCommandSchema = z.object({ command: z.string().trim().min(1).max(1_500) });
const previewSchema = z.object({ title: z.string().trim().min(1).max(120), html: z.string().max(350_000) });

const ALLOWED_COMMANDS = new Set([
  "ls", "pwd", "find", "grep", "head", "tail", "wc", "node", "npm", "pnpm", "python3", "pytest", "git", "cat", "date",
]);

const FORBIDDEN_COMMAND_SYNTAX = /(?:[;&|><`$]|\$\(|\r|\n)/;
const FORBIDDEN_COMMAND_WORDS = /\b(?:sudo|curl|wget|ssh|scp|nc|telnet|docker|kubectl|aws|gcloud|chmod|chown|rm|mv|cp|dd|mkfs|mount|export|source)\b/i;

export function resolveWorkspacePath(input: string, allowRoot = false): string {
  const requested = input.trim();
  if (!requested && allowRoot) return AGENT_WORKSPACE_ROOT;
  if (!requested) throw new AgentToolError("invalid_path", "A workspace path is required.");
  if (requested.includes("\0")) throw new AgentToolError("invalid_path", "The workspace path contains an invalid character.");

  const withoutRoot = requested.startsWith(AGENT_WORKSPACE_ROOT)
    ? requested.slice(AGENT_WORKSPACE_ROOT.length)
    : requested;
  const parts = withoutRoot.replace(/^\/+/, "").split("/").filter(Boolean);
  if (parts.length === 0 && allowRoot) return AGENT_WORKSPACE_ROOT;
  if (parts.length === 0 || parts.some(part => part === "." || part === ".." || part.startsWith("."))) {
    throw new AgentToolError("invalid_path", "Use a non-hidden path inside the agent workspace.");
  }

  const resolved = path.normalize(path.join(AGENT_WORKSPACE_ROOT, ...parts));
  if (resolved !== AGENT_WORKSPACE_ROOT && !resolved.startsWith(`${AGENT_WORKSPACE_ROOT}/`)) {
    throw new AgentToolError("invalid_path", "The requested path is outside the agent workspace.");
  }
  return resolved;
}

export function validateWorkspaceCommand(command: string): string {
  const clean = command.trim();
  if (!clean) throw new AgentToolError("invalid_command", "The command is empty.");
  if (FORBIDDEN_COMMAND_SYNTAX.test(clean) || FORBIDDEN_COMMAND_WORDS.test(clean)) {
    throw new AgentToolError("blocked_command", "This command uses shell control, network, privilege, or destructive operations that are not available.", false);
  }

  const base = clean.split(/\s+/, 1)[0]?.replace(/^\.\//, "") ?? "";
  if (!ALLOWED_COMMANDS.has(base)) {
    throw new AgentToolError("blocked_command", `The command "${base}" is not available in the agent workspace.`, false);
  }
  return clean;
}

export class AgentWorkspace {
  private sandbox: Sandbox | null = null;
  private disposed = false;
  private readonly sandboxOperationId: string;

  constructor(
    private readonly emit: ToolEventEmitter,
    runId = crypto.randomUUID(),
  ) {
    this.sandboxOperationId = `workspace-${runId}`;
  }

  async ensure(): Promise<Sandbox> {
    if (this.disposed) throw new AgentToolError("workspace_closed", "The agent workspace is no longer available.", false);
    if (this.sandbox) return this.sandbox;

    this.emit({
      type: "sandbox",
      payload: { operationId: this.sandboxOperationId, state: "started", purpose: "Starting a reusable agent workspace" },
    });
    try {
      this.sandbox = await Sandbox.create({
        timeoutMs: WORKSPACE_TIMEOUT_MS,
        metadata: { product: "imsnappy", purpose: "agent-run-workspace" },
      });
      await this.sandbox.files.makeDir(AGENT_WORKSPACE_ROOT).catch(() => undefined);
      this.emit({
        type: "sandbox",
        payload: { operationId: this.sandboxOperationId, state: "running", purpose: "Reusable agent workspace ready" },
      });
      return this.sandbox;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emit({
        type: "sandbox",
        payload: { operationId: this.sandboxOperationId, state: "error", purpose: "Agent workspace", error: message },
      });
      throw new AgentToolError("workspace_unavailable", "The isolated agent workspace could not be started.", true);
    }
  }

  async list(requestedPath?: string) {
    const sandbox = await this.ensure();
    const workspacePath = resolveWorkspacePath(requestedPath ?? "", true);
    const entries = await sandbox.files.list(workspacePath);
    return entries.slice(0, MAX_LIST_ENTRIES).map(entry => ({
      name: entry.name,
      path: entry.path.replace(`${AGENT_WORKSPACE_ROOT}/`, ""),
      type: entry.type,
    }));
  }

  async read(requestedPath: string) {
    const sandbox = await this.ensure();
    const workspacePath = resolveWorkspacePath(requestedPath);
    const content = await sandbox.files.read(workspacePath);
    return {
      path: workspacePath.replace(`${AGENT_WORKSPACE_ROOT}/`, ""),
      content: content.slice(0, MAX_READ_BYTES),
      truncated: Buffer.byteLength(content, "utf8") > MAX_READ_BYTES,
    };
  }

  async write(requestedPath: string, content: string) {
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      throw new AgentToolError("file_too_large", "The requested file exceeds the 120 KB workspace limit.", false);
    }
    const sandbox = await this.ensure();
    const workspacePath = resolveWorkspacePath(requestedPath);
    await sandbox.files.write(workspacePath, content);
    return {
      path: workspacePath.replace(`${AGENT_WORKSPACE_ROOT}/`, ""),
      bytes: Buffer.byteLength(content, "utf8"),
    };
  }

  async run(command: string) {
    const sandbox = await this.ensure();
    const safeCommand = validateWorkspaceCommand(command);
    const started = Date.now();
    const result = await sandbox.commands.run(safeCommand, { timeoutMs: COMMAND_TIMEOUT_MS, cwd: AGENT_WORKSPACE_ROOT });
    return {
      command: safeCommand,
      exitCode: result.exitCode,
      stdout: result.stdout.slice(0, 8_000),
      stderr: result.stderr.slice(0, 4_000),
      durationMs: Date.now() - started,
    };
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.sandbox) return;
    this.emit({
      type: "sandbox",
      payload: { operationId: this.sandboxOperationId, state: "stopping", purpose: "Cleaning up the agent workspace" },
    });
    await this.sandbox.kill().catch(() => undefined);
    this.sandbox = null;
  }
}

const MODEL_TOOLS: ModelToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files in the current reusable agent workspace before reading or editing them. Paths are relative to the workspace.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Optional relative directory path" } }, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a UTF-8 file from the reusable agent workspace. Use this before revising a file.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Relative path to the file" } }, required: ["path"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or replace a UTF-8 source file in the reusable agent workspace with exact content.",
      parameters: { type: "object", properties: { path: { type: "string", description: "Relative output path" }, content: { type: "string", description: "Complete file content" } }, required: ["path", "content"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "run_command",
      description: "Run a bounded build, test, or inspection command in the reusable agent workspace. Shell control operators, network, privilege, and destructive commands are unavailable.",
      parameters: { type: "object", properties: { command: { type: "string", description: "One safe workspace command without shell chaining" } }, required: ["command"], additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "create_web_preview",
      description: "Create a single-file interactive browser preview in a persistent sandbox. Use this for a small website, UI prototype, game, or browser experience. Supply complete self-contained HTML with inline CSS and JavaScript and no external dependencies.",
      parameters: { type: "object", properties: { title: { type: "string", description: "Short artifact title" }, html: { type: "string", description: "Complete self-contained HTML" } }, required: ["title", "html"], additionalProperties: false },
    },
  },
];

export function getModelTools(allowSandbox: boolean): ModelToolDefinition[] | undefined {
  return allowSandbox ? MODEL_TOOLS : undefined;
}

function asErrorResult(error: unknown): AgentToolResult {
  if (error instanceof AgentToolError) {
    return { ok: false, summary: error.message, error: { code: error.code, message: error.message, retryable: error.retryable } };
  }
  const message = error instanceof Error ? error.message : "The tool could not complete.";
  return { ok: false, summary: message.slice(0, 500), error: { code: "tool_failed", message: message.slice(0, 500), retryable: true } };
}

export async function executeAgentTool(input: {
  call: AgentToolCall;
  workspace: AgentWorkspace;
  emit: ToolEventEmitter;
}): Promise<AgentToolExecution> {
  const { call, workspace, emit } = input;
  emit({ type: "tool_progress", payload: { operationId: call.id, tool: call.name, state: "running" } });

  try {
    if (call.name === "list_files") {
      const args = listFilesSchema.parse(call.args);
      const entries = await workspace.list(args.path);
      return { tool: call.name, result: { ok: true, summary: `${entries.length} workspace item${entries.length === 1 ? "" : "s"} listed.`, data: { entries } } };
    }
    if (call.name === "read_file") {
      const args = readFileSchema.parse(call.args);
      const file = await workspace.read(args.path);
      return { tool: call.name, result: { ok: true, summary: `Read ${file.path}.`, data: file } };
    }
    if (call.name === "write_file") {
      const args = writeFileSchema.parse(call.args);
      const file = await workspace.write(args.path, args.content);
      return { tool: call.name, result: { ok: true, summary: `Wrote ${file.path}.`, data: file } };
    }
    if (call.name === "run_command") {
      const args = runCommandSchema.parse(call.args);
      const command = await workspace.run(args.command);
      const ok = command.exitCode === 0;
      return {
        tool: call.name,
        result: {
          ok,
          summary: ok ? `Command completed in ${command.durationMs} ms.` : `Command exited with code ${command.exitCode}.`,
          data: command,
          ...(ok ? {} : { error: { code: "command_failed", message: command.stderr || `Exit code ${command.exitCode}`, retryable: true } }),
        },
      };
    }
    if (call.name === "create_web_preview") {
      const args = previewSchema.parse(call.args);
      const artifact = await createSandboxPreview(args);
      return {
        tool: call.name,
        artifact,
        result: { ok: true, summary: `Created interactive preview ${artifact.name}.`, data: { created: true, name: artifact.name, expiresAt: artifact.expiresAt } },
      };
    }
    throw new AgentToolError("unknown_tool", `The tool "${call.name}" is not registered.`, false);
  } catch (error) {
    return { tool: call.name, result: asErrorResult(error) };
  }
}
