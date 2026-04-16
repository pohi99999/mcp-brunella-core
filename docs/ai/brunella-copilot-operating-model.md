# Brunella Copilot Operating Model

This document explains how Copilot CLI should be used in the Brunella repo without bloating context or mixing concerns.

## Purpose

Use Copilot to accelerate focused work on Brunella, not to load the entire repository into one prompt. The repo is large, multi-runtime, and track-driven, so the best results come from short, bounded sessions with a clear handoff.

## Recommended session sequence

### Explore

Use Explore when you need to understand the codebase before making decisions.

Read first:

- `README.md`
- `.github/copilot-instructions.md`
- `AGENTS.md`
- `.ai/BOOTSTRAP.md`
- `conductor/tracks.md`
- `.ai/FOSZAL.md`
- `.ai/copilot.md`
- any active track `meta.json`, `plan.md`, and `spec.md`
- only the source files directly involved in the task

Output from Explore should be a short architecture snapshot:

- which layer owns the change
- which files matter
- which registries, prompts, or routes are involved
- what the main risks are

### Plan

Use Plan after you understand the problem and before writing code.

The plan should answer:

- what belongs in core orchestrator, agent, skill/plugin, MCP adapter, or UI/admin
- what the input, output, and failure contract is
- which validations are required
- whether the task needs a new track or can stay inside an existing one
- what must be updated beyond runtime code, such as docs, prompts, registries, or tests

In Brunella, a "feature" means a user-facing capability or contract change. If the work is internal-only (for example a refactor, reliability fix, documentation sync, prompt update, or MCP boundary tweak), keep it in the narrowest layer that solves the problem and do not force dashboard/CLI wiring unless the visible contract actually changes.

Keep the plan small. One feature, one track, or one bounded slice per session is the default.

### Task

Use Task when the scope is clear and you are ready to implement.

Task sessions should:

- change only the files needed for the plan
- keep the working set narrow
- update tests and docs together with code changes
- preserve existing patterns instead of inventing new ones
- leave behind evidence for validation

### Code-review

Use Code-review as a separate pass before merge or handoff.

Review for:

- security and secret handling
- contract compatibility
- regressions and hidden coupling
- observability and logging
- maintainability and test coverage

The reviewer should compare the diff against the acceptance criteria, not just skim the changed lines.

## Keeping context small

Brunella sessions stay efficient when you:

- read only the files that matter to the decision
- prefer targeted searches over whole-repo scans
- stop once you have enough evidence to act
- use diffs and focused tests instead of loading the world
- keep one active track or feature in the prompt at a time
- summarize what you learned before switching to a new area

## Session recipes

### New feature

1. Explore the relevant runtime, registry, and track files.
2. Plan the correct layer and contract.
3. Task the implementation in one bounded slice.
4. Run Code-review on the diff.

### Bug fix

1. Explore the failing path only.
2. Plan the smallest safe fix.
3. Task the fix and its regression tests.
4. Code-review the change against the original failure mode.

### Refactor

1. Explore the dependencies and coupling.
2. Plan the compatibility strategy.
3. Task the refactor in small steps.
4. Code-review for drift, hidden side effects, and missing validation.

## Default context set

Start with the repo-wide contract files, then add only what the task needs.

```text
README.md
.github/copilot-instructions.md
AGENTS.md
.ai/BOOTSTRAP.md
conductor/tracks.md
.ai/FOSZAL.md
.ai/copilot.md
<active track files>
<directly affected source files>
```

## Handoff expectations

Every session should end with:

- what changed
- what was validated
- what assumptions remain
- what the next session should inspect
