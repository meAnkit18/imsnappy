/**
 * I’m Snappy background orchestrator.
 * This process has no public HTTP surface. It claims due schedules using short leases,
 * persists execution history, consumes harness SSE events, and retries safely.
 */
import { createHash, randomUUID } from "node:crypto";
import { MongoClient, type Collection, type Db, type WithId } from "mongodb";
import type { RunEventType, RunRequest, RunStatus, StreamEvent } from "@imsnappy/contracts";
import { loadConfig, type OrchestratorConfig } from "./config.js";

interface ScheduleDocument {
  _id: string;
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

interface ScheduledJobDocument {
  _id: string;
  scheduleId: string;
  userId: string;
  idempotencyKey: string;
  scheduledFor: Date;
  status: "queued" | "running" | "completed" | "failed";
  attempt: number;
  leaseExpiresAt?: Date;
  conversationId?: string;
  runId?: string;
  errorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ConversationDocument { _id: string; userId: string; title: string; createdAt: Date; updatedAt: Date }
interface MessageDocument { _id: string; conversationId: string; userId: string; role: "user" | "assistant" | "tool" | "system"; text: string; runId?: string; createdAt: Date }
interface RunDocument { _id: string; userId: string; conversationId: string; messageId: string; status: RunStatus; modelId: string; errorCode?: string; createdAt: Date; startedAt?: Date; completedAt?: Date; updatedAt: Date }
interface RunEventDocument { _id: string; runId: string; userId: string; sequence: number; type: RunEventType; payload: Record<string, unknown>; createdAt: Date }

interface Collections {
  schedules: Collection<ScheduleDocument>;
  scheduledJobs: Collection<ScheduledJobDocument>;
  conversations: Collection<ConversationDocument>;
  messages: Collection<MessageDocument>;
  runs: Collection<RunDocument>;
  runEvents: Collection<RunEventDocument>;
}

type ClaimedSchedule = WithId<ScheduleDocument>;

function makeIdempotencyKey(scheduleId: string, scheduledFor: Date): string {
  return createHash("sha256").update(`${scheduleId}:${scheduledFor.toISOString()}`).digest("hex");
}

function nextScheduledTime(schedule: ScheduleDocument, anchor: Date, now: Date): Date | undefined {
  if (!schedule.intervalMinutes) return undefined;
  const intervalMs = schedule.intervalMinutes * 60_000;
  let next = new Date(anchor.getTime() + intervalMs);
  while (next <= now) next = new Date(next.getTime() + intervalMs);
  return next;
}

function retryDelayMs(attempt: number): number {
  // 1m, 2m, 4m; small deterministic jitter limits thundering herds without breaking testability.
  const base = Math.min(15 * 60_000, 60_000 * 2 ** Math.max(0, attempt - 1));
  return base + Math.floor(base * 0.1);
}

async function ensureIndexes(collections: Collections): Promise<void> {
  await Promise.all([
    collections.schedules.createIndex({ enabled: 1, nextRunAt: 1 }),
    collections.scheduledJobs.createIndex({ idempotencyKey: 1 }, { unique: true }),
    collections.scheduledJobs.createIndex({ scheduleId: 1, status: 1, leaseExpiresAt: 1 }),
    collections.runEvents.createIndex({ runId: 1, createdAt: 1 }),
  ]);
}

async function claimDueSchedule(collections: Collections, now: Date, leaseMs: number): Promise<ClaimedSchedule | null> {
  const leaseExpiresAt = new Date(now.getTime() + leaseMs);
  const result = await collections.schedules.findOneAndUpdate(
    { enabled: true, nextRunAt: { $lte: now }, $or: [{ leaseExpiresAt: { $exists: false } }, { leaseExpiresAt: null as never }, { leaseExpiresAt: { $lte: now } }] },
    { $set: { leaseExpiresAt, updatedAt: now } },
    { sort: { nextRunAt: 1 }, returnDocument: "after" },
  );
  return result as ClaimedSchedule | null;
}

async function streamHarnessRun(
  config: OrchestratorConfig,
  request: RunRequest,
  onEvent: (event: StreamEvent) => Promise<void>,
): Promise<StreamEvent | undefined> {
  const response = await fetch(`${config.harnessBaseUrl}/internal/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-imsnappy-service-token": config.harnessInternalServiceToken,
      "x-request-id": randomUUID(),
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(Math.min(config.leaseMs - 5_000, 10 * 60_000)),
  });
  if (!response.ok || !response.body) throw new Error(`Harness request failed with status ${response.status}`);

  let pending = "";
  let terminal: StreamEvent | undefined;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    pending += decoder.decode(chunk.value, { stream: true });
    const records = pending.split("\n\n");
    pending = records.pop() ?? "";
    for (const record of records) {
      const raw = record.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
      if (!raw) continue;
      const event = JSON.parse(raw) as StreamEvent;
      await onEvent(event);
      if (event.type === "run.completed" || event.type === "run.failed" || event.type === "run.cancelled") terminal = event;
    }
  }
  return terminal;
}

async function persistEvent(collections: Collections, userId: string, runId: string, sequence: number, event: StreamEvent): Promise<void> {
  await collections.runEvents.insertOne({ _id: randomUUID(), runId, userId, sequence, type: event.type, payload: event.payload, createdAt: new Date(event.occurredAt) });
}

async function clearLeaseAndAdvance(
  collections: Collections,
  schedule: ClaimedSchedule,
  leaseExpiresAt: Date,
  anchor: Date,
  now: Date,
): Promise<void> {
  const nextRunAt = nextScheduledTime(schedule, anchor, now);
  await collections.schedules.updateOne(
    { _id: schedule._id, leaseExpiresAt },
    nextRunAt
      ? { $set: { nextRunAt, updatedAt: now }, $unset: { leaseExpiresAt: "" } }
      : { $set: { enabled: false, updatedAt: now }, $unset: { leaseExpiresAt: "" } },
  );
}

async function releaseForRetry(
  collections: Collections,
  schedule: ClaimedSchedule,
  job: ScheduledJobDocument,
  leaseExpiresAt: Date,
  now: Date,
  maxAttempts: number,
  errorCode: string,
): Promise<void> {
  const nextAttempt = job.attempt + 1;
  if (nextAttempt >= maxAttempts) {
    await collections.scheduledJobs.updateOne({ _id: job._id }, { $set: { status: "failed", attempt: nextAttempt, errorCode, updatedAt: now }, $unset: { leaseExpiresAt: "" } });
    await clearLeaseAndAdvance(collections, schedule, leaseExpiresAt, job.scheduledFor, now);
    return;
  }
  const retryAt = new Date(now.getTime() + retryDelayMs(nextAttempt));
  await collections.scheduledJobs.updateOne({ _id: job._id }, { $set: { status: "queued", attempt: nextAttempt, errorCode, updatedAt: now }, $unset: { leaseExpiresAt: "" } });
  await collections.schedules.updateOne(
    { _id: schedule._id, leaseExpiresAt },
    { $set: { nextRunAt: retryAt, updatedAt: now }, $unset: { leaseExpiresAt: "" } },
  );
}

async function findOrCreateJob(collections: Collections, schedule: ClaimedSchedule, now: Date): Promise<WithId<ScheduledJobDocument>> {
  const retry = await collections.scheduledJobs.findOne({
    scheduleId: schedule._id,
    $or: [{ status: "queued" }, { status: "running", leaseExpiresAt: { $lte: now } }],
  }, { sort: { scheduledFor: 1 } });
  if (retry) return retry;
  const scheduledFor = schedule.nextRunAt;
  const document: ScheduledJobDocument = {
    _id: randomUUID(),
    scheduleId: schedule._id,
    userId: schedule.userId,
    idempotencyKey: makeIdempotencyKey(schedule._id, scheduledFor),
    scheduledFor,
    status: "queued",
    attempt: 0,
    createdAt: now,
    updatedAt: now,
  };
  await collections.scheduledJobs.updateOne({ idempotencyKey: document.idempotencyKey }, { $setOnInsert: document }, { upsert: true });
  const created = await collections.scheduledJobs.findOne({ idempotencyKey: document.idempotencyKey });
  if (!created) throw new Error("Could not create a scheduled job.");
  return created;
}

async function executeSchedule(collections: Collections, config: OrchestratorConfig, schedule: ClaimedSchedule): Promise<void> {
  const now = new Date();
  const leaseExpiresAt = schedule.leaseExpiresAt;
  if (!leaseExpiresAt) return;
  const expectedIdempotencyKey = makeIdempotencyKey(schedule._id, schedule.nextRunAt);
  const priorCompleted = await collections.scheduledJobs.findOne({ idempotencyKey: expectedIdempotencyKey, status: "completed" });
  if (priorCompleted) {
    await clearLeaseAndAdvance(collections, schedule, leaseExpiresAt, priorCompleted.scheduledFor, now);
    return;
  }
  const job = await findOrCreateJob(collections, schedule, now);
  await collections.scheduledJobs.updateOne({ _id: job._id }, { $set: { status: "running", leaseExpiresAt, updatedAt: now }, $unset: { errorCode: "" } });

  const conversationId = job.conversationId ?? randomUUID();
  if (!job.conversationId) {
    await collections.conversations.insertOne({ _id: conversationId, userId: schedule.userId, title: `Scheduled · ${schedule.name}`, createdAt: now, updatedAt: now });
    await collections.scheduledJobs.updateOne({ _id: job._id }, { $set: { conversationId, updatedAt: now } });
  }
  const runId = randomUUID();
  const messageId = randomUUID();
  await collections.messages.insertOne({ _id: messageId, conversationId, userId: schedule.userId, role: "user", text: schedule.prompt, runId, createdAt: now });
  await collections.runs.insertOne({ _id: runId, userId: schedule.userId, conversationId, messageId, status: "running", modelId: schedule.modelId, createdAt: now, startedAt: now, updatedAt: now });
  await collections.scheduledJobs.updateOne({ _id: job._id }, { $set: { runId, updatedAt: now } });

  let sequence = 0;
  try {
    const terminal = await streamHarnessRun(config, {
      runId,
      userId: schedule.userId,
      conversationId,
      messageId,
      prompt: schedule.prompt,
      model: { provider: "opencode", modelId: schedule.modelId },
      toolPolicy: { allowSandbox: true, requireApprovalForCommands: false, allowedCommands: ["node", "npm", "npx", "python", "python3", "bash", "sh", "ls", "cat", "grep", "find", "sed", "awk", "git"] },
      idempotencyKey: job.idempotencyKey,
    }, async (event) => {
      sequence += 1;
      await persistEvent(collections, schedule.userId, runId, sequence, event);
      if (event.type === "run.completed") {
        const text = typeof event.payload.text === "string" ? event.payload.text : "";
        await collections.messages.insertOne({ _id: randomUUID(), conversationId, userId: schedule.userId, role: "assistant", text, runId, createdAt: new Date() });
        await collections.runs.updateOne({ _id: runId }, { $set: { status: "completed", completedAt: new Date(), updatedAt: new Date() } });
      }
      if (event.type === "run.failed" || event.type === "run.cancelled") {
        await collections.runs.updateOne({ _id: runId }, { $set: { status: event.type === "run.cancelled" ? "cancelled" : "failed", errorCode: typeof event.payload.code === "string" ? event.payload.code : "scheduled_run_failed", completedAt: new Date(), updatedAt: new Date() } });
      }
    });
    if (!terminal || terminal.type !== "run.completed") throw new Error(typeof terminal?.payload.code === "string" ? terminal.payload.code : "scheduled_run_failed");
    await collections.scheduledJobs.updateOne({ _id: job._id }, { $set: { status: "completed", updatedAt: new Date() }, $unset: { leaseExpiresAt: "" } });
    await clearLeaseAndAdvance(collections, schedule, leaseExpiresAt, job.scheduledFor, new Date());
  } catch (error) {
    const errorCode = error instanceof Error ? error.message.slice(0, 120) : "scheduled_run_failed";
    await collections.runs.updateOne({ _id: runId }, { $set: { status: "failed", errorCode, completedAt: new Date(), updatedAt: new Date() } });
    await releaseForRetry(collections, schedule, job, leaseExpiresAt, new Date(), config.maxAttempts, errorCode);
    console.error("Scheduled run failed", { scheduleId: schedule._id, jobId: job._id, error });
  }
}

async function poll(collections: Collections, config: OrchestratorConfig): Promise<void> {
  for (let processed = 0; processed < config.maxBatchSize; processed += 1) {
    const schedule = await claimDueSchedule(collections, new Date(), config.leaseMs);
    if (!schedule) return;
    await executeSchedule(collections, config, schedule);
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const client = new MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 10_000 });
  await client.connect();
  const database: Db = client.db(config.mongoDatabaseName);
  const collections: Collections = {
    schedules: database.collection<ScheduleDocument>("schedules"),
    scheduledJobs: database.collection<ScheduledJobDocument>("scheduledJobs"),
    conversations: database.collection<ConversationDocument>("conversations"),
    messages: database.collection<MessageDocument>("messages"),
    runs: database.collection<RunDocument>("runs"),
    runEvents: database.collection<RunEventDocument>("runEvents"),
  };
  await ensureIndexes(collections);
  console.log("I’m Snappy orchestrator started.");
  let stopping = false;
  let polling = false;
  const tick = async () => {
    if (stopping || polling) return;
    polling = true;
    try { await poll(collections, config); } catch (error) { console.error("Orchestrator poll failed", error); } finally { polling = false; }
  };
  await tick();
  const interval = setInterval(() => { void tick(); }, config.pollIntervalMs);
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearInterval(interval);
    console.log(`Received ${signal}; waiting for the active scheduling loop.`);
    while (polling) await new Promise((resolve) => setTimeout(resolve, 100));
    await client.close();
    process.exit(0);
  };
  process.once("SIGTERM", () => { void shutdown("SIGTERM"); });
  process.once("SIGINT", () => { void shutdown("SIGINT"); });
}

void main().catch((error) => {
  console.error("I’m Snappy orchestrator could not start", error);
  process.exit(1);
});
