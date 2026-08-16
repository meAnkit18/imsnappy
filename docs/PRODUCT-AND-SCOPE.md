# Product and Scope

## Product intent

I’m Snappy is a calm, capable workspace for directing AI-assisted work. Its core interaction is a real-time chat that can explain its work, invoke constrained tools when appropriate, and turn outputs into reusable files. The workspace also provides a Library, model and profile Settings, a future-facing App Store, and Scheduled tasks.

> **Design principle:** “Quiet Intelligence.” The interface should feel editorial and deliberate rather than noisy or dashboard-heavy: off-white surfaces, warm ink, restrained contrast, Cormorant Garamond for display moments, and Inter for utility text.

## Experience principles that must be preserved

| Principle | Implementation consequence |
| --- | --- |
| Conversation stays available | The prompt composer remains pinned; the message thread scrolls internally rather than moving the input out of view. |
| Canvas is central work | With Canvas on, Canvas remains in the center. The conversation and agent trace may appear in an expandable right panel; the composer stays anchored. |
| Navigation is stable | The shared left sidebar must keep the same behavior and visual state across the home workspace and all Discover pages. |
| Work remains legible | Tool calls, sandbox status, and streamed progress are surfaced as trace information without exposing private provider or sandbox data. |
| Small details feel composed | Sidebar expansion uses transform/opacity-based transitions to avoid layout jitter. Avoid decorative clutter or redundant “direction” cards and suggestion chips in the chat footer. |

## Current page inventory

| Route | Page | Current behavior | Status |
| --- | --- | --- | --- |
| `/` | Workspace | Chat, streaming responses, tool trace, Canvas toggle, local conversation persistence. | **Current** |
| `/store` | App Store | Searchable catalogue of skills, MCPs, and connectors with UI install toggles. | **Placeholder:** no backend installation or connector execution. |
| `/library` | Library | Upload, browse, filter, download, and delete assets. Signed-in users use S3 + MySQL; anonymous users use local storage. | **Current local preview** |
| `/settings` | Settings | Provider/model controls, profile/workspace fields, preferences, and local key-entry controls. | **Partially durable:** selected preferences persist for signed-in users; provider keys are not yet a production secret-vault feature. |
| `/scheduled` | Scheduled | Create, pause, resume, and delete tasks with next-run display. | **Current CRUD; execution requires deployed worker** |

## Scope boundary

The implemented local preview proves the most important interactive loop: streamed model response plus bounded E2B sandbox action. The deployable monorepo defines the external service architecture for durable accounts, encrypted provider settings, private harness execution, media operations, and a background scheduler.

The first release should **not** claim unrestricted autonomous action, unbounded shell access, production billing, live arbitrary connector installation, or durable background schedule execution in the local preview. Those features require the private harness, approval policy, worker, persistence, and operational controls described in the deployment documentation.

## Feature-state matrix

| Capability | Local preview | Deployable monorepo | Next product requirement |
| --- | --- | --- | --- |
| Chat transcripts | Browser local storage; active live stream. | Durable conversation architecture specified/implemented in service layer. | Connect client to production API and reconcile histories. |
| Model selection | OpenCode free fleet; server default `hy3-free`; 429 fallback fleet. | Provider configuration and encrypted storage design. | Add provider validation and secure lifecycle. |
| Tool execution | E2B, command policy, 45-second runtime cap, bounded output. | Private harness boundary and approval-event design. | Narrow policy, formalize approval gates, add contract tests. |
| Files | S3 storage route plus MySQL metadata for signed-in users. | Cloudinary-backed signed asset design. | Align final storage provider and asset provenance. |
| Scheduling | Data CRUD only; no local executor. | Lease-based worker and retry design. | Deploy worker, add run history and notification flow. |
| App Store | Static UI catalogue. | Shared contracts can support future connectors. | Define connector review/install/remove lifecycle. |

## Product vocabulary

| Term | Meaning |
| --- | --- |
| **Run** | One agent execution initiated by a message or scheduled task. |
| **Trace** | Safe, user-visible progress events from a run. |
| **Canvas** | Central structured workspace associated with the conversation. |
| **Library asset** | A generated or uploaded file whose bytes and metadata are managed separately. |
| **Schedule** | A user-defined future instruction and cadence; its actual execution belongs to the deployed worker. |
| **Harness** | The private service that owns model calls and sandbox operations in the external architecture. |

## References

[1]: [Local route map](../client/src/App.tsx)
[2]: [Local agent runtime](../server/agent.ts)
[3]: [Deployable platform PRD](../../imsnappy-staging/docs/cloud-agent-platform-prd.md)
