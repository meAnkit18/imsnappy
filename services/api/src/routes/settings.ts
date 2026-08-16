import { Router } from "express";
import { z } from "zod";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { encryptSecret } from "../lib/crypto.js";
import { requireAuth } from "../middleware/authenticate.js";

const settingsSchema = z.object({
  provider: z.literal("opencode").default("opencode"),
  modelId: z.string().min(1).max(160),
  apiKey: z.string().min(8).max(4096).optional(),
});

export function createSettingsRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();
  router.use(requireAuth(config));

  router.get("/providers", async (request, response) => {
    const providers = await database.collections.providerConfigs
      .find({ userId: request.auth!.sub })
      .project({ encryptedApiKey: 0 })
      .toArray();
    response.json({ providers: providers.map((item) => ({ ...item, id: item._id?.toString(), hasApiKey: Boolean(item.encryptedApiKey) })) });
  });

  router.put("/providers/opencode", async (request, response, next) => {
    try {
      const input = settingsSchema.parse(request.body);
      const now = new Date();
      const update: Record<string, unknown> = { modelId: input.modelId, updatedAt: now };
      if (input.apiKey) {
        update.encryptedApiKey = encryptSecret(input.apiKey, config.configEncryptionKey);
        update.keyVersion = "v1";
      }
      await database.collections.providerConfigs.updateOne(
        { userId: request.auth!.sub, provider: "opencode" },
        { $set: update, $setOnInsert: { userId: request.auth!.sub, provider: "opencode", createdAt: now } },
        { upsert: true },
      );
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}
