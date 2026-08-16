# Round 19: Live agent activity research

## Purpose

The user wants I’m Snappy to expose **operational progress as it happens** inside the active chat response: model work, file reads/writes, shell commands, browser actions, sandbox lifecycle changes, and outcome summaries. The design must make the run feel alive while avoiding the display of private chain-of-thought.

## External reference findings

The [AG-UI event model](https://docs.ag-ui.com/concepts/events) separates lifecycle events (`RunStarted`, `StepStarted`, `StepFinished`), streamed text events, tool-call lifecycle events (`ToolCallStart`, argument streaming, end, result), activity events, and error events. This supports a UI that creates an operation row **at start time**, updates it while work continues, and resolves it to a success or failure state. AG-UI also differentiates externally useful reasoning events from encrypted reasoning values, reinforcing the decision to expose concise progress summaries rather than hidden deliberation.

The [AI SDK stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) similarly distinguishes text streams from data streams and supports structured streaming for UI parts such as tool calls. The practical implication is that Snappy should not wait for final text to render tool activity: the event stream needs stable operation identifiers, operation phases, and in-place updates.

## Adopted interaction model

| Moment | Inline chat presentation | Data needed |
| --- | --- | --- |
| Run begins | A compact, expanded **Working** card is inserted directly above the assistant message. | `run.started` |
| Model step | One active row, e.g. “Planning next step”, with animated status dot. | `run.trace` with `state=running` |
| Tool begins | A new row appears immediately, e.g. “Reading `src/App.tsx`”. | `run.tool_request` with `operationId`, `kind`, `label`, `detail` |
| Tool is active | The same row becomes active; optional safe live output updates under it. | `run.tool_progress` or `run.trace` with same `operationId` |
| Tool resolves | The row settles to complete/failed and can be expanded for command, file path, output summary, and error. | `run.tool_result` with `operationId`, `status`, `summary`, `details` |
| Sandbox changes | A dedicated context row indicates provisioning/running/preview-ready/expired states. | `run.sandbox` with `operationId` |
| Response streams | Assistant prose streams below the active work card rather than replacing it. | `run.delta` |
| Run completes | The card collapses to a one-line summary, but can be reopened. | `run.completed` or `run.error` |

## Privacy and usability boundaries

The interface will show **intentional operational summaries**: “Reading `server/agent.ts`,” “Running preview server,” “Writing `index.html`,” or “Opening browser preview.” It will not display raw private reasoning or hidden chain-of-thought. Tool details will be inspectable on demand, and sensitive values must remain redacted from commands and results before they reach the browser.

## Implementation consequence

The existing `run.trace`, `run.tool_request`, `run.tool_result`, and `run.sandbox` events are adequate as a foundation but must be upgraded with stable `operationId`, `state`, and safe structured details. The client must attach the live activity card to the **currently streaming assistant message**, not only render it in the Canvas side panel after the run has completed.

## References

1. [AG-UI Protocol — Events](https://docs.ag-ui.com/concepts/events)
2. [Vercel AI SDK — Stream Protocols](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol)
