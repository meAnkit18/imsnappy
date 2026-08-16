import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MONGODB_URI: z.string().min(20),
  MONGODB_DB_NAME: z.string().min(1).default("imsnappy"),
  HARNESS_BASE_URL: z.string().url(),
  INTERNAL_SERVICE_TOKEN: z.string().min(24),
  ORCHESTRATOR_POLL_INTERVAL_MS: z.coerce.number().int().min(5_000).max(300_000).default(30_000),
  ORCHESTRATOR_LEASE_MS: z.coerce.number().int().min(60_000).max(1_800_000).default(900_000),
  ORCHESTRATOR_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),
  ORCHESTRATOR_MAX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
});

export type OrchestratorConfig = Readonly<{
  environment: "development" | "test" | "production";
  mongoUri: string;
  mongoDatabaseName: string;
  harnessBaseUrl: string;
  harnessInternalServiceToken: string;
  pollIntervalMs: number;
  leaseMs: number;
  maxAttempts: number;
  maxBatchSize: number;
}>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): OrchestratorConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid orchestrator environment: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join(", ")}`);
  }
  return {
    environment: parsed.data.NODE_ENV,
    mongoUri: parsed.data.MONGODB_URI,
    mongoDatabaseName: parsed.data.MONGODB_DB_NAME,
    harnessBaseUrl: parsed.data.HARNESS_BASE_URL.replace(/\/$/, ""),
    harnessInternalServiceToken: parsed.data.INTERNAL_SERVICE_TOKEN,
    pollIntervalMs: parsed.data.ORCHESTRATOR_POLL_INTERVAL_MS,
    leaseMs: parsed.data.ORCHESTRATOR_LEASE_MS,
    maxAttempts: parsed.data.ORCHESTRATOR_MAX_ATTEMPTS,
    maxBatchSize: parsed.data.ORCHESTRATOR_MAX_BATCH_SIZE,
  };
}
