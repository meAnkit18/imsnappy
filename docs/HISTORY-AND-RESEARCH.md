# History and Research Index

## Purpose

This is the curated record of how I’m Snappy reached its present state. It is intentionally shorter than raw work notes, so a new contributor can understand the evolution without treating historical experiments as current requirements.

## Checkpoint ledger

| Checkpoint / commit | What changed | Why it matters now |
| --- | --- | --- |
| `6fdf46e` | Added signed-in MySQL persistence for Settings, Scheduled, and Library metadata plus S3-backed Library byte uploads. | Current local workspace baseline. |
| `2d9efae` | Removed the Proposed Direction/suggestion UI; adopted healthy default model and retry fleet; verified browser streaming and E2B tool path. | Defines clean thread behavior and live agent verification. |
| `432b298` | Hardened streaming fallback and documented independent deployment services. | Explains local stream resilience and external service split. |
| `36f5212` | Repaired OpenCode streaming lifecycle; validated Library/Settings/Scheduled local workflows; refined responsive layout. | Important UI and reliability baseline. |
| `7c188fa` | Added pinned composer, local persistence, functional Discover pages. | Establishes the user-facing workspace model. |
| `142fee4` | Created deployable cloud-agent handoff, service contracts, Render/Vercel layout, and runbook. | Root of the external deployment architecture. |
| `aafec74` in `imsnappy-staging` | Clarified independently deployable service layout on GitHub `main`. | Latest known monorepo organization state. |

## Product evolution summary

The project began with a front-end goal inspired by Claude, Manus, ChatGPT, and Gemini. The visual direction became a bespoke ElevenLabs-inspired editorial workspace. The sidebar was repeatedly refined to eliminate expansion jitter and became shared across all routes. Canvas evolved into a central work surface with optional contextual chat rather than a permanent right sidebar. The composer was intentionally fixed so the product behaves like a working environment rather than a long scrolling webpage.

The implementation then progressed from a browser-safe local preview loop to server-routed OpenCode streaming and E2B sandbox execution. Settings, Library, and Scheduled screens first used local persistence, then gained signed-in MySQL/S3 backing in the Manus workspace. In parallel, a separate monorepo was created for eventual Vercel and Render deployment with API, harness, and worker boundaries.

## Research and raw-note index

| File | What it contains | How to use it |
| --- | --- | --- |
| [`research/agent-platform-research.md`](research/agent-platform-research.md) | Early platform/provider research. | Historical context; superseded by staging PRD and current docs where conflicts exist. |
| [`research/ui-implementation-research.md`](research/ui-implementation-research.md) | UI/implementation research notes. | Design background; not a runtime source of truth. |
| [`research/sidebar-redesign-research.md`](research/sidebar-redesign-research.md) | Sidebar redesign rationale. | Preserve the no-jitter motion constraints. |
| [`research/sidebar-motion-research.md`](research/sidebar-motion-research.md) | Technical notes about sidebar motion fixes. | Consult before modifying sidebar layout/transitions. |
| [`history/phase9-notes.md`](history/phase9-notes.md) | Raw notes from local-preview implementation. | Historical troubleshooting only. |
| [`history/phase11-notes.md`](history/phase11-notes.md) | Redacted phase notes for full-stack integration and Round 14. | Historical verification context; current docs supersede it. |
| [`planning/ideas.md`](planning/ideas.md) | Captured product and implementation ideas. | Promote approved work into `todo.md` and the roadmap before implementation. |
| `../../imsnappy-staging/docs/cloud-agent-platform-prd.md` | External platform PRD. | Authoritative product/deployment baseline for the monorepo. |
| `../../imsnappy-staging/docs/service-contracts.md` | External service and SSE contract. | Authoritative contract source for the monorepo. |

## Lessons retained for future contributors

| Lesson | Practical consequence |
| --- | --- |
| Register custom API routes before Vite middleware. | Otherwise Vite can intercept POST/API requests and obscure the real handler. |
| Validate live behavior independently of HTTP 200. | A successful SSE response can still contain a fallback/error path; inspect terminal events and rendered output. |
| Free model availability is variable. | Retain fallback and rate-limit handling; never assume one free model is always healthy. |
| UI state must not drive server truth. | Use local state for responsive UI, but reconcile persistent Settings/Scheduled/Library values through typed server paths when signed in. |
| Documentation must never preserve credentials. | Keep names and process, redact values, and rotate any exposed temporary credentials. |

## References

[1]: [Local Git checkpoint history](../todo.md)
[2]: [Local agent handoff](../agent.md)
[3]: [Deployable monorepo runbook](../../imsnappy-staging/README.md)
