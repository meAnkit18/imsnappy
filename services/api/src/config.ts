import { z } from "zod";

const configSchema = z.object({
  nodeEnv: z.enum(["development", "test", "production"]).default("development"),
  port: z.coerce.number().int().positive().default(4100),
  mongodbUri: z.string().min(1),
  jwtAccessSecret: z.string().min(32),
  jwtRefreshSecret: z.string().min(32),
  configEncryptionKey: z.string().min(32),
  harnessBaseUrl: z.string().url(),
  internalServiceToken: z.string().min(32),
  clientOrigin: z.string().url(),
  cloudinaryCloudName: z.string().min(1),
  cloudinaryApiKey: z.string().min(1),
  cloudinaryApiSecret: z.string().min(1),
  groqApiKey: z.string().min(1),
});

export type ApiConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): ApiConfig {
  return configSchema.parse({
    nodeEnv: environment.NODE_ENV,
    port: environment.PORT,
    mongodbUri: environment.MONGODB_URI,
    jwtAccessSecret: environment.JWT_ACCESS_SECRET,
    jwtRefreshSecret: environment.JWT_REFRESH_SECRET,
    configEncryptionKey: environment.CONFIG_ENCRYPTION_KEY,
    harnessBaseUrl: environment.HARNESS_BASE_URL,
    internalServiceToken: environment.INTERNAL_SERVICE_TOKEN,
    clientOrigin: environment.CLIENT_ORIGIN,
    cloudinaryCloudName: environment.CLOUDINARY_CLOUD_NAME,
    cloudinaryApiKey: environment.CLOUDINARY_API_KEY,
    cloudinaryApiSecret: environment.CLOUDINARY_API_SECRET,
    groqApiKey: environment.GROQ_API_KEY,
  });
}
