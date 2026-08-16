/**
 * I’m Snappy private agent harness.
 * Bind this service only to Render's private network; browser traffic must go through the API.
 */
import express from "express";
import { loadConfig } from "./config.js";
import { createRunsRouter } from "./routes/runs.js";

const config = loadConfig();
const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Liveness is deliberately public for Render health checks. All execution endpoints require the service token.
app.get("/health", (_request, response) => response.status(200).json({ status: "ok", service: "imsnappy-harness" }));
app.use("/internal", createRunsRouter(config));
app.use((_request, response) => response.status(404).json({ error: "not_found" }));

const server = app.listen(config.port, () => {
  console.log(`I’m Snappy harness listening on port ${config.port}`);
});

function shutdown(signal: string) {
  console.log(`Received ${signal}; stopping harness.`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT", () => shutdown("SIGINT"));
