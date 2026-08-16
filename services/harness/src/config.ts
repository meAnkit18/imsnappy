import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4200),
  INTERNAL_SERVICE_TOKEN: z.string().min(24),
  OPENCODE_API_KEY: z.string().min(8),
  OPENCODE_BASE_URL: z.string().url().default("https://opencode.ai/zen/v1"),
  E2B_API_KEY: z.string().min(8).optional(),
  E2B_TEMPLATE: z.string().min(1).default("base"),
  AGENT_MAX_TOOL_ROUNDS: z.coerce.number().int().min(0).max(4).default(2),
  AGENT_MAX_COMMAND_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(120_000).default(30_000),
  AGENT_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(900_000).default(600_000),
});

export type HarnessConfig = Readonly<{
  environment: "development" | "test" | "production";
  port: number;
  internalServiceToken: string;
  openCodeApiKey: string;
  openCodeBaseUrl: string;
  e2bApiKey?: string;
  e2bTemplate: string;
  maxToolRounds: number;
  maxCommandTimeoutMs: number;
  requestTimeoutMs: number;
}>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HarnessConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid harness environment: ${parsed.error.issues.map((issue) => issue.path.join(".") + " " + issue.message).join(", ")}`);
  }

  return {
    environment: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    internalServiceToken: parsed.data.INTERNAL_SERVICE_TOKEN,
    openCodeApiKey: parsed.data.OPENCODE_API_KEY,
    openCodeBaseUrl: parsed.data.OPENCODE_BASE_URL.replace(/\/$/, ""),
    e2bApiKey: parsed.data.E2B_API_KEY,
    e2bTemplate: parsed.data.E2B_TEMPLATE,
    maxToolRounds: parsed.data.AGENT_MAX_TOOL_ROUNDS,
    maxCommandTimeoutMs: parsed.data.AGENT_MAX_COMMAND_TIMEOUT_MS,
    requestTimeoutMs: parsed.data.AGENT_REQUEST_TIMEOUT_MS,
  };
}
