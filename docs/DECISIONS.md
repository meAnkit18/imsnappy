# Decision Record

This document records enduring product and engineering decisions. Add a new dated entry when a choice changes a boundary, data model, security posture, or sustained development workflow.

| Date | Decision | Rationale | Consequence |
| --- | --- | --- | --- |
| 2026-08-15 | Brand the product **I’m Snappy** everywhere. | Product naming requirement. | Use the apostrophe form; do not use `I.M.` branding. |
| 2026-08-15 | Use the Quiet Intelligence visual language. | The product should feel editorial and calm rather than like a generic dashboard. | Preserve off-white/warm ink palette, restrained motion, Cormorant Garamond display typography, and an uncluttered thread. |
| 2026-08-15 | Keep the composer pinned and chat internally scrollable. | The workspace is a dashboard-like working surface; input must remain available. | Avoid page-level scroll regressions and composer relocation. |
| 2026-08-15 | Keep Canvas central; show the conversation/trace panel only when Canvas is active. | Canvas is primary work context; right panel is supporting context. | Do not reintroduce a permanent context sidebar in Canvas-off mode. |
| 2026-08-15 | Share the same sidebar component across workspace and Discover pages. | Navigation must not change from route to route. | Preserve compact/expanded state and transform-based motion. |
| 2026-08-15 | Build App Store, Library, Settings, and Scheduled as distinct routes. | Each is a durable product surface, not a modal or fake menu action. | `AppStorePage` remains UI-only until a connector lifecycle is designed. |
| 2026-08-16 | Use a custom local SSE endpoint for chat. | The local preview requires progressive stream events beyond the simple CRUD tRPC flow. | Keep `POST /api/chat/stream` registered before Vite middleware. |
| 2026-08-16 | Default local OpenCode model to `hy3-free` with 429-only fallback fleet. | It was verified responsive when previous free choices were rate limited. | Retain retry ordering and normalize obsolete locally persisted default values. |
| 2026-08-16 | Run E2B tools server-side with a command policy and short-lived sandbox. | Browser execution and uncontrolled commands are unsafe. | Maintain timeout, output caps, policy checks, and `finally` cleanup; formalize approvals before production expansion. |
| 2026-08-16 | Use Manus MySQL + S3 for local authenticated persistence. | Local preview needs real durable primitives without external deployment. | Settings, schedules, and Library metadata differ from production MongoDB/Cloudinary choices. |
| 2026-08-16 | Keep Vercel client, Render API, Render private harness, and Render worker independent. | Browser workload, tool work, and background scheduling scale and fail differently. | Preserve four deployment units and private networking in the external monorepo. |
| 2026-08-16 | Adopt test-driven delivery plus durable handoff documentation. | The product is large and will be continued by different agents/humans. | Every meaningful change needs a todo item, focused test, relevant docs update, and checkpoint. |
| 2026-08-16 | Gate live provider probes behind `RUN_LIVE_INTEGRATION_TESTS=1`. | OpenCode and E2B network availability is external and transient; it should not make ordinary local regression tests flaky. | Standard tests verify secret presence and deterministic behavior; release/integration checks explicitly opt into real provider requests. |
| 2026-08-16 | Keep interactive web-artifact sandboxes alive for a time-limited Canvas preview. | A sandbox created per shell command loses the files and server before the user can see it. | Write the self-contained artifact, run its HTTP server on `8080`, emit a typed `run.artifact` event with E2B's HTTPS host, and embed only validated HTTPS URLs in a sandboxed iframe. [4] |

## Decision template

```markdown
| YYYY-MM-DD | Short decision | Why this was selected | What future contributors must preserve or revisit |
```

If a decision is temporary, state its exit criterion in [`ROADMAP.md`](ROADMAP.md). If it changes external operations, also update [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`SECURITY.md`](SECURITY.md).

## References

[1]: [Local checkpoint history](HISTORY-AND-RESEARCH.md)
[2]: [Product scope](PRODUCT-AND-SCOPE.md)
[3]: [Architecture](ARCHITECTURE.md)
[4]: [E2B — Sandbox public URL](https://e2b.dev/docs/network/public-url)
