# I’m Snappy Service Boundaries and Contracts

## Repository structure

```text
imsnappy/
├── client/                    # Vercel project: React + Vite user interface
├── packages/contracts/        # Shared, secret-free TypeScript DTOs/events
├── services/
│   ├── api/                   # Render web service: public API + SSE gateway
│   ├── harness/               # Render private service: models, tools, E2B
│   └── orchestrator/          # Render background worker: schedules and retries
├── docs/                      # Architecture and operational documentation
├── render.yaml                # Render blueprint, added in deployment phase
├── pnpm-workspace.yaml
└── .env.example               # Names only; no live credentials
```

The root now contains multiple deployment folders because each service is deployed independently. The Vercel project continues to use `client/` as its root directory. Render services use `services/api`, `services/harness`, and `services/orchestrator` as their root directories.

## Trust boundaries

The API is the only public server-side entry point. It verifies end-user credentials, enforces ownership, and removes secrets from response payloads. The harness and orchestrator do not receive browser traffic. They authenticate every request with a dedicated shared service token, use Render private networking in production, and write auditable status records to MongoDB.

| Caller | Callee | Authentication | Data allowed |
|---|---|---|---|
| Browser | API | Bearer access token | User messages, safe run events, upload intents |
| API | Harness | Service token + request ID | User-scoped run request, no browser session or provider secret |
| Orchestrator | Harness | Service token + request ID | Schedule invocation, deterministic idempotency key |
| API/Harness/Worker | MongoDB | Service connection credential | Strictly service-managed collections |
| API | Cloudinary/Groq | Provider secret | Bounded media operations only |
| Harness | OpenCode/E2B | Provider secret | Model/tool execution only |

## Streaming protocol

The API exposes Server-Sent Events. Each message has an event type from `@imsnappy/contracts`, an event ID, a run ID, an ISO timestamp, and a JSON payload. The browser should retain the last event ID and call `GET /v1/runs/:runId/events?after=<eventId>` after reconnecting. SSE replies never include an API key, command token, sandbox ID, MongoDB error, or raw provider response.

## Secret policy

Live credentials are never accepted through a browser request except an explicitly encrypted provider configuration endpoint. They must never appear in Git history, `.env.example`, logs, job payloads, client bundle variables, screenshots, or support messages. Render and Vercel environment settings hold deployment credentials. User-provided provider keys are envelope-encrypted at rest in MongoDB and can only be decrypted by the API while making an intended request.

## Reliability policy

Every asynchronous unit has an idempotency key. The API creates a run before requesting work from the harness. The orchestrator creates a scheduled job before dispatch. Each worker claim uses a short lease, and an expired lease is reclaimed safely. Terminal run and job records are immutable except for an audit-safe retry summary. Failure response bodies are normalized into user-safe error codes before reaching the browser.
