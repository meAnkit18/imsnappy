import { createHash, randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import type { ApiConfig } from "../config.js";
import type { DatabaseContext } from "../db.js";
import { HttpError } from "../lib/http.js";
import { requireAuth } from "../middleware/authenticate.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 24 * 1024 * 1024, files: 1 } });

export function createTranscriptionRouter(config: ApiConfig, database: DatabaseContext): Router {
  const router = Router();
  router.use(requireAuth(config));
  router.post("/", upload.single("audio"), async (request, response, next) => {
    try {
      const file = request.file;
      if (!file) throw new HttpError(400, "audio_required", "Attach an audio file as the `audio` field.");
      if (!file.mimetype.startsWith("audio/") && !file.mimetype.startsWith("video/")) {
        throw new HttpError(415, "unsupported_media", "Only audio or video files can be transcribed.");
      }
      const form = new FormData();
      const audioBytes = file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength) as ArrayBuffer;
      form.set("file", new Blob([audioBytes], { type: file.mimetype }), file.originalname);
      form.set("model", "whisper-large-v3-turbo");
      form.set("response_format", "verbose_json");
      const groqResponse = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { authorization: `Bearer ${config.groqApiKey}` },
        body: form,
        signal: AbortSignal.timeout(120_000),
      });
      if (!groqResponse.ok) throw new HttpError(502, "transcription_unavailable", "The transcription provider could not process this audio.");
      const transcript = (await groqResponse.json()) as { text?: string; duration?: number; segments?: unknown[] };
      const timestamp = Math.floor(Date.now() / 1000);
      const folder = `imsnappy/${request.auth!.sub}/transcripts`;
      const publicId = `${folder}/${randomUUID()}`;
      const signature = createHash("sha1")
        .update(`folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${config.cloudinaryApiSecret}`)
        .digest("hex");
      const transcriptForm = new FormData();
      transcriptForm.set("api_key", config.cloudinaryApiKey);
      transcriptForm.set("timestamp", String(timestamp));
      transcriptForm.set("folder", folder);
      transcriptForm.set("public_id", publicId);
      transcriptForm.set("signature", signature);
      transcriptForm.set("file", new Blob([transcript.text ?? ""], { type: "text/plain" }), `${file.originalname}.txt`);
      const storageResponse = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudinaryCloudName}/raw/upload`, {
        method: "POST",
        body: transcriptForm,
        signal: AbortSignal.timeout(60_000),
      });
      if (!storageResponse.ok) throw new HttpError(502, "transcript_storage_unavailable", "The transcript was created but could not be stored in your Library.");
      const stored = (await storageResponse.json()) as { public_id?: string; secure_url?: string; bytes?: number };
      if (!stored.public_id || !stored.secure_url) throw new HttpError(502, "transcript_storage_unavailable", "The transcript storage provider did not return a usable file URL.");
      const artifact = {
        _id: randomUUID() as never,
        userId: request.auth!.sub,
        name: `${file.originalname}.txt`,
        type: "transcript" as const,
        contentType: "text/plain",
        cloudinaryPublicId: stored.public_id,
        secureUrl: stored.secure_url,
        bytes: stored.bytes,
        createdAt: new Date(),
      };
      await database.collections.artifacts.insertOne(artifact);
      response.status(201).json({ artifact: { ...artifact, id: String(artifact._id), _id: undefined }, transcript });
    } catch (error) {
      next(error);
    }
  });
  return router;
}
