# Round 19 — Live Activity Verification

## Verified on 2026-08-16

The local I’m Snappy preview was tested with the prompt: `Make a Snake game in a sandbox and open its preview.` The SSE response arrived in the intended progressive order rather than as a post-completion summary: `run.started`, `run.tool_request`, `run.sandbox` (`started`), a second `run.sandbox` (`running`), `run.artifact`, `run.tool_result`, `run.delta`, then `run.completed`.

During the approximately nine-second sandbox provision step, the centered chat rendered an inline live activity card within the active I’m Snappy message. It visibly listed the active operations as **Snappy started working**, **Building an interactive browser preview**, and **Sandbox started**, including the safe title/detail and an active status treatment. The Canvas then opened automatically when the artifact event arrived.

After completion, the Canvas conversation panel retained a collapsed/expandable activity trace beneath the assistant response. It showed the model/start step, browser-preview tool call, active persistent sandbox, and ready artifact. The persistent preview sandbox remains marked as live while its expiry countdown runs; this is deliberate because it can still accept keyboard interaction from the embedded Canvas.

Closing the Canvas returned the workspace to the centered chat layout without losing the completed trace. The inline timeline stayed directly below the assistant response and showed the same four operations, with its concise `3 activity steps completed` summary and expandable rows. This confirms that activity belongs to the conversation, rather than being a Canvas-only or end-of-run-only diagnostic surface.

## Acceptance criteria confirmed

| Requirement | Observed result |
|---|---|
| Activity appears before the final answer | Yes; the inline timeline rendered after `run.started` and before artifact completion. |
| Tool and sandbox operations stream progressively | Yes; each SSE state increment updated the UI while provisioning continued. |
| Canvas opens only when the agent produces an artifact | Yes; it opened after `run.artifact`. |
| Completed operations remain inspectable | Yes; the final assistant message retains the expandable trace. |
| Persistent preview is identifiable as live | Yes; the timeline and Canvas toolbar show the running sandbox and expiry. |
