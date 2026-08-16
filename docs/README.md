# I’m Snappy Documentation

**Audience:** Product owners, engineers, operators, and future agents.  
**Maintenance rule:** Update the relevant document in the same change that alters behavior, architecture, security posture, or delivery status.

## Documentation map

| Document | Read it when you need to… | Source of truth |
| --- | --- | --- |
| [`PRODUCT-AND-SCOPE.md`](PRODUCT-AND-SCOPE.md) | Understand what I’m Snappy is meant to do, its UX principles, and first-release boundaries. | Product intent and current interface behavior. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Decide which runtime to change or trace a request across the system. | Local preview versus external cloud platform boundary. |
| [`CODEBASE-MAP.md`](CODEBASE-MAP.md) | Locate the files that own a page, API route, database table, service, or test. | Repository navigation. |
| [`DATA-AND-CONTRACTS.md`](DATA-AND-CONTRACTS.md) | Change MySQL tables, tRPC endpoints, SSE events, uploads, or the deployed service contract. | Local schema and API/event surfaces. |
| [`LOCAL-DEVELOPMENT-AND-TESTING.md`](LOCAL-DEVELOPMENT-AND-TESTING.md) | Run, debug, and verify the Manus preview. | Exact local commands and verified smoke flows. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Implement a new feature safely. | Test-driven contribution process and definition of done. |
| [`SECURITY.md`](SECURITY.md) | Handle credentials, user data, tools, storage, logs, or production configuration. | Mandatory security guardrails. |
| [`DEPLOYMENT.md`](DEPLOYMENT.md) | Prepare Vercel and Render deployment. | Staging monorepo handoff and deployment order. |
| [`DECISIONS.md`](DECISIONS.md) | Learn why key technical and product decisions were made. | Living decision record. |
| [`ROADMAP.md`](ROADMAP.md) | Plan the next implementation increment without mistaking prototypes for production features. | Honest gap analysis and sequencing. |
| [`HISTORY-AND-RESEARCH.md`](HISTORY-AND-RESEARCH.md) | Find prior checkpoints, research artifacts, and historical notes. | Curated change ledger and research index. |

## Documentation collections

| Folder | Contents | Maintenance rule |
| --- | --- | --- |
| [`history/`](history/) | Redacted phase notes and historical implementation observations. | Preserve context; do not treat it as current requirements. |
| [`research/`](research/) | Provider, UI, and sidebar research that informed decisions. | Prefer current architecture and decision records when there is a conflict. |
| [`planning/`](planning/) | Captured ideas and exploratory backlog material. | Promote approved work into `todo.md`, `ROADMAP.md`, and relevant tests. |

## Fast orientation

The project has a **local full-stack workspace** at `/home/ubuntu/agentelier` and a **separate deployable monorepo** at `/home/ubuntu/imsnappy-staging`. The first uses Manus platform services for in-environment testing; the second is organized for a Vercel frontend plus independent Render API, harness, and worker services. The two are aligned by product intent, but their persistence and asset providers intentionally differ.

> Treat the local workspace as the testing environment and the staging monorepo as the external-deployment implementation. A change is not “deployed” merely because it works in the local preview.

## Documentation conventions

| Convention | Meaning |
| --- | --- |
| **Current** | Implemented and verified in the named target. |
| **Planned** | Designed or scaffolded but not yet proven in a user-visible target. |
| **Placeholder** | UI or contract shape exists; the underlying capability is not live. |
| **Source of truth** | The file or repository that should be edited when a statement changes. |

Use explicit target labels—**Local preview** or **Deployable monorepo**—throughout conversation, code review, and documentation. This avoids the most damaging class of confusion in this project: assuming a local provider integration is automatically the production integration.

## Maintenance checklist

When making a meaningful change, update the set of files that applies. Keep the repository root free of project notes; put historical evidence, research, and ideas in the collections above.

| Change type | Required documentation update |
| --- | --- |
| New route, procedure, event, or table | `DATA-AND-CONTRACTS.md` and `CODEBASE-MAP.md` |
| New external service or secret | `SECURITY.md`, `DEPLOYMENT.md`, and the relevant `.env.example`—names only |
| Product behavior or UI workflow | `PRODUCT-AND-SCOPE.md` and `ROADMAP.md` |
| Architectural boundary or durable trade-off | `ARCHITECTURE.md` and `DECISIONS.md` |
| Test command or verification requirement | `LOCAL-DEVELOPMENT-AND-TESTING.md` and `CONTRIBUTING.md` |
| Delivered milestone | `HISTORY-AND-RESEARCH.md` and `todo.md` |

## References

[1]: [Root agent handoff guide](../agent.md)
[2]: [Local project task history](../todo.md)
[3]: [Deployable monorepo runbook](../../imsnappy-staging/README.md)
