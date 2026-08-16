# Roadmap and Known Gaps

## How to use this roadmap

This is a planning aid, not a promise. It distinguishes what is verified in the local Manus preview from what is designed for deployment and what remains unimplemented. Reprioritize by product value and risk, but preserve the dependency order where security or durability depends on it.

## Current status

| Area | Local preview state | Deployable monorepo state | Remaining gap |
| --- | --- | --- | --- |
| Workspace UX | Polished, responsive, fixed composer, Canvas and shared sidebar. | Client present. | Accessibility audit, keyboard shortcuts, and full mobile interaction pass. |
| Agent streaming | Real OpenCode stream and display of safe trace events. | API/harness service design implemented. | Reconnect/resume, robust run persistence, cancellation, provider observability. |
| Sandbox tools | Live E2B execution with policy and cleanup. | Private harness boundary. | Approval workflow, narrower policy, artifact export, adversarial tests. |
| Conversations | Local browser persistence. | Durable contract architecture. | Owner-scoped durable conversation/message/run model in the local workspace and final production client integration. |
| Settings | MySQL preferences for signed-in local users. | Encrypted provider config architecture. | Production secret vault, provider validation, rotation and deletion UX. |
| Library | Local S3/MySQL flow and local fallback. | Cloudinary/Groq design. | Streaming/signed uploads, type validation, provenance, transcription, final provider alignment. |
| Schedules | Local MySQL CRUD only. | Worker/lease/retry architecture. | Run execution, history, notifications, timezone and cron validation. |
| App Store | Static catalogue and toggles. | Future-compatible service layout. | Installation lifecycle, connector permission model, MCP execution boundary, audit log. |

## Recommended implementation sequence

| Milestone | Deliverable | Why it comes next | Definition of done |
| --- | --- | --- | --- |
| 1. Harden local agent policy | Explicit tool categories, approvals, cancellation, adversarial tests. | Tool execution is the highest-risk live capability. | Unit tests cover blocked/elevated/timeout/cleanup paths; UI exposes safe status. |
| 2. Durable runs and conversations | Owner-scoped MySQL schema and stream replay model for local workspace. | Makes work survivable across devices/reloads. | Run/message persistence plus reconnect and ownership tests. |
| 3. Complete scheduling semantics | Interval/cron validation, worker handoff, execution records. | Schedule UI should lead to real work, not only CRUD. | Deterministic time-based tests and deployed worker smoke test. |
| 4. Finalize production asset flow | Cloudinary signed upload, metadata, deletion and Groq transcription. | Library needs a coherent production lifecycle. | MIME/ownership/security tests and deployed file smoke flow. |
| 5. Secure provider management | Encrypt at rest, validate, rotate/delete config, audit. | Settings key fields must not be misrepresented as production vaults. | No secret returned through API; redaction and ownership tests. |
| 6. Connector/App Store model | Installation records, scopes, approval prompts, MCP policy. | Installs expand the trust boundary. | Permissioned lifecycle, audit trail, non-destructive integration tests. |
| 7. Production readiness | Observability, rate limits, backup/recovery, operational runbook. | Required before external user launch. | Load/error drills, incident runbook, and staged release evidence. |

## Known technical caveats

| Caveat | Current mitigation | Follow-up |
| --- | --- | --- |
| Free model endpoints can rate-limit. | 429-only fallback fleet in local agent. | Per-provider quotas, user messaging, and backoff telemetry. |
| Browser localStorage holds anonymous data and chat history. | It enables preview without sign-in. | Move valuable state to owner-scoped durable records and give users export/delete controls. |
| Local Library base64 uploads are convenient but not scalable. | Payload is processed server-side; small-file use only. | Signed/multipart upload with limits and resumability. |
| Local scheduled tasks do not execute automatically. | UI accurately holds and displays task data. | Wire to deployed worker and persist executions. |
| App Store is presentation-only. | Avoids falsely implying connector execution. | Design secure install/approval model first. |

## References

[1]: [Product scope](PRODUCT-AND-SCOPE.md)
[2]: [Security guidance](SECURITY.md)
[3]: [Deployable PRD milestones](../../imsnappy-staging/docs/cloud-agent-platform-prd.md)
