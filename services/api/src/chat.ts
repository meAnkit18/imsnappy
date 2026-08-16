import type { Express, Request, Response } from "express";
import { z } from "zod";
import { runAgent, type ModelMessage } from "./agent.js";

const streamInput = z.object({
  modelId: z.string().min(1).max(128),
  messages: z.array(
    z.union([
      z.object({ role: z.enum(["system", "user"]), content: z.string().max(200_000) }),
      z.object({ role: z.enum(["assistant", "agent"]), content: z.string().max(200_000) }),
      z.object({
        role: z.literal("tool"),
        content: z.string().max(200_000),
        toolCallId: z.string().optional(),
        name: z.string().optional(),
      }),
    ])
  ).max(200),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(16).max(8192).optional(),
  allowSandbox: z.boolean().optional().default(true),
});

const SYSTEM_PROMPT = `You are Snappy, a focused AI agent workspace assistant. You are helpful, concise, and proactive. When the user asks for information, analysis, code, or summaries, respond directly. For multi-step coding or file work, first inspect the reusable agent workspace with list_files or read_file, then use write_file for exact source content, and run_command only to test or inspect that workspace. The workspace persists for every tool call in this run, but is cleaned up when the run ends. Use create_web_preview for a small website, UI, prototype, game, or browser experience when a self-contained HTML artifact is appropriate; it opens automatically in Canvas. Tool results are evidence: if an action fails, inspect the safe error and repair the plan rather than repeating it blindly. Do not claim a file was created, tested, or previewed unless its tool result confirms it. Always explain completed work briefly and write responses in clean markdown where helpful.`;

export function registerChatStream(app: Express) {
  app.post("/api/chat/stream", async (req: Request, res: Response) => {
    const parsed = streamInput.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid request", issues: parsed.error.issues.slice(0, 5) });
      return;
    }
    const input = parsed.data;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    let finished = false;

    // IncomingMessage can report destroyed after its request body is consumed;
    // an SSE response remains valid until the response itself closes.
    const clientIsGone = () => res.destroyed || res.writableEnded;
    const send = (type: string, payload: Record<string, unknown>) => {
      if (clientIsGone()) return;
      const data = JSON.stringify({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, occurredAt: new Date().toISOString(), payload });
      res.write(`data: ${data}\n\n`);
    };

    send("run.started", {});

    const messages: ModelMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...input.messages.map(m => ({ ...m, role: m.role === "agent" ? "assistant" : m.role } as ModelMessage)),
    ];

    try {
      await runAgent({
        modelId: input.modelId,
        messages,
        temperature: input.temperature ?? 0.6,
        maxTokens: input.maxTokens ?? 2048,
        allowSandbox: input.allowSandbox ?? true,
        onEvent: event => {
          if (event.type === "delta") send("run.delta", event.payload);
          else if (event.type === "trace") send("run.trace", event.payload);
          else if (event.type === "tool_request") send("run.tool_request", event.payload);
          else if (event.type === "tool_progress") send("run.tool_progress", event.payload);
          else if (event.type === "tool_result") send("run.tool_result", event.payload);
          else if (event.type === "sandbox_ready") send("run.trace", { operationId: `sandbox-${Date.now()}`, label: `Sandbox started for: ${event.payload.command}`, phase: "tool", kind: "sandbox", state: "running" });
          else if (event.type === "sandbox") send("run.sandbox", event.payload);
          else if (event.type === "artifact") send("run.artifact", event.payload);
          else if (event.type === "completed") {
            finished = true;
            send("run.completed", {});
            if (!clientIsGone()) {
              res.write(": done\n\n");
              res.end();
            }
          }
        },
      });
      if (!finished) {
        send("run.completed", {});
        if (!clientIsGone()) {
          res.write(": done\n\n");
          res.end();
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!finished && !clientIsGone()) {
        send("run.failed", { message: message.slice(0, 500) });
        res.write(": failed\n\n");
        res.end();
      }
    } finally {
    }
  });
}
