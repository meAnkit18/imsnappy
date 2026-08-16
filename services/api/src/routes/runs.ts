import { Router } from "express";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/authenticate.js";

const terminalStates = new Set(["completed", "failed", "cancelled"]);

export function createRunRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();
  router.use(requireAuth(config));

  router.get("/:runId", async (request, response, next) => {
    try {
      const run = await database.collections.runs.findOne({ _id: request.params.runId as never, userId: request.auth!.sub });
      if (!run) throw new HttpError(404, "run_not_found", "This agent run does not exist.");
      response.json({ run: { ...run, id: String(run._id), _id: undefined } });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:runId/events", async (request, response, next) => {
    try {
      const run = await database.collections.runs.findOne({ _id: request.params.runId as never, userId: request.auth!.sub });
      if (!run) throw new HttpError(404, "run_not_found", "This agent run does not exist.");
      response.status(200).set({
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
        "x-accel-buffering": "no",
      });
      response.flushHeaders();
      const after = Number(request.query.after ?? 0);
      let sequence = Number.isFinite(after) ? after : 0;
      let active = true;
      request.on("close", () => {
        active = false;
      });
      while (active) {
        const events = await database.collections.runEvents.find({ runId: request.params.runId, sequence: { $gt: sequence } }).sort({ sequence: 1 }).toArray();
        for (const event of events) {
          sequence = event.sequence;
          response.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify({ id: String(event._id), runId: event.runId, type: event.type, occurredAt: event.createdAt.toISOString(), payload: event.payload })}\n\n`);
        }
        const current = await database.collections.runs.findOne({ _id: request.params.runId as never, userId: request.auth!.sub });
        if (current && terminalStates.has(current.status) && events.length === 0) break;
        response.write(": heartbeat\n\n");
        await sleep(850);
      }
      response.end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
