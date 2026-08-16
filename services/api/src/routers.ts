import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import * as db from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  settings: router({
    get: publicProcedure.query(async ({ ctx }) => {
      const openId = ctx.user?.openId;
      if (!openId) return null;
      const row = await db.getPreferences(openId);
      return row
        ? {
            provider: row.provider,
            model: row.model,
            temperature: (row.temperature ?? 60) / 100,
            maxTokens: row.maxTokens ?? 1024,
            aboutText: row.aboutText ?? "",
            workspaceName: row.workspaceName ?? "",
            agentPersonality: row.agentPersonality ?? "",
            userName: row.userName ?? "",
            streaming: row.streaming === 1,
          }
        : null;
    }),
    update: publicProcedure
      .input(
        z.object({
          provider: z.string().optional(),
          model: z.string().optional(),
          temperature: z.number().min(0).max(2).optional(),
          maxTokens: z.number().int().positive().optional(),
          aboutText: z.string().optional(),
          workspaceName: z.string().optional(),
          agentPersonality: z.string().optional(),
          userName: z.string().optional(),
          streaming: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.openId) return null;
        const merged = await db.upsertPreferences(ctx.user.openId, { openId: ctx.user.openId, 
          provider: input.provider ?? "opencode-zen",
          model: input.model ?? "hy3-free",
          temperature: input.temperature === undefined ? 60 : Math.round(input.temperature * 100),
          maxTokens: input.maxTokens ?? 1024,
          aboutText: input.aboutText ?? "",
          workspaceName: input.workspaceName ?? null,
          agentPersonality: input.agentPersonality ?? null,
          userName: input.userName ?? "",
          streaming: input.streaming === false ? 0 : 1,
        });
        return merged
          ? {
              provider: merged.provider,
              model: merged.model,
              temperature: (merged.temperature ?? 60) / 100,
              maxTokens: merged.maxTokens ?? 1024,
              aboutText: merged.aboutText ?? "",
              workspaceName: merged.workspaceName ?? "",
              agentPersonality: merged.agentPersonality ?? "",
              userName: merged.userName ?? "",
              streaming: merged.streaming === 1,
            }
          : null;
      }),
  }),

  schedules: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const openId = ctx.user?.openId;
      if (!openId) return [];
      const rows = await db.listScheduledTasks(openId);
      return rows.map((row) => ({
        id: row.publicId,
        title: row.title,
        description: row.description ?? "",
        interval: row.interval,
        intervalMinutes: row.intervalMinutes,
        enabled: row.enabled === 1,
        lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
        nextRunAt: row.nextRunAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
      }));
    }),
    upsert: publicProcedure
      .input(
        z.object({
          publicId: z.string().min(1),
          title: z.string().min(1).max(255),
          description: z.string().max(2000).optional(),
          interval: z.string().min(1).max(32),
          intervalMinutes: z.number().int().positive(),
          enabled: z.boolean(),
          nextRunAt: z.string(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.openId) return { success: false } as const;
        await db.upsertScheduledTask(ctx.user.openId, { openId: ctx.user.openId, 
          publicId: input.publicId,
          title: input.title,
          description: input.description ?? null,
          interval: input.interval,
          intervalMinutes: input.intervalMinutes,
          enabled: input.enabled ? 1 : 0,
          nextRunAt: new Date(input.nextRunAt),
        });
        return { success: true } as const;
      }),
    remove: publicProcedure
      .input(z.object({ publicId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.openId) return { success: false } as const;
        await db.deleteScheduledTask(ctx.user.openId, input.publicId);
        return { success: true } as const;
      }),
  }),

  library: router({
    list: publicProcedure.query(async ({ ctx }) => {
      const openId = ctx.user?.openId;
      if (!openId) return [];
      const rows = await db.listLibraryAssets(openId);
      return rows.map((row) => ({
        id: row.publicId,
        name: row.name,
        kind: row.kind,
        mimeType: row.mimeType,
        url: row.storageUrl,
        sizeBytes: row.sizeBytes,
        createdAt: row.createdAt.toISOString(),
      }));
    }),
    add: publicProcedure
      .input(
        z.object({
          publicId: z.string().min(1),
          name: z.string().min(1).max(255),
          kind: z.string().min(1).max(32),
          mimeType: z.string().max(128).optional(),
          url: z.string().min(1).max(1024),
          sizeBytes: z.number().int().nonnegative().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.openId) return { success: false } as const;
        await db.createLibraryAsset(ctx.user.openId, { openId: ctx.user.openId, 
          publicId: input.publicId,
          name: input.name,
          kind: input.kind,
          mimeType: input.mimeType ?? null,
          storageKey: input.url,
          storageUrl: input.url,
          sizeBytes: input.sizeBytes ?? null,
        });
        return { success: true } as const;
      }),
    remove: publicProcedure
      .input(z.object({ publicId: z.string().min(1) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user?.openId) return { success: false } as const;
        await db.deleteLibraryAsset(ctx.user.openId, input.publicId);
        return { success: true } as const;
      }),
  }),
});

export type AppRouter = typeof appRouter;
