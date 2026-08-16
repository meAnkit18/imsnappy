# I’m Snappy server services

Each directory in this folder is a **separate Render project**. Do not combine them into one service; their different public-network and runtime roles are deliberate.

| Folder | Render project type | Public? | Start command | Connects to |
| --- | --- | --- | --- | --- |
| [`api/`](./api) | Web service | Yes | `pnpm --filter @imsnappy/api start` | Vercel client, MongoDB Atlas, Cloudinary, Groq, private harness |
| [`harness/`](./harness) | Private service | No | `pnpm --filter @imsnappy/harness start` | API/worker through Render private network, OpenCode Zen, E2B |
| [`orchestrator/`](./orchestrator) | Background worker | No | `pnpm --filter @imsnappy/orchestrator start` | MongoDB Atlas and private harness |

The browser client is intentionally separate in [`../client/`](../client) and is deployed as its own Vercel project. The shared payload types live in [`../packages/contracts/`](../packages/contracts); every deploy compiles this small workspace dependency before starting its own service.

## Deployment boundary

```text
Vercel project (client/)
          |
          | HTTPS + authenticated browser session
          v
Render web project (services/api/)
          |
          | Render private network + INTERNAL_SERVICE_TOKEN
          v
Render private project (services/harness/) <--- Render worker project (services/orchestrator/)
          |                                      |
          +------------ E2B / OpenCode ----------+---- MongoDB schedules
```

Use the root [`README.md`](../README.md) for the exact environment-variable handoff and smoke-test order. The root [`render.yaml`](../render.yaml) can create all three Render projects together, but each row above remains deployable and scalable independently.
