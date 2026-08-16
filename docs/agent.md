# I’m Snappy — Agent Handoff Guide

**Read this file before changing code.** It is the shortest reliable orientation for a human contributor or a future agent working on I’m Snappy.

## What this project is

I’m Snappy is an AI-agent workspace with an editorial **“Quiet Intelligence”** interface. Users can converse with an agent, inspect tool activity, work in a central Canvas, manage provider settings, store generated files in Library, and create scheduled tasks. The project has two deliberately different runtime targets:

| Target | Location | Purpose | Persistence and integrations |
| --- | --- | --- | --- |
| **Local full-stack preview** | This repository: `/home/ubuntu/agentelier` | Test the product in Manus before external deployment. | Manus OAuth, MySQL/Drizzle, S3 storage, OpenCode Zen, and E2B. |
| **Deployable cloud platform** | `/home/ubuntu/imsnappy-staging` and GitHub `meAnkit18/imsnappy` | Deploy the client to Vercel and three backend services to Render. | MongoDB Atlas, Cloudinary, Groq, OpenCode Zen, E2B. |

> Do not silently merge these targets. The local workspace is intentionally optimized for Manus preview primitives; the staging monorepo is intentionally decomposed for independent Vercel and Render deployment.

## Start here

Read the documents in this order before implementing a feature:

1. [`docs/README.md`](docs/README.md) for the documentation map and current status.
2. [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the two-runtime boundary and service topology.
3. [`docs/CODEBASE-MAP.md`](docs/CODEBASE-MAP.md) for the files that own each feature.
4. [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) before editing code; it defines the test-driven change loop.
5. The feature-specific document named by the documentation index.

## Current verified state

| Capability | Local Manus workspace | Deployable monorepo |
| --- | --- | --- |
| Streaming chat | Working through `POST /api/chat/stream` with OpenCode Zen. | Implemented as API-to-harness SSE design. |
| Sandbox tools | Working with short-lived E2B sandboxes, allowlist, limits, and cleanup. | Implemented in the private harness design. |
| Settings | MySQL-backed when signed in; local fallback when anonymous. | MongoDB-backed encrypted provider configuration design. |
| Library | S3 byte storage + MySQL metadata when signed in; local fallback when anonymous. | Cloudinary artifact flow. |
| Schedules | MySQL CRUD and UI; no local background executor. | MongoDB lease-based worker and retry design. |
| App Store | Static/UI-only catalog. | Future work; no live installation engine yet. |

The active local checkpoint is always available in the project version history; the deployable monorepo baseline is `aafec74` on `main`. See [`docs/HISTORY-AND-RESEARCH.md`](docs/HISTORY-AND-RESEARCH.md) for the concise change ledger and prior milestones.

## Repository-root convention

Keep the root intentionally small. Runtime entry points and tool-discovered configuration remain here: `package.json`, `pnpm-lock.yaml`, `vite.config.ts`, TypeScript/Vitest/Drizzle configuration, `.gitignore`, `agent.md`, and `todo.md`. Product code belongs in `client/`, `server/`, `shared/`, and `drizzle/`; patches remain in `patches/`; all plans, research, historical notes, and operating documentation belong under `docs/`. Do not add ad-hoc phase notes, research files, or idea lists to the root.

## First-session checklist

| Step | Required action | Why it matters |
| --- | --- | --- |
| 1 | Read `todo.md` and the relevant docs before scoping work. | Prevents duplicate or contradictory implementation. |
| 2 | Add every new request to `todo.md` as unchecked work **before** changing code. | Makes scope auditable and recoverable. |
| 3 | Identify the runtime target: local preview or deployable monorepo. | Their databases, storage providers, and service boundaries differ. |
| 4 | Write or update the smallest relevant Vitest test first. | Keeps new behavior defined before implementation drifts. |
| 5 | Run `pnpm run check` and `pnpm test`; use screenshots or manual flow tests where UI/streaming is involved. | Type correctness is not behavioral verification. |
| 6 | Mark completed work in `todo.md`, update the relevant docs and decision record, then save a checkpoint. | Leaves the next contributor an accurate restart point. |

## Non-negotiable guardrails

| Area | Rule |
| --- | --- |
| Secrets | Never put credentials in source, docs, tests, screenshots, logs, commits, or browser bundles. Use managed secrets only. Rotate any value that has appeared in a transcript or working tree. |
| Browser boundary | Do not expose database, Cloudinary, Groq, OpenCode, E2B, or service-to-service secrets to client code. |
| Sandbox tools | Keep execution short-lived, policy-checked, bounded, and traceable. Do not widen the command policy without a dedicated security review and tests. |
| Data changes | Update `drizzle/schema.ts`, generate and inspect migration SQL, apply migration safely, add helpers/procedures/UI, then test. |
| UI behavior | Preserve the pinned composer, internally scrolling chat, Canvas-centered layout, persistent sidebar, and Quiet Intelligence visual language unless the product decision changes. |
| Documentation | Update a document and, when appropriate, `docs/DECISIONS.md` whenever architecture, persistence, security, deployment, or product behavior changes. |

## Essential local commands

```bash
cd /home/ubuntu/agentelier
pnpm run dev       # Express + Vite dev server
pnpm run check     # TypeScript only
pnpm test          # Vitest suite
pnpm run build     # Production build smoke test
pnpm drizzle-kit generate  # Generate a migration after schema changes
```

For full operational instructions, use [`docs/LOCAL-DEVELOPMENT-AND-TESTING.md`](docs/LOCAL-DEVELOPMENT-AND-TESTING.md). For external deployment, use [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and then the authoritative staging-monorepo runbook at `../imsnappy-staging/README.md`.

## Keep this file current

This file is a **navigation document**, not a design dump. Keep it short. Put detail in `docs/`; add a dated entry to `docs/DECISIONS.md` for lasting choices; add a checkbox to `todo.md` for active work.

## References

[1]: [Documentation index](docs/README.md)
[2]: [Current local task history](todo.md)
[3]: [Deployable monorepo runbook](../imsnappy-staging/README.md)
