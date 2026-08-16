# Deployment Handoff

## Deployment is intentionally external to the Manus preview

The local workspace is the correct place to validate behavior before release. The external deployment lives in the separate `imsnappy-staging` monorepo and should be deployed as four independent projects:

| Project | Repository root directory | Host | Public? |
| --- | --- | --- | --- |
| Client | `client/` | Vercel | Yes |
| API | `services/api/` | Render Web Service | Yes |
| Harness | `services/harness/` | Render Private Service | No |
| Orchestrator | `services/orchestrator/` | Render Background Worker | No inbound traffic |

## Pre-deployment gate

Before any host configuration, ensure all items below are complete.

| Gate | Evidence |
| --- | --- |
| Secrets have been freshly rotated. | Provider consoles and host environment settings—not source files. |
| Monorepo validation passes. | `pnpm install --frozen-lockfile`, `pnpm verify`, and `pnpm build` in `imsnappy-staging`. |
| Service topology is intact. | API is public; harness remains private; worker has no public endpoint. |
| Environment names match `.env.example` and `render.yaml`. | No credential values in Git or manifests. |
| CORS is exact. | Vercel client URL set as API `CLIENT_ORIGIN`; client uses public API base URL. |
| Production smoke plan exists. | Dedicated non-production account and harmless tool test ready. |

## Deployment order

1. Create fresh provider and database credentials; record only variable names in local planning notes.
2. Provision MongoDB Atlas access for API and worker.
3. Deploy the Render Blueprint from `imsnappy-staging/render.yaml` in one region.
4. Copy the harness’s Render internal address into `HARNESS_BASE_URL` for API and worker; keep the service private.
5. Configure API, harness, and worker environment variables in Render. Use identical internal service token values where the runbook requires them.
6. Create a Vercel project rooted at `client/`; set the public API base URL.
7. Set the exact Vercel URL as API `CLIENT_ORIGIN`, then redeploy API.
8. Run health and functional smoke checks using a dedicated non-production account.

## Production smoke path

The healthy path is: create account, save provider configuration, create conversation, receive SSE deltas, upload a small file, create a future schedule, and observe scheduled-run persistence. Trace a single request ID across API, harness, and worker logs when diagnosing a failure.

| Signal | Healthy expectation | First check |
| --- | --- | --- |
| API health | HTTP 200 from `/health`. | API env validation and MongoDB network access. |
| Stream | Started event, deltas, terminal event. | Private `HARNESS_BASE_URL` and matching internal token. |
| Tool work | Approval or E2B lifecycle trace. | Harness secret configuration and command policy. |
| Library | Asset URL plus owner-scoped metadata row. | Cloudinary config and API logs. |
| Schedule | Worker claim and persisted run. | Worker running, MongoDB connectivity, next-run timestamp. |

## Do not deploy until these gaps are resolved

The staging monorepo defines production boundaries, but the release owner must validate its provider credentials, external service connectivity, and production smoke path with fresh keys. The local MySQL/S3 preview cannot be substituted for this external operational validation.

## References

[1]: [Deployable monorepo runbook](../../imsnappy-staging/README.md)
[2]: [Render Blueprint](../../imsnappy-staging/render.yaml)
[3]: [Deployment references](../../imsnappy-staging/docs/deployment-references.md)
