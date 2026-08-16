/**
 * I'm Snappy — local preview store (design reminder: Quiet Intelligence editorial)
 *
 * Browser-only persistence so the workspace is fully testable without any backend.
 * Data stays on this device in localStorage; no credentials ever leave the browser.
 * Keys are namespaced under `imsnappy:` to avoid collisions.
 */

export type StoredMessage = {
  id: string;
  role: "user" | "agent";
  text: string;
  createdAt: string;
};

export type StoredConversation = {
  id: string;
  title: string;
  tone: "mint" | "peach" | "lavender";
  createdAt: string;
  updatedAt: string;
  messages: StoredMessage[];
};

export type LibraryAsset = {
  id: string;
  type: "image" | "audio" | "video" | "document" | "other";
  name: string;
  size: number;
  dataUrl?: string;
  url?: string;
  createdAt: string;
};

export type ScheduledTask = {
  id: string;
  title: string;
  description: string;
  interval: string;
  intervalMinutes: number;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  createdAt: string;
};

export type AgentPreferences = {
  provider: "opencode-zen" | "openai" | "anthropic" | "local";
  model: string;
  temperature: number;
  maxTokens: number;
  aboutText: string;
  workspaceName: string;
  agentPersonality: string;
  userName: string;
  streaming: boolean;
};

const KEYS = {
  conversations: "imsnappy:conversations",
  library: "imsnappy:library",
  schedules: "imsnappy:schedules",
  preferences: "imsnappy:preferences",
  sessions: "imsnappy:sessions",
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — degrade silently in the local preview.
  }
}

export function listConversations(): StoredConversation[] {
  return read<StoredConversation[]>(KEYS.conversations, []);
}

export function saveConversation(conversation: StoredConversation): void {
  const list = listConversations().filter((entry) => entry.id !== conversation.id);
  list.unshift(conversation);
  write(KEYS.conversations, list.slice(0, 50));
}

export function removeConversation(id: string): void {
  write(KEYS.conversations, listConversations().filter((entry) => entry.id !== id));
}

export function loadConversation(id: string): StoredConversation | null {
  return listConversations().find((entry) => entry.id === id) ?? null;
}

export function listAssets(): LibraryAsset[] {
  return read<LibraryAsset[]>(KEYS.library, []);
}

export function addAsset(asset: LibraryAsset): void {
  write(KEYS.library, [asset, ...listAssets()].slice(0, 100));
}

export function removeAsset(id: string): void {
  write(KEYS.library, listAssets().filter((asset) => asset.id !== id));
}

export function listSchedules(): ScheduledTask[] {
  return read<ScheduledTask[]>(KEYS.schedules, []);
}

export function saveSchedules(tasks: ScheduledTask[]): void {
  write(KEYS.schedules, tasks.slice(0, 50));
}

export function defaultPreferences(): AgentPreferences {
  return {
    provider: "opencode-zen",
    model: "hy3-free",
    temperature: 0.6,
    maxTokens: 1024,
    aboutText: "",
    workspaceName: "",
    agentPersonality: "",
    userName: "",
    streaming: true,
  };
}

export function readPreferences(): AgentPreferences {
  const stored = read<Partial<AgentPreferences>>(KEYS.preferences, {});
  const merged = { ...defaultPreferences(), ...stored };
  // Older previews persisted a rate-limited model; map it to the healthy default.
  if (merged.model === "deepseek-v4-flash-free") merged.model = "hy3-free";
  return merged;
}

export function savePreferences(preferences: Partial<AgentPreferences>): void {
  write(KEYS.preferences, { ...readPreferences(), ...preferences });
}

export type StoredSession = {
  id: string;
  conversationId: string;
  artifactId: string;
  name: string;
  url: string;
  origin?: string;
  kind?: string;
  prompt: string;
  createdAt: string;
  expiresAt?: string;
  traceCount: number;
};

export function listSessions(): StoredSession[] {
  return read<StoredSession[]>(KEYS.sessions, []);
}

export function saveSession(session: StoredSession): void {
  const list = listSessions().filter((entry) => entry.id !== session.id);
  list.unshift(session);
  write(KEYS.sessions, list.slice(0, 25));
}

export function removeSession(id: string): void {
  write(KEYS.sessions, listSessions().filter((entry) => entry.id !== id));
}
