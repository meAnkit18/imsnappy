import type { ArtifactType, RunEventType, RunStatus } from "@imsnappy/contracts";
export interface UserDocument {
  _id?: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshTokenDocument {
  _id?: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

export interface ProviderConfigDocument {
  _id?: string;
  userId: string;
  provider: "opencode";
  modelId: string;
  encryptedApiKey?: string;
  keyVersion?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationDocument {
  _id?: string;
  userId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageDocument {
  _id?: string;
  conversationId: string;
  userId: string;
  role: "user" | "assistant" | "tool" | "system";
  text: string;
  runId?: string;
  createdAt: Date;
}

export interface RunDocument {
  _id?: string;
  userId: string;
  conversationId: string;
  messageId: string;
  status: RunStatus;
  modelId: string;
  errorCode?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  updatedAt: Date;
}

export interface RunEventDocument {
  _id?: string;
  runId: string;
  userId: string;
  sequence: number;
  type: RunEventType;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface ArtifactDocument {
  _id?: string;
  userId: string;
  name: string;
  type: ArtifactType;
  contentType: string;
  bytes?: number;
  cloudinaryPublicId?: string;
  secureUrl?: string;
  sourceRunId?: string;
  createdAt: Date;
  deletedAt?: Date;
}

export interface ScheduleDocument {
  _id?: string;
  userId: string;
  name: string;
  prompt: string;
  modelId: string;
  timezone: string;
  nextRunAt: Date;
  intervalMinutes?: number;
  enabled: boolean;
  leaseExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduledJobDocument {
  _id?: string;
  scheduleId: string;
  userId: string;
  idempotencyKey: string;
  status: "queued" | "running" | "completed" | "failed";
  attempt: number;
  leaseExpiresAt?: Date;
  runId?: string;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}
