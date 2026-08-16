# I’m Snappy Branding Update

- [x] Replace the visible product name and chat identity with “I’m Snappy”.
- [x] Update the browser title, project description, and supporting product copy.
- [x] Verify naming consistency and TypeScript compilation after the rename.
- [x] Remove the welcome-section element identified in the visual edit request.
- [x] Validate the cleaner welcome layout and save a checkpoint.
- [x] Confirm the visible “New Focus” label in the workspace rail.
- [x] Add hover-to-expand behavior to the desktop workspace rail while preserving mobile access.
- [x] Verify the interaction and save a checkpoint.
- [x] Research professional compact and expanded workspace-sidebar patterns.
- [x] Redesign the desktop sidebar as a cohesive compact rail and expanded navigation panel.
- [x] Validate the refined desktop and mobile sidebar states and save a checkpoint.

- [x] Diagnose and remove the jiggle when the sidebar expands and collapses.
- [x] Verify the smooth expansion behavior and save a checkpoint.

- [x] Replace the header "New Focus" dropdown with a date and time display plus a Calendar control.
- [x] Build an interactive calendar dropdown where the user can add items/reminders for the agent.
- [x] Verify the calendar interaction at desktop and mobile and save a checkpoint.

## Calendar feature notes
Desktop header at 1280px shows "I’m Snappy" beside the New Focus control; at 768px the label is hidden (lg:inline) and only "New Focus" shows — user asked the area to show "I'm Snappy" and date/time. Plan: at ≥768px header shows "I’m Snappy" plus live date/time display, then replace the New Focus dropdown button with a Calendar button that opens a popover calendar (react-day-picker available in template) where the user picks a date and writes a note to hand to the agent. Add a small "Upcoming notes" section in the right context panel listing added items.

## Implementation progress (calendar feature)
Done in Home.tsx: imports added (useMemo, CalendarIcon, DayPicker, Popover, Button); AgentCalendarNote type; state: calendarOpen, selectedDate, calendarDraft, calendarNotes, now (ticks every 30s); dateLabel/timeLabel; addCalendarNote() adds note + toast; header now shows brand-lockup (I’m Snappy) + date/time at xl inline + Calendar popover button (trigger replaced the old task-title-button "New Focus" dropdown). Popover (w-300px): DayPicker single select + textarea + Add button. CSS: task-title-button = pill style (radius 999px, padding 7px 9px), brand-lockup serif 24px. Remaining: add .calendar-mini style (DayPicker font sizing in index.css), optional upcoming-notes list in context panel, TypeScript check, screenshots, checkpoint. Note: DayPicker v9 from react-day-picker — check for classnames prop; template ships v9.11.

## Calendar verification results
The calendar feature works end to end: the header now shows "I’m Snappy" + live date/time ("Sat, Aug 15 · 8:54 PM") + Calendar control at ≥768px; the popover opens DayPicker (August 2026) with note textarea; clicking "Add to agent calendar" stored the note (verified "1 item / Aug 15 Draft the launch brief outline..." in Notes for the agent) and fired the toast. TypeScript passes; tablet shows brand lockup + calendar; mobile shows compact brand lockup only (no header date needed — fine). All three checklist items effectively done; only checkpoint remains.

## Visual editor requests (round 5)
- [x] Remove four flagged elements (approx lines 333, 335, 373, 374 in Home.tsx).
- [x] Make the right panel (aside ~line 620) auto-expand on hover when Canvas is active, showing the full chat transcript and model responses instead of the context panel.
- [x] Verify the behavior in desktop viewport and save a checkpoint.

## Remaining steps (round 5)
Done: removed brand-lockup span (line ~333), two divider spans, and the Share button from header; added AgentMessage type; messages state with user/agent(isWorking) entries in submitPrompt, cleared in resetConversation, marked complete when isWorking ends; ConversationView accepts messages prop; TranscriptPanel render wired (error now only "Cannot find name TranscriptPanel" — component itself still to be defined).
Still to do: define TranscriptPanel component below WorkTrace (around line 550) — a right panel w-[292px] like ActivityPanel, with compact state (slim ~52px tab with "Conversation" label, auto-expands on hover when canvasMode, similar crossfade to left rail) showing full message transcript: user bubbles (AM avatar) and agent responses ("I'm Snappy" label + response text; agent text simulated as: "I'd start by separating the useful signal from the surrounding noise, then structure the result as a brief with evidence, choices, and an actionable next move." — reuse the response text logic; for isWorking show WorkingTrace). Include eyebrow "CONVERSATION" + hover-to-expand using same state pattern as rail (hover + focus → expanded). Then pnpm check, screenshot desktop + mobile, checkpoint, mark checklist done.
Styles available in index.css: agent-note-item, agent-pulse, working-step, conversation bubble: .user-message-avatar, .agent-response-label, .display-subtitle, .follow-up-pill, work-trace-button. Header controls left: calendar dropdown, panel toggle, profile icon.

## Transcript panel test findings (round 5)
The message flow works end to end: typing "Draft the quarterly roadmap summary" appears as a user bubble in the Conversation panel with the agent response, work trace, and "Continue this thread" pill (context panel still open alongside). Issue: panelWidth measured 52px while text content visible — the inline style={{width}} on aside is being overridden by the Tailwind width classes? Actually text visible means expansion DID happen via inner content (width transition applied) but getBoundingClientRect read 52. Wait — text content is visible means expanded (292px). The measured 52 may have been read before the 240ms transition finished (400ms wait... should be enough). Re-check: possibly the aside has a Tailwind width class overriding inline style in Tailwind v4 (arbitrary/layer issue) or mouseenter didn't reach the aside because of overlay. Also noticed two panels rendered (activityOpen AND canvasMode) at once — acceptable since canvasMode shows transcript and user wants hover auto-expand; but activityOpen panel still open too. FIX candidates: (1) give TranscriptPanel a fixed style width via CSS class instead of inline style width (Tailwind arbitrary widths via style attribute work though). Verify again.

## Transcript rail width diagnosis (round 5, continued)
The CSS classes work correctly when applied directly (292px expanded, 52px collapsed). However, applying is-expanded through React state does not persist — getBoundingClientRect read 52 even after mouseenter dispatch, meaning React is re-rendering and the expanded flag isn't reaching the DOM, OR (more likely) mouseenter/mouseleave dispatched on the aside fires but the aside re-renders on state changes triggered elsewhere (e.g., the send flow unmounts/re-mounts components). Hypothesis: the transcript panel's state updates (hovered) cause React to apply "is-expanded", but the component lives inside the same tree as ConversationView whose state (traceExpanded etc.) re-renders, and the panel's className recomputes fine. Alternative: the aside loses pointer events because the content div is aria-hidden initially... Test: dispatch mouseenter on the panel and immediately read panel.className to see if is-expanded appears.

## Transcript rail verified (round 5)
Real-mouse hover on the collapsed 52px transcript rail expands it to full width showing the conversation thread (user bubble, agent response, work trace, Continue-this-thread pill). Width animation works via the class-based .transcript-rail rules. Remaining observation: with Canvas on, the desktop shows ActivityPanel + TranscriptPanel side by side; both are requested by user (context panel shows agent notes, transcript shows chat). Header now shows "Sat, Aug 15 · 9:05 PM" + Calendar dropdown as intended; four flagged elements removed. Next: verify mobile still clean, then checkpoint.

## Sidebar content motion refinement
- [x] Align compact and expanded sidebar layers so their content crossfades without layout shifts.
- [x] Remove small active-row geometry changes that create visual jumps during expansion.
- [x] Verify hover expansion and collapse are smooth before saving a checkpoint.

## Header profile cleanup
- [x] Remove the duplicate profile control from the desktop header.
- [x] Verify account access remains available only from the sidebar footer and save a checkpoint.

## Canvas workspace reconfiguration
- [x] Make Canvas the central workspace when Canvas mode is enabled.
- [x] Move chat history, model responses, and agent actions into the right-side panel for Canvas mode.
- [x] Preserve the current centered chat workspace when Canvas mode is disabled.
- [x] Verify Canvas-on and Canvas-off layouts before saving a checkpoint.

## Composer fixed position (Canvas on/off)

- [x] Keep the prompt composer anchored at its fixed bottom-center position in both Canvas-on and Canvas-off modes
- [x] In Canvas mode, right panel holds only the chat conversation, agent actions, and work trace (no composer)
- [x] Verify both layouts and save a checkpoint

## Fixed dashboard viewport (no page scroll)

- [x] Make the whole workspace a fixed-viewport dashboard so nothing pushes the page into scrolling
- [x] Enlarge the Canvas to fill the upper blank space in Canvas mode (flex sheet with max-height 72dvh)
- [x] Pin the composer at the bottom of the screen in both modes (sticky composer-pinned anchor) so it is always visible without scrolling
- [x] Verify both layouts across desktop and mobile breakpoints and save a checkpoint

### Layout observations (pre-fix, checkpoint 7df0c1cc)
The desktop Canvas-off screenshot shows the composer sitting at ~y=720px on a 720px viewport, meaning the page already exceeds the viewport height and scrolling is required to see the input in both modes. The center column uses justify-center which pushes content down past the fold; the canvas-sheet min-height of 560px plus header/composer exceeds dvh. Fix approach: make the main content column h-dvh overflow-hidden, pin the Composer at the bottom of the column (absolute bottom-0 within a relative full-height column, or sticky bottom with margin auto), shrink the Canvas sheet to fill the remaining space (max height instead of fixed min), and reduce vertical padding. For Canvas-off, center the ConversationView in the available space above the pinned composer.

## Right panel simplification

- [x] Remove the standalone context sidebar (ActivityPanel) when Canvas is off — no right sidebar in Canvas-off mode
- [x] Keep the right conversation/actions panel only in Canvas mode
- [x] Add an expand/collapse toggle controller for the Canvas conversation panel (header icon + panel close button)
- [x] Verify both layouts and save a checkpoint

### Verification (checkpoint pending)
Canvas-off desktop and mobile: no right sidebar, pinned composer confirmed. Canvas-on: conversation panel visible with header collapse control and close button; collapsing hides the panel and expands it again via the header control; the canvas grows to fill the freed width. TypeScript clean.

### Verification (checkpoint pending)
Canvas-off desktop (1280x720): no right sidebar, full-width workspace with pinned composer — confirmed. Canvas-off mobile (375x812): clean single-column with pinned composer — confirmed. TypeScript clean after removing ActivityPanel and activityOpen state. Remaining: verify Canvas-on panel toggle in browser, mark checklist, save checkpoint.

## New sidebar items

- [x] Add App Store item to the sidebar rail (compact) and expanded studio index
- [x] Add Library item to the sidebar rail and expanded studio index
- [x] Add Settings item to the sidebar rail and expanded studio index
- [x] Show "coming soon" toasts when the new items are clicked (via activatePlaceholder)
- [x] Verify sidebar in compact and expanded states and save a checkpoint

### Verification (new sidebar items)
Compact rail (1280x720): grid (App Store), library, and settings icons appear below the Search icon, above recent-work pins — confirmed. Expanded index: new "Discover" section with App Store (Extensions and agents), Library (Saved work and drafts), Settings (Preferences and account) rows above Recent work — confirmed via live browser expansion. Clicking App Store triggers the "coming soon" toast (Projects/App Store placeholder toast shown). TypeScript passes.

## Sidebar cleanup

- [x] Remove the Workspace section (I'm Snappy workspace card) from the expanded sidebar
- [x] Remove the subtitles from the App Store, Library, and Settings items
- [x] Verify the expanded sidebar and save a checkpoint

### Verification (sidebar cleanup)
Expanded sidebar: Workspace section removed, Discover rows show name only with no subtitles, Recent work follows directly — confirmed in live browser. Compact rail unchanged. TypeScript passes.

## Scheduled sidebar item

- [x] Add a Scheduled icon to the compact rail
- [x] Add a Scheduled row to the expanded Discover section
- [x] Show a coming-soon toast when clicked
- [x] Verify and save a checkpoint

### Verification (Scheduled item)
Compact rail: CalendarClock icon appears below Settings, above recent pins — confirmed. Expanded sidebar: Scheduled row added at the end of Discover — confirmed in live browser. Click triggers the coming-soon toast. TypeScript passes.

## Discover pages build

Build four distinct pages for the sidebar Discover items, each with its own route and content:

1. **App Store** (`/store`): skills, MCPs, and connectors catalog with categories, install/uninstall state, descriptions, and search.
2. **Library** (`/library`): generated-assets storage organized by type (documents, images, audio, video, files) with filtering and preview placeholders.
3. **Settings** (`/settings`): model provider selection, API key management (multiple APIs), preferences, and profile/about text (name, workspace description, agent personality notes).
4. **Scheduled** (`/scheduled`): task scheduling UI — create scheduled agent tasks with time/recurrence controls, list of upcoming and past runs, enable/disable toggles.

All pages must share the left rail navigation (same sidebar, active state tracking), the fixed-viewport layout, and the ElevenLabs editorial design system (off-white canvas, warm ink, Cormorant Garamond display, Inter utility). Clicking Discover items must navigate to these pages instead of showing toasts.

- [ ] Add routes in App.tsx and update Home.tsx sidebar navigation to use wouter Link/paths
- [ ] Build App Store page
- [ ] Build Library page
- [ ] Build Settings page
- [ ] Build Scheduled page
- [ ] Verify navigation and pages across breakpoints, update checklist, save checkpoint

### Progress notes (Discover pages build — checkpoint pending)
Created: `/client/src/components/DiscoverLayout.tsx` (shared rail shell with nav buttons), `/client/src/pages/AppStorePage.tsx` (skills/MCPs/connectors with install toggle), `/client/src/pages/LibraryPage.tsx` (generated assets by type with download/delete), `/client/src/pages/SettingsPage.tsx` (model provider, API keys, profile/about, preferences toggles), `/client/src/pages/ScheduledPage.tsx` (task scheduling with enable/pause/delete, add-form, active/paused sections). Added Discover-page CSS to `client/src/index.css` (discover-page, discover-rail, discover-main, store-card, library-card, settings-field, scheduled-task-card, mobile overrides).

Remaining: update `client/src/App.tsx` to add routes /store, /library, /settings, /scheduled; update Home.tsx sidebar nav items (compact rail IconButton + expanded rail-nav-item) to navigate to those routes with wouter Link instead of activatePlaceholder toasts; run pnpm check; verify all 4 pages via screenshots; mark checklist; save checkpoint.

### Verification (Discover pages)
All four pages rendered correctly at 1280x720 and 375x812. App Store: search filters items, install toggle works with toast. Library: filter tabs work, download/delete trigger toasts. Settings: model dropdown, API key inputs, profile textarea, toggles all functional. Scheduled: enable/pause/delete work, add-form creates new tasks. TypeScript 0 errors. Navigation from sidebar and back-to-workspace link works.

## Consistent sidebar across pages

- [ ] Extract the sidebar into a shared component used by both Home and all Discover pages
- [ ] Ensure the sidebar state (expanded/collapsed, recent conversations) persists across page navigation
- [ ] Remove the separate DiscoverLayout rail so all pages use the same sidebar markup
- [ ] Verify sidebar is identical on all routes and save a checkpoint

### Implementation notes
- Home.tsx sidebar (lines 243-367): archive-rail aside with compact-view and expanded-view divs
- DiscoverLayout.tsx has its own separate rail that needs to be replaced with the shared component
- Key difference: Home sidebar shows "Recent work" conversations; Discover pages don't have that context
- Solution: shared Sidebar component with optional recent-work prop, used in both layouts

## GitHub push

- [ ] Check if the `imsnappy` repo exists on the user's GitHub account (create it if not)
- [ ] Prepare a staging copy of the project with the full code inside a `client` folder
- [ ] Push to the `imsnappy` repo on GitHub
- [ ] Verify the push and report to the user
