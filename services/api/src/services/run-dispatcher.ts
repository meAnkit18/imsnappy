import { randomUUID } from "node:crypto";
import type { RunRequest, StreamEvent } from "@imsnappy/contracts";
import type { DatabaseContext } from "../db.js";
import type { ApiConfig } from "../config.js";
import { streamHarnessRun } from "./harness-client.js";

const terminalEvents = new Set(["run.completed", "run.failed", "run.cancelled"]);

export async function dispatchRun(
  config: ApiConfig,
  database: DatabaseContext,
  request: RunRequest,
): Promise<void> {
  let sequence = 0;
  try {
    await database.collections.runs.updateOne(
      { _id: request.runId as never },
      { $set: { status: "running", startedAt: new Date(), updatedAt: new Date() } },
    );
    await persistEvent(database, request.userId, request.runId, ++sequence, {
      id: randomUUID(),
      runId: request.runId,
      type: "run.started",
      occurredAt: new Date().toISOString(),
      payload: {},
    });
    await streamHarnessRun(config, request, async (event) => {
      sequence += 1;
      await persistEvent(database, request.userId, request.runId, sequence, event);
      if (event.type === "run.completed") {
        const text = typeof event.payload.text === "string" ? event.payload.text : "";
        await database.collections.messages.insertOne({
          conversationId: request.conversationId,
          userId: request.userId,
          role: "assistant",
          text,
          runId: request.runId,
          createdAt: new Date(),
        });
        await database.collections.runs.updateOne(
          { _id: request.runId as never },
          { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date() } },
        );
      }
      if (event.type === "run.awaiting_approval") {
        await database.collections.runs.updateOne(
          { _id: request.runId as never },
          { $set: { status: "awaiting_approval", updatedAt: new Date() } },
        );
      }
      if (event.type === "run.failed" || event.type === "run.cancelled") {
        await database.collections.runs.updateOne(
          { _id: request.runId as never },
          {
            $set: {
              status: event.type === "run.cancelled" ? "cancelled" : "failed",
              errorCode: typeof event.payload.code === "string" ? event.payload.code : "agent_run_failed",
              completedAt: new Date(),
              updatedAt: new Date(),
            },
          },
        );
      }
    });
  } catch (error) {
    await persistEvent(database, request.userId, request.runId, ++sequence, {
      id: randomUUID(),
      runId: request.runId,
      type: "run.failed",
      occurredAt: new Date().toISOString(),
      payload: { code: "harness_unavailable", message: "The agent runtime could not complete this request." },
    });
    await database.collections.runs.updateOne(
      { _id: request.runId as never },
      { $set: { status: "failed", errorCode: "harness_unavailable", completedAt: new Date(), updatedAt: new Date() } },
    );
    console.error("Agent harness dispatch failed", error);
  }
}

async function persistEvent(
  database: DatabaseContext,
  userId: string,
  runId: string,
  sequence: number,
  event: StreamEvent,
): Promise<void> {
  await database.collections.runEvents.insertOne({
    runId,
    userId,
    sequence,
    type: event.type,
    payload: event.payload,
    createdAt: new Date(event.occurredAt),
  });
}
