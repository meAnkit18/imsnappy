import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { RunRequest } from "@imsnappy/contracts";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/authenticate.js";
import { dispatchRun } from "../services/run-dispatcher.js";

const conversationSchema = z.object({ title: z.string().min(1).max(160) });
const messageSchema = z.object({
  text: z.string().min(1).max(60_000),
  modelId: z.string().min(1).max(160).optional(),
  allowSandbox: z.boolean().default(false),
});

export function createConversationRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();
  router.use(requireAuth(config));

  router.get("/", async (request, response) => {
    const conversations = await database.collections.conversations
      .find({ userId: request.auth!.sub })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();
    response.json({ conversations: conversations.map(serialize) });
  });

  router.post("/", async (request, response, next) => {
    try {
      const input = conversationSchema.parse(request.body);
      const now = new Date();
      const conversation = { _id: randomUUID() as never, userId: request.auth!.sub, title: input.title, createdAt: now, updatedAt: now };
      await database.collections.conversations.insertOne(conversation);
      response.status(201).json({ conversation: serialize(conversation) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:conversationId/messages", async (request, response, next) => {
    try {
      await assertConversationOwner(database, request.params.conversationId, request.auth!.sub);
      const messages = await database.collections.messages
        .find({ conversationId: request.params.conversationId, userId: request.auth!.sub })
        .sort({ createdAt: 1 })
        .toArray();
      response.json({ messages: messages.map(serialize) });
    } catch (error) {
      next(error);
    }
  });

  router.post("/:conversationId/messages", async (request, response, next) => {
    try {
      const input = messageSchema.parse(request.body);
      const conversation = await assertConversationOwner(database, request.params.conversationId, request.auth!.sub);
      const provider = await database.collections.providerConfigs.findOne({ userId: request.auth!.sub, provider: "opencode" });
      const modelId = input.modelId ?? provider?.modelId ?? "deepseek-v4-flash";
      const now = new Date();
      const message = {
        _id: randomUUID() as never,
        conversationId: request.params.conversationId,
        userId: request.auth!.sub,
        role: "user" as const,
        text: input.text,
        createdAt: now,
      };
      const run = {
        _id: randomUUID() as never,
        userId: request.auth!.sub,
        conversationId: request.params.conversationId,
        messageId: message._id as string,
        status: "queued" as const,
        modelId,
        createdAt: now,
        updatedAt: now,
      };
      await database.collections.messages.insertOne(message);
      await database.collections.runs.insertOne(run);
      await database.collections.conversations.updateOne({ _id: conversation._id }, { $set: { updatedAt: now } });

      const runRequest: RunRequest = {
        runId: run._id as string,
        userId: request.auth!.sub,
        conversationId: request.params.conversationId,
        messageId: message._id as string,
        prompt: input.text,
        model: { provider: "opencode", modelId },
        toolPolicy: {
          allowSandbox: input.allowSandbox,
          requireApprovalForCommands: true,
          allowedCommands: ["node", "python", "python3", "npm", "pnpm", "ls", "cat", "find", "sed", "grep", "pwd"],
        },
        idempotencyKey: run._id as string,
      };
      void dispatchRun(config, database, runRequest);
      response.status(202).json({ message: serialize(message), run: serialize(run) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

async function assertConversationOwner(database: DatabaseContext, conversationId: string, userId: string) {
  const conversation = await database.collections.conversations.findOne({ _id: conversationId as never, userId });
  if (!conversation) throw new HttpError(404, "conversation_not_found", "This conversation does not exist.");
  return conversation;
}

function serialize<T extends { _id?: unknown }>(document: T): Omit<T, "_id"> & { id?: string } {
  const { _id, ...rest } = document;
  return { ...rest, ...(typeof _id !== "undefined" ? { id: String(_id) } : {}) };
}
