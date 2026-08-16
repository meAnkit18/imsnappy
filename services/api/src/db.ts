import { and, asc, eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertLibraryAsset,
  InsertPreference,
  InsertScheduledTask,
  libraryAssets,
  preferences,
  scheduledTasks,
  users,
  InsertUser,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ---------------- Preferences ----------------

export async function getPreferences(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(preferences).where(eq(preferences.openId, openId)).limit(1);
  return rows[0];
}

export async function upsertPreferences(openId: string, data: InsertPreference) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(preferences).values(data).onDuplicateKeyUpdate({
    set: {
      provider: data.provider ?? "opencode-zen",
      model: data.model ?? "hy3-free",
      temperature: data.temperature ?? 60,
      maxTokens: data.maxTokens ?? 1024,
      aboutText: data.aboutText ?? null,
      workspaceName: data.workspaceName ?? null,
      agentPersonality: data.agentPersonality ?? null,
      userName: data.userName ?? null,
      streaming: data.streaming ?? 1,
    },
  });
  return getPreferences(openId);
}

// ---------------- Scheduled tasks ----------------

export async function listScheduledTasks(openId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(scheduledTasks)
    .where(eq(scheduledTasks.openId, openId))
    .orderBy(asc(scheduledTasks.createdAt));
}

export async function upsertScheduledTask(openId: string, data: InsertScheduledTask) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .insert(scheduledTasks)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        title: data.title,
        description: data.description ?? null,
        interval: data.interval ?? "daily",
        intervalMinutes: data.intervalMinutes ?? 1440,
        enabled: data.enabled ?? 1,
        lastRunAt: data.lastRunAt ?? null,
        nextRunAt: data.nextRunAt,
      },
    });
}

export async function deleteScheduledTask(openId: string, publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .delete(scheduledTasks)
    .where(and(eq(scheduledTasks.openId, openId), eq(scheduledTasks.publicId, publicId)));
}

// ---------------- Library assets ----------------

export async function listLibraryAssets(openId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(libraryAssets)
    .where(eq(libraryAssets.openId, openId))
    .orderBy(desc(libraryAssets.createdAt));
}

export async function createLibraryAsset(openId: string, data: InsertLibraryAsset) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(libraryAssets).values(data);
  return listLibraryAssets(openId);
}

export async function deleteLibraryAsset(openId: string, publicId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db
    .delete(libraryAssets)
    .where(and(eq(libraryAssets.openId, openId), eq(libraryAssets.publicId, publicId)));
}
