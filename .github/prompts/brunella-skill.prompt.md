---
description: "Reusable prompt for designing a Brunella skill/plugin/capability with triggers, dependencies, side effects, validation, and examples."
name: "Brunella Skill"
argument-hint: "Trigger conditions; dependencies; side effects; validation; examples"
agent: "brunella-architect"
---

# Brunella Skill Brief

## Trigger conditions

- [Describe exactly when the skill should be used.]
- [List phrases, states, or signals that should activate it.]
- [State when the skill must not be used.]

## Purpose

[Explain the thin, reusable capability the skill provides.]

## Dependencies

- [List local helpers, services, or registries required by the skill.]
- [List any MCP server or external service used by the skill.]
- [State if the skill depends on another agent or workflow.]

## Side effects

- [State what the skill reads, writes, or mutates.]
- [State what must be observable in logs or traces.]
- [State what must never happen implicitly.]

## Validation

- [Describe the success path test.]
- [Describe the error path test.]
- [Describe edge cases and limits.]
- [Describe any manual verification step if required.]

## Examples

- Example input:
- Expected output:
- Failure example:

## Registration checklist

- [ ] Skill is discoverable in the runtime registry or loader.
- [ ] Prompt/template documents the trigger and contract.
- [ ] Tests cover success and failure paths.
- [ ] Side effects and observability are documented.
- [ ] The skill is not a disguised agent or MCP adapter.

## Decision guardrail

If the capability needs stateful orchestration, use an agent instead.
If it needs a new transport or tool boundary, use an MCP adapter instead.
