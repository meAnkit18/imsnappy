# Test-Driven Contribution Workflow

## Definition of a safe change

A change is complete only when the feature behavior, persistence contract, tests, documentation, and recovery point agree. “It compiles” is a checkpoint, not a definition of done.

## Required workflow

| Order | Action | Evidence |
| --- | --- | --- |
| 1 | Clarify the target and success condition. | A specific `todo.md` checkbox written before code changes. |
| 2 | Read the applicable feature and architecture documents. | Correct runtime target and owner files identified. |
| 3 | Write or extend a failing test for the smallest new behavior. | A focused Vitest test or a documented reason why browser-only verification is also required. |
| 4 | Implement the smallest code change that satisfies the test. | No unrelated refactor hidden in the same change. |
| 5 | Add failure/boundary coverage. | For example: anonymous owner check, validation failure, upload error, model rate limit, or blocked command. |
| 6 | Run `pnpm run check` and `pnpm test`. | Clean typecheck and passing tests. |
| 7 | Exercise the user-visible path. | Screenshot or reproducible manual verification note when UI/SSE/layout is involved. |
| 8 | Update docs, decisions, and todo state. | Documentation and `todo.md` reflect reality. |
| 9 | Save a checkpoint. | A recoverable version with a precise summary. |

## Feature-specific test requirements

| Feature type | Minimum automated test | Required manual verification |
| --- | --- | --- |
| Drizzle/tRPC persistence | Owner happy path and anonymous/other-owner boundary. | Reload persisted UI state. |
| Chat/SSE | Event parsing, role normalization, terminal error path. | A real `Hi` stream with pinned composer. |
| Sandbox tools | Allowlisted command, blocked command, cleanup/error behavior. | Harmless sandbox command and trace rendering. |
| File handling | Validation, storage result, metadata owner scope. | Upload, list, download, delete a small file. |
| Scheduling | Create/update/delete and computed next run. | Pause/resume and UI state on reload. |
| UI/layout | Logic tests where feasible. | Desktop and mobile screenshot review. |
| Deployment contract | Contract/unit test and build per service. | Health endpoint plus non-production smoke path after deployment. |

For changes that depend on OpenCode or E2B credentials, run the standard suite first and then opt into the network-dependent check with `RUN_LIVE_INTEGRATION_TESTS=1 pnpm test`. Keep external availability failures distinct from deterministic test failures in checkpoint notes.

## Review checklist

Before a checkpoint, answer every question truthfully.

| Question | Required answer |
| --- | --- |
| Did I change a persisted shape? | Migration, helper, router, UI, owner checks, and tests all changed together. |
| Did I touch a secret-bearing integration? | No key entered source/logs/browser; error messages are redacted. |
| Did I touch the sidebar, Canvas, or composer? | Verified fixed composer, both Canvas modes, sidebar expansion, and mobile. |
| Did I change a service contract? | Both caller and callee were updated; contracts docs and tests were revised. |
| Did I add a placeholder? | It is visibly described as coming soon and documented in `ROADMAP.md`. |
| Can the next agent understand why? | `DECISIONS.md`, code comments, and checkpoint summary state the reason. |

## Branching and history

The local workspace uses checkpoints as the primary recovery mechanism. Avoid destructive history rewrites and never use `git reset --hard` to recover application state. Use a checkpoint rollback when needed. The external monorepo is a separate Git repository; do not accidentally commit local preview files there or vice versa.

## References

[1]: [Local test and development guide](LOCAL-DEVELOPMENT-AND-TESTING.md)
[2]: [Local task list](../todo.md)
[3]: [Decision record](DECISIONS.md)
