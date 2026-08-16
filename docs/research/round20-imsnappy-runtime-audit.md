# I’m Snappy Agent Runtime Audit

**Scope.** This audit assesses the active server runtime in `server/agent.ts`, its streaming bridge in `server/chat.ts`, and the persistent browser-preview implementation in `server/preview.ts`. It is paired with `round20-hermes-agent-assessment.md` and focuses on concrete capability gaps rather than a wholesale platform rewrite.

## Current strengths

I’m Snappy already has several useful foundations. The server owns LLM calls and keeps the OpenCode API key away from the browser. It streams typed model, tool, sandbox, artifact, and completion events through SSE. It provides a persistent E2B sandbox for browser previews and a distinct Canvas artifact protocol. It also has an allowlist and explicit banned command patterns, a maximum number of tool rounds, live operation IDs, and a user-visible progress timeline.

## Capability and architecture gaps

| Area | Current behavior | Consequence | Upgrade direction |
| --- | --- | --- | --- |
| Tool registry | Tool schemas, routing logic, policy, UI labels, and execution are embedded in one agent module. | Adding capabilities duplicates logic and makes tests brittle. | Define typed tools with one schema, executor, policy, and result contract per tool. |
| Workspace continuity | Each `run_command` call provisions and kills a fresh E2B sandbox. | A multi-step agent cannot inspect a file it created or build a project over several calls. | Create one bounded, per-run sandbox workspace that is reused for all tools in the run and always cleaned up. |
| File authoring | The model has no structured read, write, or list-files capabilities. Shell redirection is blocked. | The agent cannot reliably create, review, and revise multi-file work. | Add sandbox-rooted `read_file`, `write_file`, and `list_files` tools with size and path limits. |
| Tool recovery | Tool errors are returned to the model, but there is no normalized envelope, malformed-call retry, or preflight schema validation beyond simple branching. | A malformed call or recoverable failure can waste the limited tool-turn budget. | Validate tool input with Zod, emit a consistent error envelope, and let the model repair one failed attempt. |
| Context discipline | The full client transcript plus raw tool output can be passed back to the model, only truncated at command capture. | Long runs consume context quickly and may cause irrelevant history to dominate. | Apply bounded tool summaries and a simple context budget before adding durable memory. |
| Lifecycle and cancellation | SSE responses have no AbortSignal propagation or run-scoped cancellation. | Closing the client may still consume model and E2B resources. | Pass request abort state into the runtime and kill the active workspace in `finally`. |
| Security policy | The command allowlist includes network, package-management, editor, file-removal, and pipeline tools; parsing only inspects the first token and banned patterns are necessarily incomplete. | The policy is difficult to reason about, while still being less capable for genuine file work. | Prefer structured filesystem tools and a narrower `run_command` scope rooted in the workspace. |
| Product special cases | Snake is intercepted with a bespoke fast path. | The runtime combines product-specific UX behavior with general orchestration. | Retain the fast path temporarily but move it into a dedicated capability/skill layer. |

## Recommended upgrade boundary

The selected first upgrade is a **TypeScript-native run workspace and typed tool registry**. It creates exactly one E2B sandbox for a tool-using run, exposes bounded filesystem tools plus a constrained command tool, records normalized results, and guarantees cleanup. This is intentionally smaller than Hermes’s full memory, skill, and subagent ecosystem, but it solves the key failure preventing agentic coding work: there is currently no durable state across tool calls.

> The initial runtime remains single-agent and request-scoped. It does not imitate private chain-of-thought, install a Python bridge, or create autonomous background execution. Those should only follow after the basic execution contract has stable tests and durable run persistence.

## Preservation requirements

The upgrade must preserve the existing `run.delta`, `run.trace`, `run.tool_request`, `run.tool_result`, `run.sandbox`, and `run.artifact` client contracts; the live activity timeline; the generic Canvas preview; no browser exposure of sandbox IDs; the standard free-model fallback behavior; and the deterministic Snake experience.
