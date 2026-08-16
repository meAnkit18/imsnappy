import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

/**
 * One row per user holding agent preferences: model provider, model id,
 * generation parameters, and profile/personality text.
 */
export const preferences = mysqlTable("preferences", {
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth openId of the owner; kept unique so there is one row per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  provider: varchar("provider", { length: 32 }).default("opencode-zen").notNull(),
  model: varchar("model", { length: 64 }).default("hy3-free").notNull(),
  temperature: int("temperature").default(60).notNull(),
  maxTokens: int("maxTokens").default(1024).notNull(),
  aboutText: text("aboutText"),
  workspaceName: varchar("workspaceName", { length: 128 }),
  agentPersonality: text("agentPersonality"),
  userName: varchar("userName", { length: 128 }),
  streaming: int("streaming").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Preference = typeof preferences.$inferSelect;
export type InsertPreference = typeof preferences.$inferInsert;

/**
 * Durable scheduled tasks that the deployed orchestrator will eventually
 * pick up; until then the preview page renders and mutates them directly.
 */
export const scheduledTasks = mysqlTable("scheduled_tasks", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull(),
  /** Stable public id used by the client so reorders don't shuffle ids. */
  publicId: varchar("publicId", { length: 64 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  interval: varchar("interval", { length: 32 }).default("daily").notNull(),
  intervalMinutes: int("intervalMinutes").default(1440).notNull(),
  enabled: int("enabled").default(1).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ScheduledTaskRow = typeof scheduledTasks.$inferSelect;
export type InsertScheduledTask = typeof scheduledTasks.$inferInsert;

/**
 * Library assets: metadata in MySQL, bytes in S3 via the built-in storage helpers.
 */
export const libraryAssets = mysqlTable("library_assets", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull(),
  publicId: varchar("publicId", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  kind: varchar("kind", { length: 32 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }),
  storageKey: varchar("storageKey", { length: 255 }).notNull(),
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(),
  sizeBytes: int("sizeBytes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type LibraryAssetRow = typeof libraryAssets.$inferSelect;
export type InsertLibraryAsset = typeof libraryAssets.$inferInsert;