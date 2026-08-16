# Security and Secret Handling

## Security posture

I’m Snappy invokes model providers, file storage, and code sandboxes. That makes the separation between browser, server, and private services a core product feature—not deployment polish.

> Credentials, database access, storage signing, model calls, and sandbox execution belong on server-side boundaries. A browser may receive safe status and output only.

## Mandatory rules

| Area | Required rule |
| --- | --- |
| Credentials | Use the managed project secret mechanism or encrypted host environment variables. Never hardcode, paste, or log values. |
| Documentation | Store variable **names** and setup instructions only. If any real value reaches a chat, log, document, test, or working tree, rotate it before deployment. |
| Browser | Never add provider keys, E2B keys, database URIs, storage secrets, Cloudinary secrets, Groq keys, or service tokens to `VITE_*` variables or client code. |
| Ownership | Every durable record query or mutation must filter by current user identity, even when a public ID is supplied. |
| Uploads | Validate name, MIME type, byte size, and owner intent; persist metadata separately from bytes. |
| Logging | Use request IDs and redacted, user-safe errors. Never record raw provider headers, sandbox IDs, or encrypted configuration. |
| Sandboxes | Use short-lived isolated instances, fixed timeout, output caps, command policy, and mandatory `finally` cleanup. |

## Current local-preview caveats

| Caveat | Why it matters | Required direction |
| --- | --- | --- |
| Provider API-key controls in Settings are browser-local UI fields. | They are not a server-side encrypted provider vault. | Do not treat them as production key management; use the deployable API design for production. |
| The local agent command allowlist contains some file and package commands in addition to read-only commands. | An allowlist is not automatically safe merely because it exists. | Narrow it for production, require approvals for elevated work, and add negative tests for every policy expansion. |
| Local Library upload accepts base64 content. | Base64 increases payload size and is unsuitable for unbounded files. | Enforce limits now; adopt signed or streaming uploads for production. |
| Historical development notes were redacted in the current workspace. | Earlier checkpoint history may still contain temporary values. | Rotate all previously exposed development credentials before sharing or deploying. |

## Deployment secret inventory

| Target | Secret categories | Where they belong |
| --- | --- | --- |
| Local preview | OpenCode and E2B integration secrets; managed database/storage credentials. | Managed project settings; never source. |
| Vercel client | Public API base URL only. | `VITE_API_BASE_URL`; no secret values. |
| Render API | JWTs, config encryption key, MongoDB URI, Cloudinary, Groq, internal service token. | Render encrypted environment settings. |
| Render harness | OpenCode, E2B, internal service token. | Render encrypted environment settings. |
| Render worker | MongoDB URI, internal service token, private harness URL. | Render encrypted environment settings. |

## Incident response

If a credential appears in a file, commit, screenshot, terminal output, document, or conversation:

1. Stop using the exposed credential and rotate it at the issuing provider.
2. Remove it from the active working tree and avoid repeating it in remediation messages.
3. Check deployment settings, logs, test fixtures, and documentation for reuse.
4. Treat Git history as potentially exposed; use provider rotation rather than assuming a later redaction is sufficient.
5. Record the remediation without the secret value.

## References

[1]: [Local agent sandbox policy](../server/agent.ts)
[2]: [Deployable service trust boundaries](../../imsnappy-staging/docs/service-contracts.md)
[3]: [Deployable security controls](../../imsnappy-staging/docs/cloud-agent-platform-prd.md)
