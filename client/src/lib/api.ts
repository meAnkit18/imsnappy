/**
 * I’m Snappy API client — browser code may only hold a short-lived user session.
 * Provider, sandbox, and storage credentials remain server-side.
 */
export type Session = { accessToken: string; refreshToken: string; expiresIn: number };
export type StreamEvent = {
  id: string;
  runId: string;
  type: "run.started" | "run.delta" | "run.trace" | "run.tool_request" | "run.tool_result" | "run.artifact" | "run.awaiting_approval" | "run.completed" | "run.failed" | "run.cancelled";
  occurredAt: string;
  payload: Record<string, unknown>;
};

export type ArtifactType = "file" | "image" | "audio" | "video" | "document" | "transcript";
export type LibraryArtifact = {
  id: string;
  name: string;
  type: ArtifactType;
  contentType: string;
  bytes?: number;
  secureUrl?: string;
  sourceRunId?: string;
  createdAt: string;
};
export type Schedule = {
  id: string;
  name: string;
  prompt: string;
  modelId: string;
  timezone: string;
  nextRunAt: string;
  intervalMinutes?: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

type ApiErrorBody = { error?: { code?: string; message?: string } };

export class SnappyApi {
  constructor(
    private readonly baseUrl: string,
    private readonly getSession: () => Session | null,
  ) {}

  get configured() {
    return Boolean(this.baseUrl);
  }

  async register(input: { name: string; email: string; password: string }) {
    return this.request<Session>("/v1/auth/register", { method: "POST", body: input, authenticated: false });
  }

  async login(input: { email: string; password: string }) {
    return this.request<Session>("/v1/auth/login", { method: "POST", body: input, authenticated: false });
  }

  async createConversation(title: string) {
    return this.request<{ conversation: { id: string; title: string } }>("/v1/conversations", { method: "POST", body: { title } });
  }

  async getProviderSettings() {
    return this.request<{ providers: Array<{ provider: "opencode"; modelId: string; hasApiKey: boolean }> }>("/v1/settings/providers");
  }

  async saveOpenCodeSettings(input: { modelId: string; apiKey?: string }) {
    return this.request<{ provider: { provider: "opencode"; modelId: string; hasApiKey: boolean } }>("/v1/settings/providers/opencode", {
      method: "PUT",
      body: { provider: "opencode", ...input },
    });
  }

  async listArtifacts(type?: ArtifactType) {
    const query = type ? `?type=${encodeURIComponent(type)}` : "";
    return this.request<{ artifacts: LibraryArtifact[] }>(`/v1/library${query}`);
  }

  async uploadArtifact(file: File, type: Exclude<ArtifactType, "transcript">): Promise<LibraryArtifact> {
    const { upload } = await this.request<{ upload: { url: string; fields: Record<string, string | number> } }>("/v1/library/uploads/sign", {
      method: "POST",
      body: { name: file.name, contentType: file.type || "application/octet-stream", type },
    });
    const form = new FormData();
    Object.entries(upload.fields).forEach(([key, value]) => form.append(key, String(value)));
    form.append("file", file);
    const cloudinaryResponse = await fetch(upload.url, { method: "POST", body: form });
    if (!cloudinaryResponse.ok) throw new Error("The asset storage provider could not accept this file.");
    const cloudinary = (await cloudinaryResponse.json()) as { public_id?: string; secure_url?: string; bytes?: number };
    if (!cloudinary.public_id || !cloudinary.secure_url) throw new Error("The uploaded asset did not return a usable storage URL.");
    const result = await this.request<{ artifact: LibraryArtifact }>("/v1/library", {
      method: "POST",
      body: { name: file.name, contentType: file.type || "application/octet-stream", type, publicId: cloudinary.public_id, secureUrl: cloudinary.secure_url, bytes: cloudinary.bytes },
    });
    return result.artifact;
  }

  async deleteArtifact(artifactId: string): Promise<void> {
    await this.request<unknown>(`/v1/library/${encodeURIComponent(artifactId)}`, { method: "DELETE" });
  }

  async transcribeMedia(file: File) {
    const form = new FormData();
    form.append("audio", file);
    const response = await fetch(this.url("/v1/transcriptions"), { method: "POST", headers: this.headers(true), body: form });
    if (!response.ok) throw await this.toError(response);
    return (await response.json()) as { artifact: LibraryArtifact; transcript: { text?: string; duration?: number } };
  }

  async listSchedules() {
    return this.request<{ schedules: Schedule[] }>("/v1/schedules");
  }

  async createSchedule(input: Omit<Schedule, "id" | "createdAt" | "updatedAt">) {
    return this.request<{ schedule: Schedule }>("/v1/schedules", { method: "POST", body: input });
  }

  async updateSchedule(scheduleId: string, input: Partial<Omit<Schedule, "id" | "createdAt" | "updatedAt">>) {
    return this.request<{ schedule: Schedule }>(`/v1/schedules/${encodeURIComponent(scheduleId)}`, { method: "PATCH", body: input });
  }

  async deleteSchedule(scheduleId: string): Promise<void> {
    await this.request<unknown>(`/v1/schedules/${encodeURIComponent(scheduleId)}`, { method: "DELETE" });
  }

  async sendMessage(conversationId: string, input: { text: string; modelId?: string; allowSandbox: boolean }) {
    return this.request<{ message: { id: string }; run: { id: string } }>(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`, { method: "POST", body: input });
  }

  async streamRun(runId: string, onEvent: (event: StreamEvent) => void, signal?: AbortSignal) {
    const response = await fetch(this.url(`/v1/runs/${encodeURIComponent(runId)}/events`), {
      headers: this.headers(true),
      signal,
    });
    if (!response.ok || !response.body) throw await this.toError(response);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;
        onEvent(JSON.parse(dataLine.slice(6)) as StreamEvent);
      }
      if (done) break;
    }
  }

  async request<T>(path: string, options: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown; authenticated?: boolean } = {}): Promise<T> {
    const response = await fetch(this.url(path), {
      method: options.method ?? "GET",
      headers: { ...this.headers(options.authenticated !== false), ...(options.body ? { "content-type": "application/json" } : {}) },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (!response.ok) throw await this.toError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private url(path: string) {
    return `${this.baseUrl.replace(/\/$/, "")}${path}`;
  }

  private headers(authenticated: boolean): HeadersInit {
    const session = this.getSession();
    if (authenticated && !session) throw new Error("Sign in to connect I’m Snappy to your workspace service.");
    return authenticated && session ? { authorization: `Bearer ${session.accessToken}` } : {};
  }

  private async toError(response: Response) {
    const body = (await response.json().catch(() => ({}))) as ApiErrorBody;
    return new Error(body.error?.message ?? `Request failed (${response.status}).`);
  }
}
