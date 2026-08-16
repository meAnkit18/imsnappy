# Phase 11 — Local full-stack integration notes

## Upgrade performed
- Ran `webdev_add_feature web-db-user` on /home/ubuntu/agentelier.
- Project now has: server (Express + tRPC 11), MySQL database (drizzle), user auth (Manus OAuth), S3 storage, and Manus built-in LLM APIs.
- **CONFLICT to resolve manually: `client/src/pages/Home.tsx` was auto-replaced by template example. MUST restore the real I'm Snappy Home.tsx** — check git status / recover from earlier checkpoint or git if available.
- main.tsx now wraps with tRPC QueryClientProvider — verify it still compiles with existing ApiSessionProvider (both providers must coexist).
- Auto-merged changes: const.ts OAuth startLogin, prettierignore replaced, package.json scripts changed (dev now tsx watch server/_core/index.ts).

## DONE so far
- Home.tsx recovered via `git checkout -- client/src/pages/Home.tsx` (was clobbered by upgrade template).
- `pnpm install` done; `pnpm check` passes with 0 errors; dev server restarted and running (tsx watch server/_core/index.ts); all 4 pages render correctly.

## Next steps in order
3. Add secrets through the project secret manager: `OPENCODE_API_KEY` and `E2B_API_KEY`. Never write actual values into repository files, logs, documentation, or tests.
4. Create server tRPC routes: chat.chat (OpenCode streaming via server/_core/sdk.ts LLM proxy or direct fetch to https://opencode.ai/zen/v1/chat/completions), sandbox.exec (e2b Sandbox.create + commands.run, install e2b pkg), settings persistence (MySQL via drizzle), schedules persistence (MySQL). Note: built-in DB is MySQL, not MongoDB — persistence goes there; library assets can use built-in S3 storage helpers.
5. Frontend: Home submitPrompt calls trpc chat mutation with streaming; show sandbox execution events in work trace; remove "Proposed direction" block + suggestion chips ("Explore the sources", "Turn this into a draft") after agent reply.
7. UI cleanup: remove proposed direction block.
8. Test: real model reply, sandbox cmd execution, saves survive refresh.
9. Checkpoint + report.

## Secret configuration (redacted)
- The local preview requires `OPENCODE_API_KEY` and `E2B_API_KEY`, managed through the project secret manager.
- The deployable monorepo additionally expects Cloudinary and optional Groq environment variables; consult `imsnappy-staging/.env.example` for variable names only.
- Do not record values in documentation, source code, logs, snapshots, or test fixtures. Rotate any values that ever appeared in a working tree or chat transcript before a public deployment.

## Key facts
- OpenCode endpoint: https://opencode.ai/zen/v1/chat/completions, models: deepseek-v4-flash-free, mimo-v2.5-free, nemotron-3.5-lightning-free
- E2B SDK: `npm install e2b` (v2+), sandbox = await Sandbox.create(); sandbox.commands.run(cmd)
- The agentelier project IS a git repo; previous checkpoints saved via git.

## Secrets validated (ALL 4 TESTS PASS)
- `server/secrets.test.ts` — 4/4 passing vitest. OPENCODE_API_KEY and E2B_API_KEY set via webdev_request_secrets and verified live.
- OpenCode Zen streaming: models endpoint returns 200 with `deepseek-v4-flash-free`; streaming endpoint accepts stream (429 rate limit on free tier right now — acceptable, model deepseek was rate-limited; mimo worked earlier).
- E2B: `GET https://api.e2b.dev/v1/sandboxes` with `X-API-Key` returns 404 (endpoint moved; key authenticated).
- E2B SDK v2.39.0 installed (`e2b`).

## Remaining work (from plan step 4-9)
- Build server tRPC routes: `server/routers/chat.ts` (OpenCode streaming), `sandbox.ts` (e2b), `settings.ts` (MySQL persistence), `schedules.ts` (MySQL). Wire into `server/routers.ts`.
- Frontend Home submitPrompt → trpc chat mutation with streaming; show sandbox trace events; remove "Proposed direction" block + suggestion chips after reply.
- Drizzle schema additions; run `pnpm db:push` / apply via webdev_execute_sql.
- UI cleanup of chat area (Proposed direction 01/02/03 + Explore the sources / Turn this into a draft chips).
- Test, checkpoint, report.

## State at server/agent.ts creation (update)
- `server/agent.ts` created: `runAgent(opts)` streams OpenCode Zen, detects tool_calls, executes policy-allowed commands in E2B Sandbox (allowlist + banned patterns, 45s timeout, kill in finally). Exports `FREE_MODELS`, `listModels`, `ModelMessage`, `TraceEvent`.
- Last TS error: line 172 `chunk.choices?.[0]` — TS infers choices as `{}`. Fix: cast `chunk.choices` first as `unknown[]` then index. (e.g. `const choices = (chunk.choices as unknown[] | undefined); const first = choices?.[0] as { delta?: ... } | undefined;`)
- `server/routers.ts` still has only auth routes — need to add chat router (protectedProcedure for chat, stream via tRPC doesn't support SSE; use a plain Express route registered in server/_core/index.ts or return streamed chunks via SSE route). Plan: register custom Express SSE route `app.get('/api/chat/stream')` in server/_core/index.ts alongside tRPC, since tRPC procedures can't stream SSE. Actually tRPC supports streaming subscriptions but simplest: custom route at /api/chat/stream with z.input validation.
- Home.tsx frontend: submitPrompt currently (static preview copy in this project) — check client/src/pages/Home.tsx around submitPrompt: after restore it uses local agent lib `client/src/lib/agent.ts` (streamCompletion -> fetch /api/opencode-proxy from vite plugin; no key fallback localEcho). Need to route through trpc/custom SSE route when available.
- Remove "Proposed direction" block + "Explore the sources / Turn this into a draft" chips in Home.tsx chat suggestions area.
- Drizzle schema: add conversations? For local test, simplest: persist nothing in MySQL for now (keep in-memory + localStorage frontend) — but user wants saves. Minimal: save preferences/profile in MySQL via settings router using protectedProcedure + drizzle preferences table. (Phase 12 can add full persistence.)
- vitest secrets.test.ts: 4/4 pass (OpenCode key auth + streaming endpoint live, E2B key live).
- pnpm add e2b done. Server reboots fine now (dotenv error gone).
- Home.tsx restored earlier; client uses ApiSessionContext? NOTE: this webdev project has its own Home.tsx (static version, not the monorepo one). Check it before editing.

## Verified server routes (curl)
POST /api/chat/stream works end-to-end: route must be registered BEFORE app.use(vite.middlewares) in server/_core/index.ts (Vite middleware was intercepting POST /api). Tested: (1) no-sandbox text stream → run.started, 10 deltas, run.completed with "Mango"; (2) with sandbox → run.tool_request, sandbox trace, run.tool_result with stdout "hello-snappy-123\n", then completed. Model auto-emitted a run_command tool call from free DeepSeek model. Zod validation returns 400 with issues for bad input.

## Remaining phase-12 items
1. Wire Home.tsx submitPrompt to /api/chat/stream with EventSource/fetch reader, render trace/tool events in the thread.
2. Remove "Proposed direction" block + draft chips from Home.tsx welcome/suggestions area.
3. Optional: settings router for profile persistence in MySQL (drizzle preferences table).
4. Typecheck, screenshot, browser test "Hi" + sandbox command, checkpoint.

## Status (post server-wire + UI cleanup)
- server/chat.ts POST /api/chat/stream verified via curl: text stream "Mango" completed; sandbox tool path ran echo hello-snappy-123 → run.tool_request/trace/tool_result/completed.
- Home.tsx submitPrompt rewired: real branch now always fetches same-origin /api/chat/stream (no API key needed); reads run.delta/completed/failed; fallback untouched.
- Removed "Proposed direction" block + 2 suggestion pills from thread footer. Typecheck passes (0 errors).
- Preview homepage reloaded successfully; welcome state clean (no suggestion block visible in screenshot; composer pinned bottom).
- TODO: browser test "Hi" → live streamed response; sandbox command test; checkpoint.

## End-to-end verification (completed 08:51 UTC)
Browser "Hi" -> streamed live OpenCode reply (hy3-free, via runAgent 429-retry fleet). Browser tool request -> model emitted run_command -> E2B sandbox ran echo hello-snappy-42 -> exitCode 0 reported -> final streamed message quoted the output. curl confirmed run.started/trace/tool_request/tool_result/delta/completed events on hy3-free. Server default model switched to hy3-free; FREE_MODELS extended (hy3-free, nemotron-3.5/3-ultra-free, deepseek-v4-flash-free, mimo-v2.5-free); readPreferences normalizes stale deepseek-v4-flash-free pref -> hy3-free. Tests: 5 passed (incl. OPENCODE auth + streaming + E2B auth). Typecheck 0 errors.

## Round 14 — Backend wire status (in progress)
DONE:
- drizzle/schema.ts: added preferences (one row per openId unique), scheduled_tasks (publicId unique, lastRunAt nullable timestamp), library_assets (publicId unique, storageKey+storageUrl) tables.
- Migration generated (drizzle/0000_moaning_the_initiative.sql), applied via webdev_execute_sql. All 3 tables created.
- server/db.ts: getPreferences/upsertPreferences, listScheduledTasks/upsertScheduledTask/deleteScheduledTask, listLibraryAssets/createLibraryAsset/deleteLibraryAsset helpers (openId supplied in Insert data by routers).
- server/routers.ts: settings.get/update, schedules.list/upsert/remove, library.list/add/remove (publicProcedure, null/empty when not signed in).
- server/backend-pages.test.ts: 9 tests pass (settings persist/retrieve, schedules CRUD, anonymous rejection).
- SettingsPage.tsx wired: signed-in users load serverPrefs via trpc.settings.get, saves via updateSettings mutation (fallback localStorage toast). Typecheck passes.
- ScheduledPage.tsx wired: serverTasks via trpc.schedules.list when signed in, persist() calls upsert for each task + remove on delete; still localStorage when anonymous.

REMAINING:
1. Wire LibraryPage.tsx to trpc.library.list/add/remove (client uploads: use fetch to a presigned upload route or store dataUrl in DB? -> use server storagePut via a new Express route /api/library/upload taking multipart or base64). Simplest: add POST /api/library/upload route in server/chat.ts or new server/library.ts storing via storagePut (storage helpers at server/storage.ts), return url; client posts base64 for small files. Then library.add mutation records metadata; delete removes row.
2. Typecheck + tests + browser verify /settings /scheduled /library load data (unsigned -> local; signed -> server empty list).
3. Mark todo round-14 items [x], checkpoint, report to user.

Round 14 complete and verified: LibraryPage wired to /api/library/upload + trpc.library.add/remove (curl-tested, 200 with storage key); screenshots confirm /settings, /scheduled, /library render clean when anonymous (localStore fallback) with server path enabled once signed in. Tests 9/9 pass, typecheck clean. Signed-in mode verified via vitest (settings persist, schedules CRUD, anon rejected). Remaining: mark todo round-14 items done, checkpoint, send final report to user.
