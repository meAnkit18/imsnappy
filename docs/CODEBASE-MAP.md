# Codebase Map

## Local workspace: `/home/ubuntu/agentelier`

| Area | Key files | Responsibility | Change with care because… |
| --- | --- | --- | --- |
| Client routes | `client/src/App.tsx` | Wouter routes for Workspace, App Store, Library, Settings, and Scheduled. | Navigation must retain the shared sidebar and valid escape routes. |
| Workspace | `client/src/pages/Home.tsx` | Composer, chat thread, Canvas mode, streaming reader, tool trace. | It protects the fixed-composer and Canvas-centered layout decisions. |
| Shared navigation | `client/src/components/Sidebar.tsx`, `DiscoverLayout.tsx` | Consistent compact/expanded sidebar across all pages. | Previous work specifically removed expansion jitter. Prefer transform/opacity transitions. |
| Discover pages | `client/src/pages/{AppStore,Library,Settings,Scheduled}Page.tsx` | Feature surfaces outside the chat workspace. | Pages support anonymous local fallback and signed-in server state differently. |
| Local browser persistence | `client/src/lib/localStore.ts` | Conversations, local Library fallback, local preferences, and local schedule fallback. | Keep data types synchronized with page expectations. |
| Typed client API | `client/src/lib/trpc.ts` | tRPC React hooks and transport. | Use it for standard backend CRUD; do not create ad hoc HTTP wrappers where a router fits. |
| CSS/design system | `client/src/index.css`, `client/index.html` | Font loading, tokens, editorial visual language, responsive constraints. | Global changes can affect every route and the fixed-height workspace. |
| Server bootstrap | `server/_core/index.ts` | Express configuration, auth/storage setup, tRPC, registration order for custom routes, Vite bridge. | Custom POST routes must register before Vite middleware. |
| Local agent loop | `server/chat.ts`, `server/agent.ts` | SSE input normalization, model streaming, tool-call loop, E2B lifecycle, free-model retry. | Contains secret-using integrations and security policy. |
| Local Library upload | `server/library.ts`, `server/storage.ts` | Base64 upload route, managed S3 write, storage URL return. | Never accept unbounded payloads or expose managed credentials. |
| Persistence | `drizzle/schema.ts`, `server/db.ts`, `server/routers.ts` | Tables, query helpers, and tRPC procedures. | Database edits require schema, migration, helper, router, client, and tests. |
| Tests | `server/*.test.ts`, `vitest.config.ts` | Router behavior, secrets/integration health, and backend pages. | Browser interaction still needs manual or screenshot verification. |
| Work tracking | `todo.md`, `docs/DECISIONS.md` | Active work and permanent design choices. | Update both when behavior or architecture changes. |

## Local server route map

| Route or namespace | File | Method | Purpose |
| --- | --- | --- | --- |
| `/api/trpc/auth.*` | `server/routers.ts` | tRPC | Return current user and clear session. |
| `/api/trpc/settings.*` | `server/routers.ts` | tRPC | Read/update durable preference fields for a signed-in owner. |
| `/api/trpc/schedules.*` | `server/routers.ts` | tRPC | List/upsert/remove signed-in schedule records. |
| `/api/trpc/library.*` | `server/routers.ts` | tRPC | List/add/remove signed-in Library metadata. |
| `/api/chat/stream` | `server/chat.ts` | POST, SSE response | Stream an OpenCode/E2B agent run. |
| `/api/library/upload` | `server/library.ts` | POST | Store file bytes with the managed storage helper. |

## Deployable monorepo: `/home/ubuntu/imsnappy-staging`

| Path | Deployment unit | Role |
| --- | --- | --- |
| `client/` | Vercel project | Browser UI and public API client. |
| `services/api/` | Render web service | Auth, Mongo persistence, Cloudinary/Groq operations, public SSE gateway. |
| `services/harness/` | Render private service | OpenCode calls, E2B execution, policy enforcement, run events. |
| `services/orchestrator/` | Render background worker | Schedule leases, retries, idempotency, run dispatch. |
| `packages/contracts/` | Shared package | Secret-free request DTOs and normalized run event types. |
| `render.yaml` | Render Blueprint | Independent service definitions and environment-variable names. |
| `docs/` | Internal documentation | PRD, contracts, deployment references. |

## Change routing guide

| If you need to change… | Begin in… | Then verify… |
| --- | --- | --- |
| Chat copy, trace presentation, Canvas layout | `Home.tsx` | Composer remains pinned; streaming and Canvas-off/on modes stay usable. |
| A persisted Setting, schedule field, or Library metadata field | `drizzle/schema.ts` | Migration, `db.ts`, `routers.ts`, page code, server tests. |
| Model fleet or sandbox policy | `server/agent.ts` | Unit/route tests plus a controlled browser or curl run. |
| Upload validation or file lifecycle | `server/library.ts` and Library page | Small-file upload, download, delete, storage metadata test. |
| Production service contract | `imsnappy-staging/packages/contracts` | API/harness/worker contract tests and deployment docs. |
| Future connector/App Store behavior | Product roadmap and staging contracts first | Security/approval model before UI installation state. |

## References

[1]: [Local router map](../client/src/App.tsx)
[2]: [Local persistence router](../server/routers.ts)
[3]: [Staging service map](../../imsnappy-staging/services/README.md)
