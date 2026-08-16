# Phase 9 — Functional local preview (implementation notes)

## New files
- `client/src/lib/localStore.ts` — localStorage persistence (namespaced `imsnappy:`): conversations, library assets, schedules, preferences. Types: StoredMessage, StoredConversation, LibraryAsset, ScheduledTask, AgentPreferences. Functions: listConversations/saveConversation/removeConversation/loadConversation, listAssets/addAsset/removeAsset, listSchedules/saveSchedules, defaultPreferences/readPreferences/savePreferences.
- `client/src/lib/agent.ts` — browser-safe agent client. `streamCompletion(messages, preferences, apiKey, callbacks, signal?)` POSTs to `https://opencode.ai/zen/v1/chat/completions` (OpenCode Zen free models: deepseek-v4-flash-free, mimo-v2.5-free, nemotron-3.5-lightning-free) with SSE streaming parse. Falls back to `localEchoReply()` (word-by-word local simulation) when no key (`imsnappy:opencode_key`) in localStorage. Exports `FREE_MODELS`, `OPENCODE_ZEN_URL`.

## Home.tsx edits DONE so far
- Imports: useCallback, useRef added; localStore + agent imported.
- New state: activeConversationId, liveDraft, threadRef, abortRef, hasApiKey (checks localStorage key), modelError, preferences (readPreferences).
- loadLocalConversation(id) + persistConversation(history, title) added.
- submitPrompt rewritten: posts to real model with streaming deltas into messages; safety timeouts (15s finish guard, 30s echo cancel); abortRef on re-submit and resetConversation.
- chooseConversation now calls loadLocalConversation (brief → reset).
- Layout fix: section changed `overflow-y-auto`→`overflow-hidden`; inner wrapper `flex-1 min-h-0`; composer wrapper `shrink-0 pb-6` (composer now pinned outside the scroll flow). Thread autoscroll effect wired to threadRef/liveDraft.
- CanvasConversationPanel now accepts optional threadRef prop and applies to its thread div. Call site passes threadRef.
- ConversationView was NOT yet successfully updated: attempted edit (rendering real message thread: user bubbles + agent streaming paragraph + working spinner + proposed-direction card) — first edit applied, second edit failed (Find text mismatch; the work-trace-button block was already consumed/changed by edit 1). MUST re-read ConversationView (lines ~481-560) and re-apply the work-trace button + traceExpansion removal or keep it.

## ConversationView current state (lines ~481-553):
- Wrapper `<div className="animate-editorial-in mx-auto w-full max-w-[700px] pb-10 pt-4">`
- User bubble block (line ~496-502) unchanged.
- Then mt-10 div with working? WorkingTrace : static agent response (agent-response-label, display-subtitle "Here's the shape...", body text, work-trace-button, WorkTrace, proposed direction card, follow-up pills).
- TODO: replace static agent response with `messages` thread render (user/agent bubbles, isWorking streaming paragraph, agent-pulse-small "Writing the response"), keep proposed-direction card + pills inside a `!working` block. Also remove orphaned work-trace usage (traceExpanded prop now unused? still passed from Home line ~438 onToggleTrace).

## Remaining phase 9 work
1. Finish ConversationView thread rendering (check TypeScript).
2. Composer attachment/voice: currently `activatePlaceholder` — make attachment functional: prompt for file via input, store as LibraryAsset (dataUrl for small files) → addAsset; voice → same placeholder (Groq would need key in browser; keep placeholder or skip).
3. SettingsPage: wire `savePreferences` + save opencode key to `imsnappy:opencode_key` localStorage; persist profile/about text; toast success.
4. LibraryPage: replace static assets with `listAssets()`; add upload button (input type=file) → addAsset; download (a[dataUrl]); delete removeAsset.
5. ScheduledPage: replace initialTasks with `listSchedules()/saveSchedules()`; interval options map to minutes; enable toggle; delete; add form.
6. Sidebar conversations list: Home passes static `conversations`; consider passing stored conversation ids — optional, keep simpler: sidebar already receives conversations prop; maybe append recent stored convs.
7. pnpm check; screenshots; checkpoint; update todo.md (mark items done).

## Key design tokens (Quiet Intelligence)
Off-white #f5f5f5 canvas, warm ink #0c0a09, stroke #e7e5e4/#d6d3d1, ink #292524, muted #777169/#8a857d/#a8a29e, mint #a7e5d3, lavender #c8b8e0. Fonts: Cormorant Garamond display, Inter utility. Composer classes: composer-anchor, composer-pinned, composer-shell, composer-input, send-button. Agent bubbles: agent-response-label, agent-pulse-small, canvas-thread-user/agent.

## Deployment handoff context (already delivered)
Monorepo at /home/ubuntu/imsnappy-staging pushed to meAnkit18/imsnappy main (commit 0a953ac): Vercel client (client/vercel.json), Render render.yaml (api web 4100, harness pserv 4200 private, orchestrator worker), README runbook, services/api + services/harness + services/orchestrator + packages/contracts. Checkpoint manus-webdev://142fee4e already delivered for that phase. Current phase 9 work is local-functional preview for the Manus-hosted project at /home/ubuntu/agentelier.

## Browser verification finding — Aug 16
The live preview accepted a real prompt and held the composer fixed at the bottom of the viewport, but it rendered the submitted user bubble twice and then showed the static “Proposed direction” card instead of the model's streamed answer. The source explains the defect: `submitPrompt` calls `useCallback` inside an event handler, leaves a pre-existing 1.15-second working-state timer active, and treats the end of streaming as an empty response. Correct the completion flow to use an ordinary closure with an accumulated response, remove the artificial working timer, and render only the durable `messages` thread when any messages exist.

After the first lifecycle correction, the duplicate prompt was resolved but the returned agent text was still absent. The request transitions from “Writing the response” to a completed static follow-up card, so the next diagnosis must distinguish a browser-side model request failure from an SSE parsing/completion path that emits no text.

The network log identified the browser failure as a cross-origin `Failed to fetch` request to OpenCode. A Vite-only `/zen-api` proxy was added and the local streaming client now uses it in development. The re-test passed: one user message, one streamed OpenCode response, the composer remained fixed, and the conversation completed without console errors. The proxy does not carry a key of its own; it forwards the user-supplied test key stored in browser local storage. Deployed clients continue to use the separate API and private harness service.

Settings test passed: profile context was saved through the UI, the confirmation toast appeared, and the OpenCode key and model controls remained available. The next validations cover local Library file persistence, Scheduled task CRUD, route navigation, and responsive composer behavior.

Library test passed: a small text file was supplied through the UI’s file input, the upload handler classified and stored it locally, and its card appeared with the correct name and byte size plus download and delete controls. The test asset will be removed after verifying the delete path.

Scheduled task test passed: a task was created through the form, displayed with its daily run time, paused through the switch, and deleted through the task action. Confirmation toasts appeared at each operation and the empty state returned after cleanup. The Library test asset was also removed successfully, leaving the preview’s local test data clean.

Responsive validation found that the mobile sidebar was incorrectly reserving 280px and left only a narrow unusable sliver of content. The shared rail now stays at 76px below the desktop breakpoint, does not hover-expand on touch-sized layouts, and Discover pages reserve that compact rail width. A fresh 375px-wide capture confirms the Home composer is visible above the fold and Settings, Library, and Scheduled pages are usable. Settings were also reloaded in-browser: the OpenCode preview key, model values, and profile context persisted correctly. The recent browser console was empty after the complete workflow exercise.

Canvas mode was rechecked after the responsive navigation change. Its central editable working draft, collapsible conversation panel, agent-action controls, and composer all rendered together. The composer remained fixed at the lower edge of the workspace while the canvas and side conversation use their own available content space.
