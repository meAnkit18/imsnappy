# Cloud-Agent Platform Research Notes

> This document records externally verified facts used to scope the I’m Snappy cloud-agent PRD. It is not implementation code.

## Hermes Agent as a Reference Harness

The intended repository appears to be [NousResearch/hermes-agent](https://github.com/nousresearch/hermes-agent), an MIT-licensed, open-source agent with an unusually broad harness surface. Its current repository includes explicit agent, gateway, provider, tool, skill, plugin, evaluation, cron, and web directories. Its README describes provider switching, persistent and curated memory, skill creation, session search, scheduled automations, delegated subagents, and multiple sandbox backends. These are valuable **reference patterns**, but the initial I’m Snappy implementation should selectively recreate independently designed capabilities rather than copy a large codebase wholesale.

The Hermes public overview also confirms the reference product’s focus on shared memory across channels, unattended schedules, isolated subagents, web/search/vision tools, and sandboxing. This makes it a strong source for feature decomposition and evaluation scenarios, not a dependency to be embedded in the current TypeScript application.

Sources: [Hermes Agent GitHub README](https://github.com/nousresearch/hermes-agent), [Hermes Agent overview](https://hermes-agent.nousresearch.com/).

## E2B Sandbox Constraints and Opportunities

E2B sandboxes can be created with a configurable timeout, inspected for metadata, and killed programmatically. The lifecycle documentation states that continuous runtime is limited by plan (up to 24 hours on Pro and 1 hour on Base); a production agent should therefore model sandbox liveness explicitly rather than assume a permanent process. For work that must survive pauses, use the provider’s pause/resume mechanism, task artifacts, database state, and a defined rehydration process.

E2B snapshots retain filesystem and memory state and can start new sandboxes from a captured state. They are appropriate for task checkpoints, risky-operation rollback, and safe parallel forks. Repeatable, declarative base environments should use templates rather than snapshots, because the provider documents templates as faster and more resource-efficient for repeatable environments.

E2B’s current SDK enables secure sandbox access by default for version 2.0.0 and later. The agent must preserve this setting and never expose sandbox IDs or access tokens to browsers. Browser clients will access artifacts and status only through the I’m Snappy API.

Sources: [E2B Sandbox lifecycle](https://e2b.dev/docs/sandbox), [E2B snapshots](https://e2b.dev/docs/sandbox/snapshots), [E2B secured access](https://e2b.dev/docs/sandbox/secured-access).

## Cloudinary Storage Architecture

Cloudinary’s Upload API supports images, videos, and raw files, and its backend SDKs perform authenticated upload operations. Cloudinary explicitly says API secrets must never appear in public client code. I’m Snappy should therefore upload through backend-issued signatures or server-side ingestion; API secrets belong only in server secrets. The user-facing Library should treat Cloudinary as an artifact store while MongoDB holds the ownership, task linkage, MIME type, provenance, retention policy, and access-control record for every asset.

Cloudinary also supports metadata, tags, searchable attributes, folders/collections, and transformations. That supports a Library implementation with task folders, type filters, generated-at timestamps, asset provenance, and image/video previews without putting browser-side credentials at risk.

Sources: [Cloudinary Upload API reference](https://cloudinary.com/documentation/image_upload_api_reference), [Cloudinary upload guide](https://cloudinary.com/documentation/upload_images), [Cloudinary Assets overview](https://cloudinary.com/documentation/digital_asset_management_overview).

## Vercel and Render Deployment Topology

Vercel supports deploying a chosen directory from a monorepo as its own project. For I’m Snappy, that maps to a single stateless frontend deployment from `apps/web`; it should receive only public configuration, including the API public origin, and it must never contain service credentials.

Render supports independently deploying multiple services from one monorepo, with a distinct root directory and build filters per service. That allows the API, agent harness, and orchestration worker to remain separate Render projects while redeploying only when code relevant to that service changes. The architecture should use a public API web service, a private harness service, and a background worker for orchestration. Render private services are unavailable to the public internet but communicate with other Render services on the private network. Background workers cannot receive inbound traffic, and are appropriate for queue-driven execution such as media processing and third-party AI work.

Sources: [Vercel monorepos](https://vercel.com/docs/monorepos), [Render monorepo support](https://render.com/docs/monorepo-support), [Render private services](https://render.com/docs/private-services), [Render background workers](https://render.com/docs/background-workers).

## MongoDB and Groq Integration Constraints

The MongoDB Node.js driver supports Atlas connections and offers connection options including TLS. I’m Snappy should construct a single process-level client using a server-only `MONGODB_URI`, use application-level user IDs on every ownership-bound record, and enforce indexes for conversation ordering, job lookup, and scheduled task selection.

Groq exposes OpenAI-compatible endpoints for transcription and translation. Its documented transcription endpoint is `https://api.groq.com/openai/v1/audio/transcriptions`, and it supports `whisper-large-v3-turbo` and `whisper-large-v3`. The service should submit audio through the backend or a signed Cloudinary asset URL, use `verbose_json` when timestamps are required, and enqueue or chunk files that exceed the documented provider limit.

Sources: [MongoDB Node.js connection guide](https://www.mongodb.com/docs/drivers/node/current/connect/), [Groq speech-to-text guide](https://console.groq.com/docs/speech-to-text).

## E2B and OpenCode Harness Integration

The current E2B JavaScript SDK exports `Sandbox` from the `e2b` package. A harness can create an isolated environment with `await Sandbox.create()` and execute a command with `sandbox.commands.run(...)`. The initial implementation should constrain this capability behind a permissioned service API, a server-side E2B credential, explicit command/run limits, task-scoped sandbox IDs in MongoDB, and guaranteed teardown in a `finally` block.

OpenCode Zen publishes a model list at `https://opencode.ai/zen/v1/models` and supports OpenAI-compatible chat completions at `https://opencode.ai/zen/v1/chat/completions`. The harness should call this endpoint only from the server, record the selected model per conversation message, and use the provider's available model IDs rather than hard-coding a free-tier name that may change.

Sources: [E2B command execution](https://e2b.dev/docs/commands), [OpenCode Zen](https://opencode.ai/docs/zen/).

## Vercel and Render Deployment Topology

Vercel supports deploying a chosen directory from a monorepo as its own project. For I’m Snappy, that maps cleanly to a single stateless frontend deployment from `apps/web`; it should receive only public configuration, including the API public origin, and it must never contain service credentials.

Render supports independently deploying multiple services from one monorepo, with a distinct root directory and build filters per service. That allows the API, agent harness, and orchestration worker to remain separate Render projects while redeploying only when code relevant to that service changes. The initial architecture should use a public API web service, a private harness service, and a private worker service. The internal services should communicate over Render’s private network and only the API should expose browser-facing endpoints.

Sources: [Vercel monorepos](https://vercel.com/docs/monorepos), [Render monorepo support](https://render.com/docs/monorepo-support), [Render private services](https://render.com/docs/private-services), [Render background workers](https://render.com/docs/background-workers).
