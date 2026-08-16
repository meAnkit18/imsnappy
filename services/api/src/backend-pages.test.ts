import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { Context } from "./_core/trpc";

const OWNER_OPEN_ID = process.env.OWNER_OPEN_ID ?? "owner-open-id-fallback";

function createCaller(ctx: Context) {
  return appRouter.createCaller(ctx as unknown as never);
}

function reqCtx(user: { openId: string } | null) {
  return {
    req: { headers: {} } as unknown as Context["req"],
    res: { clearCookie: () => {} } as unknown as Context["res"],
    user,
  };
}

describe("settings router", () => {
  it("returns null for unauthenticated callers", async () => {
    const caller = createCaller(reqCtx(null));
    await expect(caller.settings.get()).resolves.toBeNull();
  });

  it("persists and retrieves preferences for the owner", async () => {
    const caller = createCaller(reqCtx({ openId: OWNER_OPEN_ID }));
    const updated = await caller.settings.update({
      provider: "opencode-zen",
      model: "hy3-free",
      temperature: 0.4,
      maxTokens: 512,
      aboutText: "vitest profile",
      workspaceName: "Test Room",
      agentPersonality: "concise",
      userName: "vitest-user",
      streaming: true,
    });
    expect(updated).not.toBeNull();
    expect(updated?.temperature).toBeCloseTo(0.4);
    expect(updated?.model).toBe("hy3-free");
    const fetched = await caller.settings.get();
    expect(fetched?.aboutText).toBe("vitest profile");
    expect(fetched?.workspaceName).toBe("Test Room");
    expect(fetched?.agentPersonality).toBe("concise");
  });
});

describe("schedules router", () => {
  it("lists, upserts, and removes tasks for the owner", async () => {
    const caller = createCaller(reqCtx({ openId: OWNER_OPEN_ID }));
    const publicId = `vitest-task-${Date.now()}`;
    const upserted = await caller.schedules.upsert({
      publicId,
      title: "vitest daily digest",
      description: "gather headlines for the test run",
      interval: "daily",
      intervalMinutes: 1440,
      enabled: true,
      nextRunAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    expect(upserted.success).toBe(true);

    const listed = await caller.schedules.list();
    const task = listed.find((t) => t.id === publicId);
    expect(task?.title).toBe("vitest daily digest");
    expect(task?.description).toBe("gather headlines for the test run");

    const removed = await caller.schedules.remove({ publicId });
    expect(removed.success).toBe(true);
    const after = await caller.schedules.list();
    expect(after.every((t) => t.id !== publicId)).toBe(true);
  });

  it("rejects unauthenticated upserts", async () => {
    const caller = createCaller(reqCtx(null));
    const result = await caller.schedules.upsert({
      publicId: `vitest-anon-${Date.now()}`,
      title: "should not persist",
      interval: "daily",
      intervalMinutes: 1440,
      enabled: true,
      nextRunAt: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});
