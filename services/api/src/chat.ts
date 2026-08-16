import type { Express, Request, Response } from "express";
import { z } from "zod";
import { runAgent, type ModelMessage } from "./agent";

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

const SYSTEM_PROMPT = `You are Snappy, a focused AI agent workspace assistant. You are helpful, concise, and proactive. When the user asks for information, analysis, code, or summaries, respond directly. If they ask you to build a browser game, UI, prototype, or small website, use create_web_preview to make a complete self-contained HTML artifact; it will open automatically in Canvas for the user to interact with. If they ask you to verify, count, list, compare, transform, or compute something concrete, use the run_command tool in an isolated sandbox — prefer small, safe, read-friendly commands. Always explain what you are doing briefly before acting. Write responses in clean markdown where helpful.`;

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

    const send = (type: string, payload: Record<string, unknown>) => {
      const data = JSON.stringify({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type, occurredAt: new Date().toISOString(), payload });
      res.write(`data: ${data}\n\n`);
    };

    send("run.started", {});

    const messages: ModelMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...input.messages.map(m => ({ ...m, role: m.role === "agent" ? "assistant" : m.role } as ModelMessage)),
    ];

    let finished = false;
    try {
      await runAgent({
        modelId: input.modelId,
        messages,
        temperature: input.temperature ?? 0.6,
        maxTokens: input.maxTokens ?? 2048,
        allowSandbox: input.allowSandbox ?? true,
        onEvent: event => {
          if (event.type === "delta") send("run.delta", { text: event.payload.text });
          else if (event.type === "trace") send("run.trace", { label: event.payload.label, phase: event.payload.phase });
          else if (event.type === "tool_request") send("run.tool_request", { tool: event.payload.tool, args: event.payload.args });
          else if (event.type === "tool_result") send("run.tool_result", { tool: event.payload.tool, result: event.payload.result, error: event.payload.error });
          else if (event.type === "sandbox_ready") send("run.trace", { label: `Sandbox started for: ${event.payload.command}`, phase: "tool" });
          else if (event.type === "sandbox") send("run.sandbox", event.payload);
          else if (event.type === "artifact") send("run.artifact", event.payload);
          else if (event.type === "completed") {
            finished = true;
            send("run.completed", {});
            res.write(": done\n\n");
            res.end();
          }
        },
      });
      if (!finished) {
        send("run.completed", {});
        res.write(": done\n\n");
        res.end();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!finished) {
        send("run.failed", { message: message.slice(0, 500) });
        res.write(": failed\n\n");
        res.end();
      }
    }
  });
}
