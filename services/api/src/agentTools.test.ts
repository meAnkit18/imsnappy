import { describe, expect, it, vi } from "vitest";
import {
  AGENT_WORKSPACE_ROOT,
  executeAgentTool,
  getModelTools,
  resolveWorkspacePath,
  validateWorkspaceCommand,
  AgentWorkspace,
} from "./agentTools";

describe("Hermes-informed shared workspace tool registry", () => {
  it("advertises typed filesystem and bounded command tools only when sandbox access is enabled", () => {
    expect(getModelTools(false)).toBeUndefined();
    expect(getModelTools(true)?.map(tool => tool.function.name)).toEqual([
      "list_files",
      "read_file",
      "write_file",
      "run_command",
      "create_web_preview",
    ]);
  });

  it("keeps file paths within the per-run workspace and rejects traversal or hidden paths", () => {
    expect(resolveWorkspacePath("src/app.ts")).toBe(`${AGENT_WORKSPACE_ROOT}/src/app.ts`);
    expect(resolveWorkspacePath(`${AGENT_WORKSPACE_ROOT}/notes/plan.md`)).toBe(`${AGENT_WORKSPACE_ROOT}/notes/plan.md`);
    expect(resolveWorkspacePath("", true)).toBe(AGENT_WORKSPACE_ROOT);
    expect(() => resolveWorkspacePath("../.env")).toThrow("workspace");
    expect(() => resolveWorkspacePath(".ssh/id_rsa")).toThrow("workspace");
  });

  it("permits simple workspace commands but blocks shell control, network, and destructive operations", () => {
    expect(validateWorkspaceCommand("pnpm test")).toBe("pnpm test");
    expect(validateWorkspaceCommand("node --version")).toBe("node --version");
    expect(() => validateWorkspaceCommand("node test.js && cat .env")).toThrow("not available");
    expect(() => validateWorkspaceCommand("curl https://example.com")).toThrow("not available");
    expect(() => validateWorkspaceCommand("rm -rf build")).toThrow("not available");
  });

  it("returns normalized, retryable tool failures rather than throwing malformed calls through the run loop", async () => {
    const emit = vi.fn();
    const execution = await executeAgentTool({
      call: { id: "call-1", name: "read_file", args: { path: "../outside.txt" } },
      workspace: new AgentWorkspace(emit, "test-run"),
      emit,
    });

    expect(emit).toHaveBeenCalledWith({ type: "tool_progress", payload: { operationId: "call-1", tool: "read_file", state: "running" } });
    expect(execution.result).toMatchObject({
      ok: false,
      error: { code: "invalid_path", retryable: true },
    });
  });

  it("keeps structured workspace results compact enough for the next model turn", async () => {
    const workspace = {
      list: vi.fn().mockResolvedValue([{ name: "app.ts", path: "src/app.ts", type: "file" }]),
    } as unknown as AgentWorkspace;
    const execution = await executeAgentTool({
      call: { id: "call-2", name: "list_files", args: { path: "src" } },
      workspace,
      emit: vi.fn(),
    });

    expect(execution.result).toEqual({
      ok: true,
      summary: "1 workspace item listed.",
      data: { entries: [{ name: "app.ts", path: "src/app.ts", type: "file" }] },
    });
  });
});
