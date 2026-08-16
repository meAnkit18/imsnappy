/**
 * Shared, dependency-free contracts for communication between the API,
 * agent harness, and scheduling worker. Do not include secrets in these types.
 */

export type RunStatus =
  | "queued"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type RunEventType =
  | "run.started"
  | "run.delta"
  | "run.trace"
  | "run.tool_request"
  | "run.tool_result"
  | "run.artifact"
  | "run.awaiting_approval"
  | "run.completed"
  | "run.failed"
  | "run.cancelled";

export type ActorRole = "user" | "assistant" | "tool" | "system";
export type ArtifactType = "file" | "image" | "audio" | "video" | "document" | "transcript";

export interface StreamEvent<TPayload = Record<string, unknown>> {
  id: string;
  runId: string;
  type: RunEventType;
  occurredAt: string;
  payload: TPayload;
}

export interface AssistantDeltaPayload {
  text: string;
}

export interface TracePayload {
  label: string;
  detail?: string;
  phase: "planning" | "model" | "tool" | "storage" | "system";
}

export interface ArtifactPayload {
  artifactId: string;
  name: string;
  type: ArtifactType;
  contentType: string;
  url?: string;
}

export interface RunRequest {
  runId: string;
  userId: string;
  conversationId: string;
  messageId: string;
  prompt: string;
  model: {
    provider: "opencode";
    modelId: string;
  };
  toolPolicy: {
    allowSandbox: boolean;
    requireApprovalForCommands: boolean;
    allowedCommands: string[];
  };
  idempotencyKey: string;
}

export interface ScheduleInvocation {
  scheduleId: string;
  jobId: string;
  userId: string;
  prompt: string;
  conversationId?: string;
  modelId: string;
  idempotencyKey: string;
}

export interface InternalRequestHeaders {
  "x-imsnappy-service-token": string;
  "x-request-id": string;
}

export const RUN_EVENT_TYPES: readonly RunEventType[] = [
  "run.started",
  "run.delta",
  "run.trace",
  "run.tool_request",
  "run.tool_result",
  "run.artifact",
  "run.awaiting_approval",
  "run.completed",
  "run.failed",
  "run.cancelled",
] as const;
