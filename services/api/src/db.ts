import { MongoClient, type Collection, type Db } from "mongodb";
import type {
  ArtifactDocument,
  ConversationDocument,
  MessageDocument,
  ProviderConfigDocument,
  RefreshTokenDocument,
  RunDocument,
  RunEventDocument,
  ScheduleDocument,
  ScheduledJobDocument,
  UserDocument,
} from "./models.js";

export interface Collections {
  users: Collection<UserDocument>;
  refreshTokens: Collection<RefreshTokenDocument>;
  providerConfigs: Collection<ProviderConfigDocument>;
  conversations: Collection<ConversationDocument>;
  messages: Collection<MessageDocument>;
  runs: Collection<RunDocument>;
  runEvents: Collection<RunEventDocument>;
  artifacts: Collection<ArtifactDocument>;
  schedules: Collection<ScheduleDocument>;
  scheduledJobs: Collection<ScheduledJobDocument>;
}

export interface DatabaseContext {
  client: MongoClient;
  db: Db;
  collections: Collections;
}

export async function connectDatabase(uri: string): Promise<DatabaseContext> {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8_000 });
  await client.connect();
  const db = client.db();
  const collections: Collections = {
    users: db.collection<UserDocument>("users"),
    refreshTokens: db.collection<RefreshTokenDocument>("refreshTokens"),
    providerConfigs: db.collection<ProviderConfigDocument>("providerConfigs"),
    conversations: db.collection<ConversationDocument>("conversations"),
    messages: db.collection<MessageDocument>("messages"),
    runs: db.collection<RunDocument>("runs"),
    runEvents: db.collection<RunEventDocument>("runEvents"),
    artifacts: db.collection<ArtifactDocument>("artifacts"),
    schedules: db.collection<ScheduleDocument>("schedules"),
    scheduledJobs: db.collection<ScheduledJobDocument>("scheduledJobs"),
  };
  await ensureIndexes(collections);
  return { client, db, collections };
}

async function ensureIndexes(collections: Collections): Promise<void> {
  await Promise.all([
    collections.users.createIndex({ email: 1 }, { unique: true }),
    collections.conversations.createIndex({ userId: 1, updatedAt: -1 }),
    collections.messages.createIndex({ conversationId: 1, createdAt: 1 }),
    collections.runs.createIndex({ conversationId: 1, createdAt: 1 }),
    collections.runEvents.createIndex({ runId: 1, sequence: 1 }, { unique: true }),
    collections.artifacts.createIndex({ userId: 1, createdAt: -1 }),
    collections.schedules.createIndex({ enabled: 1, nextRunAt: 1 }),
    collections.scheduledJobs.createIndex({ idempotencyKey: 1 }, { unique: true }),
  ]);
}
