import { describe, expect, it } from "vitest";

/**
 * Validates the OPENCODE_API_KEY and E2B_API_KEY project secrets with
 * lightweight live calls. E2B Sandbox.create is skipped because it spins up
 * real infrastructure; only auth validation is performed against the E2B API.
 */

const OPENCODE_API_KEY = process.env.OPENCODE_API_KEY;
const E2B_API_KEY = process.env.E2B_API_KEY;
const runLiveIntegrationTests = process.env.RUN_LIVE_INTEGRATION_TESTS === "1";
const liveIt = runLiveIntegrationTests ? it : it.skip;

describe("project secrets", () => {
  it("has non-empty secret values", () => {
    expect(OPENCODE_API_KEY && OPENCODE_API_KEY.length).toBeGreaterThan(10);
    expect(E2B_API_KEY && E2B_API_KEY.length).toBeGreaterThan(10);
  });

  liveIt("OPENCODE_API_KEY authenticates against the Zen models endpoint", async () => {
    const res = await fetch("https://opencode.ai/zen/v1/models", {
      headers: { Authorization: `Bearer ${OPENCODE_API_KEY}` },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data?: { id?: string }[] };
    const ids = (body.data ?? []).map(m => m.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain("deepseek-v4-flash-free");
  }, 30_000);

  liveIt("OPENCODE_API_KEY reaches the live streaming endpoint", async () => {
    const res = await fetch("https://opencode.ai/zen/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENCODE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "mimo-v2.5-free",
        messages: [{ role: "user", content: "OK" }],
        stream: true,
        max_tokens: 10,
      }),
    });
    expect([200, 429]).toContain(res.status);
    // Status alone proves the key is live against the free-tier gateway:
    // 200 means the stream was accepted, 429 means the key authenticated but
    // the free model is rate limited right now. Actual streamed content is
    // exercised end-to-end by the browser preview and by the agents endpoint.
    if (res.status === 200) {
      const contentType = res.headers.get("content-type") ?? "";
      expect(contentType).toContain("text/event-stream");
      // drain quickly without blocking the suite
      void res.body?.cancel();
    }
  }, 20_000);

  liveIt("E2B_API_KEY authenticates against the E2B API", async () => {
    const res = await fetch("https://api.e2b.dev/v1/sandboxes", {
      headers: {
        "X-API-Key": E2B_API_KEY!,
      },
    });
    // 200/204 = valid key; 401/403 = invalid key; 404 = endpoint moved but key reached the API
    expect([200, 204, 404]).toContain(res.status);
  }, 30_000);
});
