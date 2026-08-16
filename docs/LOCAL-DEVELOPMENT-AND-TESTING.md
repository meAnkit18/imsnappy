# Local Development and Testing

## Prerequisites

The Manus local workspace already provides the full-stack template services. Real chat and tool verification require managed `OPENCODE_API_KEY` and `E2B_API_KEY` secrets. Do not copy values into `.env`, test fixtures, documentation, or browser-accessible variables.

## Commands

```bash
cd /home/ubuntu/agentelier

pnpm run dev                # Starts Express + Vite in development mode
pnpm run check              # Runs TypeScript without emitting files
pnpm test                   # Runs the Vitest suite
RUN_LIVE_INTEGRATION_TESTS=1 pnpm test  # Also probes OpenCode and E2B with managed secrets
pnpm run build              # Builds client and server for a production smoke test
pnpm drizzle-kit generate   # Generates SQL after an intentional schema edit
```

| Command | What it proves | What it does not prove |
| --- | --- | --- |
| `pnpm run check` | Type-level compatibility. | Database behavior, browser UX, secret connectivity. |
| `pnpm test` | Unit/router and integration-health expectations. | Layout and interaction behavior in an actual browser. |
| `RUN_LIVE_INTEGRATION_TESTS=1 pnpm test` | Live provider authentication and gateway reachability. | A complete browser/SSE user flow. |
| `pnpm run build` | Production compilation. | External deployment configuration. |
| Browser smoke test | User-visible flows, SSE updates, UI layout. | Exhaustive failure/retry semantics. |

## Test inventory

| Test file | Coverage | Required when changing… |
| --- | --- | --- |
| `server/auth.logout.test.ts` | Framework logout behavior. | Auth/session changes. |
| `server/secrets.test.ts` | Managed-secret presence and integration health checks. | OpenCode or E2B configuration. |
| `server/backend-pages.test.ts` | Settings persistence, schedule CRUD, and anonymous rejection. | tRPC persistence flows. |
| New feature-specific `server/*.test.ts` | New server logic. | Every new route, procedure, policy, or data rule. |

## Required local smoke flows

Run the smallest relevant flow after test success. Preserve user privacy and use only harmless prompts/commands.

| Flow | Steps | Healthy result |
| --- | --- | --- |
| Chat | Start a new conversation and send `Hi`. | `run.started`, text deltas, then a complete assistant reply; composer never scrolls away. |
| Tool path | Ask the agent to run a harmless command such as `echo hello-snappy`. | Trace shows tool request/result; E2B completes; final response reflects bounded result. |
| Settings | Sign in, save a model/profile preference, reload. | Durable fields reload from MySQL. |
| Library | Upload a small safe file, reload, download, then delete. | Storage response returns; MySQL metadata appears only for the signed-in owner. |
| Schedule | Create, pause/resume, and delete a task. | UI and MySQL CRUD succeed; no claim is made that preview executes it. |
| Layout | Toggle Canvas and navigate all Discover pages. | Persistent sidebar; fixed composer; no visible page-level scroll regression. |

## Debugging order

1. Run `pnpm run check` and `pnpm test` first.
2. Inspect `.manus-logs/devserver.log` for server startup and route errors.
3. Inspect `.manus-logs/browserConsole.log` for client errors and `.manus-logs/networkRequests.log` for request status.
4. For visual behavior, capture both desktop and mobile screenshots before changing layout code.
5. For SSE behavior, reproduce with a small request, then inspect only safe event types. Do not write secrets or full provider error bodies to UI or docs.
6. If a change destabilizes the project and targeted edits cannot recover it, restore the most recent stable checkpoint rather than applying destructive Git commands.

## Live integration-test policy

The standard test suite is deterministic: it verifies that the required managed secret variables exist but does not make network calls to external providers. Use `RUN_LIVE_INTEGRATION_TESTS=1 pnpm test` before an integration release or after rotating a provider secret. This preserves a meaningful live check without letting a transient external timeout obscure unrelated local regressions. A `401` or `403` during the opted-in run indicates an invalid credential; transport timeouts indicate a provider or network availability issue and should be recorded separately from local test health.

## Database workflow

| Step | Required proof |
| --- | --- |
| Schema edit | New/changed table definition in `drizzle/schema.ts`. |
| Migration | Generated SQL reviewed before application. |
| Query layer | Owner-scoped helper in `server/db.ts`. |
| API layer | Typed router procedure with invalid/anonymous behavior specified. |
| Tests | Happy path plus boundary path. |
| UI | Query/mutation state, error state, and reload behavior verified. |

## References

[1]: [Project scripts](../package.json)
[2]: [Current test suite](../server)
[3]: [Agent handoff guide](../agent.md)
