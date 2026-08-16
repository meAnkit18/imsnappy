import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import type { RequestHandler } from "express";
import rateLimit from "express-rate-limit";
import { loadConfig } from "./config.js";
import { connectDatabase } from "./db.js";
import { errorHandler } from "./lib/http.js";
import { createAuthRouter } from "./routes/auth.js";
import { createConversationRouter } from "./routes/conversations.js";
import { createLibraryRouter } from "./routes/library.js";
import { createRunRouter } from "./routes/runs.js";
import { createScheduleRouter } from "./routes/schedules.js";
import { createSettingsRouter } from "./routes/settings.js";
import { createTranscriptionRouter } from "./routes/transcriptions.js";

const config = loadConfig();
const database = await connectDatabase(config.mongodbUri);
const app = express();

app.disable("x-powered-by");
app.use((request, response, next) => {
  const requestId = request.header("x-request-id") ?? randomUUID();
  response.setHeader("x-request-id", requestId);
  next();
});
app.use(cors({ origin: config.clientOrigin, methods: ["GET", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["authorization", "content-type", "last-event-id"] }));
app.use(express.json({ limit: "1mb" }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 500, standardHeaders: "draft-8", legacyHeaders: false }) as unknown as RequestHandler);

app.get("/health", (_request, response) => response.json({ status: "ok", service: "api" }));
app.use("/v1/auth", createAuthRouter(config, database));
app.use("/v1/conversations", createConversationRouter(config, database));
app.use("/v1/runs", createRunRouter(config, database));
app.use("/v1/settings", createSettingsRouter(config, database));
app.use("/v1/library", createLibraryRouter(config, database));
app.use("/v1/transcriptions", createTranscriptionRouter(config, database));
app.use("/v1/schedules", createScheduleRouter(config, database));
app.use(errorHandler);

const server = app.listen(config.port, () => console.log(JSON.stringify({ level: "info", service: "api", event: "listening", port: config.port })));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => void database.client.close().finally(() => process.exit(0)));
  });
}
