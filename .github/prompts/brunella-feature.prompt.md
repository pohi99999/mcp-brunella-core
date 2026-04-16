---
description: "Reusable prompt for implementing a Brunella feature across core runtime, agents, skills, MCP, CLI, dashboard, and tests."
name: "Brunella Feature"
argument-hint: "Goal; constraints; modules affected; acceptance criteria; tests; rollout notes"
agent: "brunella-implementer"
---

# Brunella Feature Brief

## Goal

[Describe the user outcome and the exact problem to solve.]

## Constraints

- [List platform, performance, security, and scope constraints.]
- [State anything that must not change.]
- [State any deadline, rollout, or compatibility constraint.]

## Modules affected

- Core orchestrator:
- Agent(s):
- Skill/plugin:
- MCP adapter:
- CLI:
- Dashboard/UI:
- Python subsystem:
- Docs / conductor track:

## Acceptance criteria

- [ ] The behavior is implemented in the correct layer.
- [ ] Registries, prompts, or navigation entries are updated when needed.
- [ ] Logging and observability are present.
- [ ] Error handling, timeouts, and retries are defined for external calls.
- [ ] Existing behavior still works.

## Tests and validation

- [ ] Unit tests for the new behavior.
- [ ] Integration tests for any cross-surface path.
- [ ] Targeted build or smoke validation.
- [ ] Evidence recorded before handoff.

## Rollout notes

- [Describe migration, feature flag, backward compatibility, or sequencing notes.]

## Reviewer notes

- [Call out the most important risk or assumption for the reviewer.]
- [Mention what would make this change unsafe to merge.]
