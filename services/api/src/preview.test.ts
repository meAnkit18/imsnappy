import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatToolRequest,
  formatToolResult,
  isSandboxPreviewRequest,
  readSandboxLifecycle,
  readSandboxPreviewArtifact,
  sandboxPreviewCompletionMessage,
} from "../client/src/lib/sandboxPreview";
import { previewCompletionMessage } from "./agent";
import { buildSnakeGameHtml, isSnakeGameRequest, previewNameFromTitle, validatePreviewHtml } from "./preview";

describe("sandbox preview helpers", () => {
  it("recognizes the canonical playable Snake request", () => {
    expect(isSnakeGameRequest("Can you make a snake game using a sandbox and open its preview in the browser?")).toBe(true);
    expect(isSnakeGameRequest("Explain the history of Snake.")) .toBe(false);
  });

  it("produces a self-contained playable Snake artifact", () => {
    const html = buildSnakeGameHtml();
    expect(validatePreviewHtml(html)).toBe(html);
    expect(html).toContain('<canvas id="game"');
    expect(html).toContain("localStorage");
    expect(previewNameFromTitle("Snake game / prototype")).toBe("Snake-game-prototype.html");
  });

  it("gives a completed preview an actionable deterministic handoff", () => {
    const message = previewCompletionMessage("Snake-game.html");
    expect(message).toContain("Snake-game");
    expect(message).toContain("Focus game");
    expect(message).toContain("Arrow keys or WASD");
  });

  it("rejects empty, non-HTML, and oversized artifacts", () => {
    expect(() => validatePreviewHtml("")).toThrow("empty");
    expect(() => validatePreviewHtml("console.log('not HTML')")).toThrow("self-contained HTML");
    expect(() => validatePreviewHtml(`<html>${"x".repeat(350_001)}</html>`)).toThrow("350 KB");
  });
});

describe("browser artifact event parsing", () => {
  it("recognizes browser-build prompts before the artifact is ready", () => {
    expect(isSandboxPreviewRequest("Make a simple Snake game and preview it in the browser.")).toBe(true);
    expect(isSandboxPreviewRequest("Summarize the game design notes.")).toBe(false);
  });

  it("accepts only typed HTTPS preview artifacts", () => {
    expect(readSandboxPreviewArtifact({
      artifactId: "sandbox-preview-123",
      name: "snake.html",
      contentType: "text/html",
      url: "https://123-8080.e2b.app",
      preview: true,
    })).toMatchObject({ artifactId: "sandbox-preview-123", preview: true });

    expect(readSandboxPreviewArtifact({
      artifactId: "sandbox-preview-123",
      name: "snake.html",
      contentType: "text/html",
      url: "http://127.0.0.1:8080",
      preview: true,
    })).toBeNull();
    expect(readSandboxPreviewArtifact({ contentType: "text/html", url: "https://example.com", preview: false })).toBeNull();
  });

  it("provides an actionable fallback after a valid artifact event", () => {
    const artifact = readSandboxPreviewArtifact({
      artifactId: "sandbox-preview-123",
      name: "snake-game.html",
      contentType: "text/html",
      url: "https://123-8080.e2b.app",
      preview: true,
    });
    expect(artifact).not.toBeNull();
    expect(sandboxPreviewCompletionMessage(artifact!)).toContain("Focus game");
  });

  it("surfaces tool requests with deterministic, user-friendly trace labels", () => {
    expect(formatToolRequest("run_command", { command: "ls -la" })).toMatchObject({ label: "Run shell command in sandbox", detail: "ls -la" });
    expect(formatToolRequest("create_web_preview", { title: "My quiz app" })).toMatchObject({ label: "Build interactive browser preview", detail: "My quiz app" });
    expect(formatToolRequest("unknown_tool", { something: 1 })).toEqual({ label: "Use tool: unknown_tool" });
  });

  it("derives trace entry status and labels from tool results", () => {
    expect(formatToolResult("run_command", { exitCode: 0, stdout: "ok" }, null).status).toBe("done");
    expect(formatToolResult("run_command", { exitCode: 1, stderr: "boom" }, null).status).toBe("error");
    expect(formatToolResult("run_command", { blocked: true, reason: "rm -rf / is not allowed" }, null)).toMatchObject({ label: "Command blocked by policy", status: "error" });
    expect(formatToolResult("run_command", null, true).status).toBe("error");
  });

  it("parses sandbox lifecycle events with strict state validation", () => {
    expect(readSandboxLifecycle({ state: "started", purpose: "Snake game sandbox" })).toMatchObject({ state: "started", purpose: "Snake game sandbox" });
    expect(readSandboxLifecycle({ state: "running", expiresAt: "2099-01-01T00:00:00Z" })).toMatchObject({ state: "running" });
    expect(readSandboxLifecycle({ state: "expired" })).toMatchObject({ state: "expired" });
    expect(readSandboxLifecycle({ state: "error", error: "provisioning failed" })).toMatchObject({ state: "error" });
    expect(readSandboxLifecycle({ state: "unknown" })).toBeNull();
    expect(readSandboxLifecycle(undefined)).toBeNull();
  });

  it("keeps the Canvas conversation bound to the real streamed message", () => {
    const homeSource = readFileSync(resolve(process.cwd(), "client/src/pages/Home.tsx"), "utf8");
    expect(homeSource).toContain('{message.text || "The sandbox result is preparing."}');
    expect(homeSource).not.toContain("I’d start by separating the useful signal from the surrounding noise");
  });
});
