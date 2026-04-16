---
description: "Reusable prompt for creating or refactoring a Brunella agent with explicit contracts, tool access, and failure handling."
name: "Brunella Agent"
argument-hint: "Role; inputs; outputs; tools; memory; failure handling; evaluation criteria"
agent: "brunella-architect"
---

# Brunella Agent Brief

## Role

[Describe the agent's purpose in one sentence.]

## Inputs

- [List required inputs, shape, and validation rules.]
- [List optional inputs and defaults.]
- [State what the agent must reject.]

## Outputs

- [Describe the success payload.]
- [Describe the failure payload.]
- [State whether the output must be deterministic or can be ranked/scored.]

## Tools

- [List allowed tools and why each one is needed.]
- [List tools that are intentionally not allowed.]
- [State whether the agent calls MCP tools, local services, or other agents.]

## Memory usage

- [State whether the agent reads from or writes to memory, cache, or tracks.]
- [State what must be persisted, summarized, or redacted.]
- [State any retention or cleanup rule.]

## Failure handling

- [Explain retry behavior, fallback behavior, and stop conditions.]
- [State what should happen on validation failure or tool failure.]
- [State whether the agent should escalate or return a structured error.]

## Evaluation criteria

- [How do we know the agent is correct?]
- [What tests or review checks prove it?]
- [What would count as a regression?]

## Registration checklist

- [ ] Agent file created in `.github/agents/`.
- [ ] Registry updated if the agent is runtime-visible.
- [ ] Prompt or template updated.
- [ ] Tests or simulation path documented.
- [ ] Logging and observability defined.

## Example usage

[Paste a short example task and the expected shape of the answer.]
