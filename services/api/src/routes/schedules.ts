import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/authenticate.js";

const scheduleSchema = z.object({
  name: z.string().min(1).max(120),
  prompt: z.string().min(1).max(30_000),
  modelId: z.string().min(1).max(160).default("deepseek-v4-flash"),
  timezone: z.string().min(1).max(80),
  nextRunAt: z.coerce.date(),
  intervalMinutes: z.number().int().min(5).max(43_200).optional(),
  enabled: z.boolean().default(true),
});

export function createScheduleRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();
  router.use(requireAuth(config));

  router.get("/", async (request, response) => {
    const schedules = await database.collections.schedules.find({ userId: request.auth!.sub }).sort({ nextRunAt: 1 }).toArray();
    response.json({ schedules: schedules.map(serialize) });
  });

  router.post("/", async (request, response, next) => {
    try {
      const input = scheduleSchema.parse(request.body);
      assertValidTimeZone(input.timezone);
      if (input.nextRunAt.getTime() < Date.now() - 60_000) throw new HttpError(400, "schedule_in_past", "Choose a future schedule time.");
      const now = new Date();
      const schedule = { _id: randomUUID() as never, userId: request.auth!.sub, ...input, createdAt: now, updatedAt: now };
      await database.collections.schedules.insertOne(schedule);
      response.status(201).json({ schedule: serialize(schedule) });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:scheduleId", async (request, response, next) => {
    try {
      const input = scheduleSchema.partial().parse(request.body);
      if (input.timezone) assertValidTimeZone(input.timezone);
      const result = await database.collections.schedules.findOneAndUpdate(
        { _id: request.params.scheduleId as never, userId: request.auth!.sub },
        { $set: { ...input, updatedAt: new Date() } },
        { returnDocument: "after" },
      );
      if (!result) throw new HttpError(404, "schedule_not_found", "This scheduled task does not exist.");
      response.json({ schedule: serialize(result) });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:scheduleId", async (request, response, next) => {
    try {
      const result = await database.collections.schedules.deleteOne({ _id: request.params.scheduleId as never, userId: request.auth!.sub });
      if (!result.deletedCount) throw new HttpError(404, "schedule_not_found", "This scheduled task does not exist.");
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}

function assertValidTimeZone(timezone: string): void {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new HttpError(400, "invalid_timezone", "Provide a valid IANA timezone such as Asia/Kolkata.");
  }
}

function serialize<T extends { _id?: unknown }>(document: T): Omit<T, "_id"> & { id?: string } {
  const { _id, ...rest } = document;
  return { ...rest, ...(typeof _id !== "undefined" ? { id: String(_id) } : {}) };
}
