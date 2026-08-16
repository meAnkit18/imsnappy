# Data and Contracts

## Local MySQL data model

The local preview stores durable signed-in state in MySQL through Drizzle. Browser-local storage remains a deliberate anonymous fallback and a temporary home for conversation drafts.

| Table | Ownership key | Purpose | Important fields |
| --- | --- | --- | --- |
| `users` | `openId` | Framework-managed Manus OAuth identity. | `role`, `name`, `email`, timestamps. |
| `preferences` | unique `openId` | One settings row per signed-in user. | `provider`, `model`, `temperature` scaled 0–200, `maxTokens`, profile fields, `streaming`. |
| `scheduled_tasks` | `openId`, unique `publicId` | Schedule definition and user-visible status. | `title`, `description`, interval, `nextRunAt`, `enabled`, optional `lastRunAt`. |
| `library_assets` | `openId`, unique `publicId` | Library metadata; file bytes are external. | `name`, `kind`, MIME type, storage key/URL, byte size. |

> The local preview does **not** yet persist conversations or run traces in MySQL. Conversation history is currently browser-local. Do not describe local chat history as durable multi-device storage.

## Local tRPC contract

All local tRPC surfaces live in `server/routers.ts`. The procedures are public at the transport layer but only act when `ctx.user?.openId` exists; anonymous reads return null/empty data and anonymous mutations return `{ success: false }`.

| Namespace | Procedure | Input | Output / rule |
| --- | --- | --- | --- |
| `auth` | `me`, `logout` | none | User context or session clear result. |
| `settings` | `get`, `update` | Preference subset | UI-friendly temperature is 0–2; DB persists an integer scaled by 100. |
| `schedules` | `list`, `upsert`, `remove` | Stable `publicId` and task fields | Each operation filters by caller `openId`. |
| `library` | `list`, `add`, `remove` | Asset metadata and `publicId` | Metadata is owner-scoped; file bytes are uploaded separately. |

### Database change protocol

1. Update `drizzle/schema.ts` and types.
2. Run `pnpm drizzle-kit generate`.
3. Read the generated SQL before applying it through the database migration workflow.
4. Add or revise `server/db.ts` helpers.
5. Add or revise `server/routers.ts` procedures.
6. Wire the client using `trpc.*.useQuery` or `useMutation`.
7. Add Vitest coverage for both the owner path and the anonymous/forbidden path.
8. Run tests and verify the visible page behavior.

## Chat SSE contract

`POST /api/chat/stream` is the local streaming endpoint. It accepts a model selection, bounded generation options, a conversation message list, and a sandbox permission flag. The server normalizes the UI role `agent` to OpenAI-compatible `assistant` before model invocation.

| Event | Meaning | Client action |
| --- | --- | --- |
| `run.started` | The server accepted the run. | Mark the assistant turn as active. |
| `run.trace` | Safe progress update such as a model-call phase. | Render a concise work-trace item. |
| `run.delta` | A text fragment from the model. | Append to the active assistant message. |
| `run.tool_request` | The model requested a tool. | Show the pending request without sensitive provider data. |
| `run.tool_result` | A policy or sandbox result is available. | Render bounded result text and error state. |
| `run.completed` | Terminal success. | Finalize the assistant message and persistence. |
| `run.failed` | Terminal error. | Show a user-safe error and preserve the input thread. |

The agent tries the requested free model first and only retries another model on HTTP 429. The present default is `hy3-free`. Each allowed sandbox command receives a 45-second cap; stdout is bounded to 8,000 characters and stderr to 4,000 characters.

## File upload contract

The local Library flow is intentionally two-step:

1. Browser sends a base64 payload and metadata to `POST /api/library/upload`.
2. `server/library.ts` converts input to bytes and calls the managed `storagePut` helper.
3. Server returns `storageKey`, `url`, and `sizeBytes`.
4. Browser invokes `library.add` to record owner-scoped metadata in MySQL.

This keeps file bytes out of relational tables. Future work should replace base64 transfer for large files with a bounded multipart or signed-upload protocol and should ensure the metadata stores the returned `storageKey` distinctly from its delivery URL.

## Deployed service contract

The external architecture uses shared, secret-free request and event types from `imsnappy-staging/packages/contracts`. Its browser-facing API emits normalized SSE events and supports resume by event ID; the private harness and worker authenticate with a service token. See the monorepo contract document before changing those shapes.

## References

[1]: [Local Drizzle schema](../drizzle/schema.ts)
[2]: [Local router implementation](../server/routers.ts)
[3]: [Local agent runtime](../server/agent.ts)
[4]: [Deployable service contracts](../../imsnappy-staging/docs/service-contracts.md)
