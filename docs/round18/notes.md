# Round 18 — Work trace + agent-decided Canvas + generalized artifacts + lifecycle + GitHub sync

## User request
1. Show everything the agent is doing (tool calls, sandbox commands, steps) live on screen — like Bolt/Claude working log. Most important.
2. Remove Canvas toggle from prompt box; AGENT decides when to open Canvas; user can minimize/close Canvas; agent can re-open.
3. Generalize artifact builder beyond Snake (any web preview via create_web_preview tool).
4. Visible sandbox lifecycle panel with restart + expiry controls.
5. Persist preview/session history.
6. Push whole code to GitHub (user pushed; keep in sync via `meAnkit18/imsnappy`, client folder).

## Current architecture (verified)
- `server/agent.ts`: runAgent(opts) — emits TraceEvent {type: trace|delta|tool_request|tool_result|sandbox_ready|artifact|completed|error, payload}. Models: hy3-free default + retry fleet. Snake hardcoded fast-path via `isSnakeGameRequest`. Tools: `run_command` (allowlist), `create_web_preview` ({title, html}). Sandbox is short-lived per command EXCEPT previews use Sandbox.create({timeoutMs: 15min}) + http.server on 8080 + sandbox.getHost(8080).
- `server/preview.ts`: createSandboxPreview({title, html}) -> SandboxPreviewArtifact {artifactId, name, type:"file", contentType:"text/html", url:"https://{host}", expiresAt, preview:true}. MAX_HTML_BYTES=350k. snake html inline.
- `server/chat.ts`: POST /api/chat/stream SSE. Maps agent events -> run.{delta,trace,tool_request,tool_result,artifact,completed,failed}. sandbox_ready folded into trace.
- `client/src/pages/Home.tsx`: submitPrompt handles run.delta/artifact/completed/failed only (ignore run.trace/tool_request/tool_result!). expectsPreview = isSandboxPreviewRequest -> opens canvas early. Composer has Canvas + Agent toggle buttons. CanvasWorkspace lines 799-868 (preview/loading/editor). CanvasConversationPanel 871-963, WorkTrace 694-727 hardcoded placeholder "3 steps".
- `client/src/lib/sandboxPreview.ts`: isSandboxPreviewRequest, readSandboxPreviewArtifact (validates url https + preview:true), sandboxPreviewCompletionMessage.
- `client/src/lib/localStore.ts`: keys: imsnappy:conversations, library, schedules, preferences. No trace/preview session storage.

## Plan
### Server
- Emit richer trace events already present (tool_request, tool_result, sandbox_ready, trace) — no schema change needed. Keep.
- New SSE event: `run.sandbox` with lifecycle {sandboxId(anonymized), state: created|running|stopping|expired|error, expiresAt, actions: [restart]}.
- Persist session previews server-side: keep Map<sessionKey, {artifact, expiresAt}> in memory + localStorage-style fallback? Better: store in MySQL via drizzle library_assets? No — reuse library_assets with url=preview url. Add `sessions`? Keep simple: extend localStore on client to persist trace + preview sessions; server exposes tRPC? Simpler: persist in client localStorage (trace + artifact metadata), matches local-first pattern.
- Generalize: remove Snake-only fast path dependency — keep it but also handle generic create_web_preview (already works via tool call).
### Client
- TraceEvent type in client: types for trace/tool_request/tool_result.
- New state `workTrace: TraceEntry[]` (id, time, kind: model|tool|sandbox|artifact|error, label, detail, status pending|running|done|error, expandable detail like command output).
- Render "Working log" drawer below composer (Canvas-off) and inside CanvasConversationPanel (Canvas-on) — live list, newest top? (Claude-style: newest at bottom, like chat). Auto-scroll.
- Composer: REMOVE Canvas toggle button. Agent decides. Add minimize/close on CanvasWorkspace toolbar.
- Canvas minimize: `canvasState: "off" | "maximized" | "minimized"` — minimized shows slim bar above composer ("Artifact: snake game · 12 min left · restore").
- Lifecycle controls: restart (re-creates preview? E2B sandbox can't restart — recreate preview with same html -> simplest: store artifact html? html not stored server-side currently... persist html in Map keyed by artifactId + localStorage copy) + external open + expiry countdown.
- Persist session history: localStore add imsnappy:sessions {artifactId, name, url, createdAt, expiresAt, prompt, trace}. Show in recent work.
### GitHub sync
- Push to meAnkit18/imsnappy (user already pushed). Update client folder. Repo path: /home/ubuntu/imsnappy-staging mirror? Local monorepo at /home/ubuntu/imsnappy-staging with services/api/harness/orchestrator + client. Copy client changes there and push.
### Tests
- Extend server/preview.test.ts or new server/trace.test.ts: trace event emission shape deterministically (mock Sandbox.create + fetch), tool_request/result types.

## Progress (update as I go)
- [x] Design notes saved
- [x] Server: TraceEvent type now includes "sandbox"; runAgent emits sandbox started/running around previews (Snake fast path + create_web_preview); artifacts carry origin/kind
- [x] Server: chat.ts forwards run.sandbox
- [x] Client lib sandboxPreview.ts: added SandboxLifecycleEvent, readSandboxLifecycle, WorkTraceEntry, formatToolRequest, formatToolResult; artifact carries origin/kind
- [x] Client: wired run.trace/tool_request/tool_result/run.sandbox into workTrace state; live trace renders in CanvasConversationPanel via LiveWorkTrace (real step count)
- [x] Client: removed Canvas toggle from Composer; canvasState off|minimized|maximized; agent opens canvas via run.artifact (SSE) instead of early toggle; MinimizedCanvasBar when sandbox starts
- [x] Client: session persistence — localStore add StoredSession + listSessions/saveSession/removeSession under imsnappy:sessions; session saved at stream completion if artifact arrived
- [x] Client: lifecycle panel — SandboxLifecyclePanel in CanvasConversationPanel actions, ExpiryCountdown in toolbar + panel; lifecycle state shown in toolbar
- [x] Tests: added trace/lifecycle tests to preview.test.ts (19 passing, 3 skipped live probes); typecheck clean; live curl of /api/chat/stream verified run.started/run.trace/run.delta events
- [ ] GitHub sync to meAnkit18/imsnappy (repo mirror at /home/ubuntu/imsnappy-staging; user pushed; sync client folder + docs)
- [ ] Checkpoint + report

## Verified Round 18 client behavior
- Homepage clean; Canvas toggle removed from Composer; Agent toggle remains.
- Canvas opens only on run.artifact (functional updates used — no stale closures).
- LiveWorkTrace/SandboxLifecyclePanel/ExpiryCountdown/MinimizedCanvasBar added at end of Home.tsx.

## Verified reference (from round18-notes earlier section)
- Composer Canvas toggle: Home.tsx ~line 780-782 `setCanvasMode(!canvasMode)` button. Remove it.
- submitPrompt: expectPreview auto canvas open at lines 230-235 (KEEP for agent-decided: open on run.artifact event instead; can keep early hint? REMOVE early setCanvasMode; agent decides via artifact).
- CanvasConversationPanel 871-963; WorkTrace 694-727 placeholder — replace with live WorkTrace component using workTrace state.
- CanvasWorkspace 799-868 — add minimize/close toolbar + minimized state bar.
- Composer props include canvasMode/setCanvasMode — keep prop (needed elsewhere?) Composer receives setCanvasMode only for toggle button; can keep for canvasMode display class `canvas-mode-active`? No — just remove button, drop props if unused.
- localStore keys: imsnappy:conversations/library/schedules/preferences. Add imsnappy:sessions with StoredSession {artifactId, name, url, origin, kind, createdAt, expiresAt, prompt, traceCount}.
