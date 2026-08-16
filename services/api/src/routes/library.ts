import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/authenticate.js";

const signSchema = z.object({
  name: z.string().min(1).max(240),
  contentType: z.string().min(3).max(160),
  type: z.enum(["file", "image", "audio", "video", "document"]),
});
const artifactTypeSchema = z.enum(["file", "image", "audio", "video", "document", "transcript"]);
const registerSchema = signSchema.extend({ publicId: z.string().min(1).max(512), secureUrl: z.string().url(), bytes: z.number().int().nonnegative().optional() });

export function createLibraryRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();
  router.use(requireAuth(config));

  router.get("/", async (request, response) => {
    const typeResult = typeof request.query.type === "string" ? artifactTypeSchema.safeParse(request.query.type) : undefined;
    if (typeResult && !typeResult.success) throw new HttpError(400, "invalid_artifact_type", "Choose a supported Library type.");
    const filter = { userId: request.auth!.sub, deletedAt: { $exists: false }, ...(typeResult?.success ? { type: typeResult.data } : {}) };
    const artifacts = await database.collections.artifacts.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
    response.json({ artifacts: artifacts.map((item) => ({ ...item, id: String(item._id), _id: undefined })) });
  });

  router.post("/uploads/sign", async (request, response, next) => {
    try {
      const input = signSchema.parse(request.body);
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `imsnappy/${request.auth!.sub}`;
      const publicId = `${folder}/${randomUUID()}`;
      const signature = createHash("sha1")
        .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${config.cloudinaryApiSecret}`)
        .digest("hex");
      response.json({
        upload: {
          url: `https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/auto/upload`,
          fields: { api_key: config.cloudinaryApiKey, timestamp, folder, public_id: publicId, signature },
          constraints: { maxBytes: 100 * 1024 * 1024, contentType: input.contentType, name: input.name },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (request, response, next) => {
    try {
      const input = registerSchema.parse(request.body);
      const artifact = {
        _id: randomUUID() as never,
        userId: request.auth!.sub,
        name: input.name,
        type: input.type,
        contentType: input.contentType,
        cloudinaryPublicId: input.publicId,
        secureUrl: input.secureUrl,
        bytes: input.bytes,
        createdAt: new Date(),
      };
      await database.collections.artifacts.insertOne(artifact);
      response.status(201).json({ artifact: { ...artifact, id: String(artifact._id), _id: undefined } });
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:artifactId", async (request, response, next) => {
    try {
      const result = await database.collections.artifacts.updateOne(
        { _id: request.params.artifactId as never, userId: request.auth!.sub, deletedAt: { $exists: false } },
        { $set: { deletedAt: new Date() } },
      );
      if (!result.matchedCount) throw new HttpError(404, "artifact_not_found", "This library item does not exist.");
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}
