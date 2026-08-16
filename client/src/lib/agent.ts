/**
 * I'm Snappy — local agent client (design reminder: Quiet Intelligence editorial)
 *
 * Streams text from OpenCode Zen's free models directly from the browser so the
 * workspace is testable without a deployed backend. The provider key used here is
 * the user-provided development key stored only in their own localStorage; it is
 * never shipped in any source file. When the cloud API is configured, the runtime
 * prefers the server-side harness instead.
 */
import type { AgentPreferences } from "./localStore";

// OpenCode does not permit cross-origin browser streaming. The Manus Vite preview
// proxies this same request locally; deployed clients use the API/harness service.
export const OPENCODE_ZEN_URL = import.meta.env.DEV
  ? "/zen-api/chat/completions"
  : "https://opencode.ai/zen/v1/chat/completions";

export const FREE_MODELS = [
  { id: "hy3-free", label: "Hy 3 Free" },
  { id: "nemotron-3.5-lightning-free", label: "Nemotron 3.5 Lightning (free)" },
  { id: "nemotron-3-ultra-free", label: "Nemotron 3 Ultra (free)" },
  { id: "deepseek-v4-flash-free", label: "DeepSeek V4 Flash (free)" },
  { id: "mimo-v2.5-free", label: "Mimo V2.5 (free)" },
] as const;

export type StreamCallbacks = {
  onDelta: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
};

/**
 * Call OpenCode Zen with streaming and invoke callbacks per chunk.
 * Requires the user's own API key saved via Settings (local preview flow).
 */
export async function streamCompletion(
  messages: { role: "user" | "agent" | "system"; text: string }[],
  preferences: AgentPreferences,
  apiKey: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const response = await fetch(OPENCODE_ZEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: preferences.model,
        stream: preferences.streaming,
        temperature: preferences.temperature,
        max_tokens: preferences.maxTokens,
        messages: messages.map((entry) => ({
          role: entry.role === "agent" ? "assistant" : entry.role,
          content: entry.text,
        })),
      }),
      signal,
    });

    if (!response.ok || !response.body) {
      const message = response.status === 401 ? "The saved API key was rejected. Update it in Settings." : `Model request failed (${response.status}).`;
      throw new Error(message);
    }

    if (!preferences.streaming) {
      const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      const content = payload.choices?.[0]?.message?.content ?? "";
      callbacks.onDelta(content);
      callbacks.onComplete();
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payloadText = trimmed.slice(5).trim();
        if (payloadText === "[DONE]") {
          callbacks.onComplete();
          return;
        }
        try {
          const payload = JSON.parse(payloadText) as { choices?: { delta?: { content?: string } }[] };
          const content = payload.choices?.[0]?.delta?.content;
          if (content) callbacks.onDelta(content);
        } catch {
          // Non-JSON SSE frames are skipped safely.
        }
      }
    }
    callbacks.onComplete();
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      callbacks.onComplete();
      return;
    }
    callbacks.onError(error instanceof Error ? error.message : "Model request failed.");
  }
}

/**
 * Self-contained local loop used when no API key is configured: produces a calm,
 * thoughtful working reply with a working-trace cadence so the interface is still
 * testable without any model credentials.
 */
export function localEchoReply(prompt: string, callbacks: StreamCallbacks): () => void {
  const reply =
    "Here's the shape I'd give this work: first I'd separate the useful signal from the surrounding noise, then organize the result into a brief with evidence, choices, and an actionable next move. Add a provider key in Settings to connect the real model.";
  const words = reply.split(" ");
  let index = 0;
  const timer = window.setInterval(() => {
    const next = words.slice(index, index + 2).join(" ") + " ";
    index += 2;
    callbacks.onDelta(next);
    if (index >= words.length) {
      window.clearInterval(timer);
      callbacks.onComplete();
    }
  }, 35);
  return () => window.clearInterval(timer);
}
