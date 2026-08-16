# Round 20 Runtime Upgrade Design

## Decision

I’m Snappy will adopt a **request-scoped workspace runtime** rather than embed Hermes Agent’s Python application. The new boundary borrows the useful parts of Hermes’s execution model—typed tools, a reusable workspace, normalized results, bounded outputs, and cleanup—but remains native to Snappy’s Express, OpenCode, E2B, SSE, Canvas, and TypeScript stack.

## Runtime boundary

| Component | Responsibility | Lifecycle |
| --- | --- | --- |
| `AgentWorkspace` | Lazily creates one isolated E2B sandbox, owns `/home/oai/share`, and destroys the sandbox at the end of a run. | One workspace per tool-using chat request. |
| Typed tool registry | Holds model-facing schemas, input validation, visible labels, policy gates, and executors. | Static registry; each call receives the current run context. |
| Tool-result envelope | Represents success or failure with a compact summary, structured data, retryability, and safe display detail. | Appended as a matching model tool result after every call. |
| Agent loop | Streams a model round, validates calls, executes tools sequentially against the shared workspace, then supplies results for the next model round. | Bounded by the existing maximum of six tool rounds. |
| Event adapter | Keeps current SSE event names while adding durable lifecycle information. | Emits start, progress, completion, blocked, and failure states. |

## Initial tool set

| Tool | Purpose | Boundaries |
| --- | --- | --- |
| `list_files` | Inspect the workspace directory tree one level at a time. | Only paths under `/home/oai/share`; bounded entry count. |
| `read_file` | Read a source file before modifying or explaining it. | Only workspace paths; capped output. |
| `write_file` | Create or replace source files with exact content. | Only workspace paths; capped file size; no dotfile or credential-path access. |
| `run_command` | Run a narrow set of build, inspection, and test commands. | Reused workspace, bounded duration/output, no shell control operators, no network or privilege commands. |
| `create_web_preview` | Publish a self-contained HTML artifact to Canvas. | Persistent dedicated preview sandbox; HTML validation remains unchanged. |

## Deliberate deferrals

Durable long-term memory, unrestricted filesystem access, arbitrary network access, background autonomy, concurrent tool calls, and subagents are deferred. They would expand the security and data-lifecycle surface before the agent has a reliable core execution model.

## Compatibility commitments

The implementation retains the existing live activity SSE contract and uses the same Canvas artifact format. A built-in Snake request continues to use its deterministic preview fast path. The browser never receives a raw E2B sandbox identifier.

## Implemented reliability additions

The runtime now treats **Snappy’s platform-backed tool-capable model route** as its reliable default. The existing external OpenCode free-model stream is retained behind `SNAPPY_USE_OPENCODE_STREAM=1` for controlled provider experiments, but a slow third-party stream can no longer prevent a working local preview from completing a user request. The fallback uses the same typed tools and returns the same normalized `content + toolCalls` contract, so it does not create a second agent loop.

The SSE bridge now determines delivery health from the outgoing response (`res.destroyed` / `res.writableEnded`) rather than the consumed incoming request body. This prevents valid tool, model, and completion events from being silently discarded after the POST body has been read.

## Validation evidence

The live endpoint was exercised with a three-round workspace task: the runtime planned `write_file`, created `status.txt` in a single reusable E2B workspace, planned `read_file`, read the same file, then returned the verified content. The stream emitted `run.trace`, `run.tool_request`, `run.tool_progress`, `run.sandbox`, `run.tool_result`, `run.delta`, and `run.completed` in the expected order. This confirms that the agent can now sustain a stateful multi-step task rather than only narrating intended actions.
