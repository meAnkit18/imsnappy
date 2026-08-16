# Hermes Agent Architecture Assessment

**Purpose.** This note records externally sourced findings from [Nous Research’s Hermes Agent repository][1] and its source tree before adapting any ideas to I’m Snappy. It distinguishes reusable architectural patterns from code that should not be copied wholesale.

## Source and license

Hermes Agent is published by Nous Research under the **MIT License**. The license permits reuse and modification, provided that the copyright notice and permission notice are included in copies or substantial portions of copied source code. I’m Snappy should therefore prefer a clean-room implementation of architectural ideas; if it vendors or substantially adapts a Hermes source file, it must retain the required attribution and license text. [2]

## Observed architecture

| Hermes subsystem | Observed responsibility | Pattern relevant to I’m Snappy |
| --- | --- | --- |
| Conversation loop | Validates tool names and JSON, retries malformed tool calls, injects error tool results so the model can self-correct, and preserves protocol pairing. | Treat a failed model tool request as a recoverable turn, not a terminal chat error. |
| Tool executor | Separates tool dispatch from the main run loop; plans sequential versus concurrent calls, bounds workers and timeouts, and flushes the transcript after progress. | Add a typed tool registry plus a deterministic execution contract with lifecycle events, deadlines, and result normalization. |
| Tool hooks and guardrails | Supports pre-tool blocking/modification and post-tool notifications, with authorization gates around destructive work. | Introduce a policy layer before future filesystem, browser, and network actions; keep user-visible activity separate from private reasoning. |
| Context engine | Defines a pluggable lifecycle for token accounting, context selection, automatic compaction, and cheap tool-result pruning. | Add a bounded conversation/context budget and deterministic pruning before investing in a full memory system. |
| Skills and memory | Uses curated skills, session search, memory tooling, and provenance rather than treating every turn as stateless. | Build durable run/session summaries and a governed skill registry after the core tool loop is reliable. |
| Subagents | Supports delegated work and isolated task execution. | Defer until single-agent tool loop semantics, cancellation, and persistence are robust. |

The repository README describes Hermes as model-provider agnostic, with a learning loop, persistent skills and memory, session search, scheduled automation, subagents, and multiple execution backends. [3] The checked source corroborates that this is an ecosystem-sized Python product rather than a drop-in TypeScript library. Its `agent/tool_executor.py` separates execution logic from the conversation loop and includes bounded parallelism, authorization gates, result persistence, and tool-output budgets. Its `agent/context_engine.py` specifies an interface for usage tracking, context selection, compaction, and pruning.

> **Adoption decision:** I’m Snappy should not embed or execute Hermes as an in-process dependency. Instead, it should adopt a small, TypeScript-native runtime boundary inspired by its execution invariants: normalized operations, retryable tool failures, durable run state, bounded output/context, policy hooks, and later a skill registry.

## Initial upgrade priorities

The comparison points to four immediate, compatible improvements: a declarative tool registry, a bounded multi-step execution loop, normalized tool-result envelopes, and recovery logic that feeds safe failures back to the model. Those give the current OpenCode/E2B architecture a strong base without requiring Hermes’s Python gateway, its local process assumptions, or a wholesale product rewrite.

## Provider-routing finding

OpenCode documents Zen as a curated gateway of tested coding-agent models and lists its OpenAI-compatible chat-completions endpoint separately from other provider-specific endpoints. Its provider documentation also notes that tool performance is model-dependent and recommends selecting models with strong tool-calling behavior when tool calls are unreliable. This supports a bounded provider timeout plus retry across compatible candidates rather than waiting indefinitely on one free model’s reasoning stream. [4] [5]

## References

[1]: https://github.com/nousresearch/hermes-agent "Nous Research — Hermes Agent repository"
[2]: https://raw.githubusercontent.com/nousresearch/hermes-agent/main/LICENSE "Hermes Agent MIT License"
[3]: https://raw.githubusercontent.com/nousresearch/hermes-agent/main/README.md "Hermes Agent README"
[4]: https://opencode.ai/docs/zen/ "OpenCode Zen documentation"
[5]: https://opencode.ai/docs/providers/ "OpenCode provider documentation"
