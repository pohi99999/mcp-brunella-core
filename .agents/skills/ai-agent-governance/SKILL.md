---
name: ai-agent-governance
description: "Use when the user works on AI & Agents governance, registries, kernels, agent factory, or self-improvement surfaces."
---

# AI & Agents Governance

Use this skill for the Brunella agent ecosystem, not for generic app logic.

## Trigger conditions

- AI & Agents
- agent registry governance
- kernel pipeline
- agent factory
- self-improvement
- ephemeral agents
- Copilot Orchestrator / Commander

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`copilot-orchestrator`, `copilot-commander`, `kernel-pipeline`, `assistant-blueprint`, `phoenix`, `phoenix-flywheel`, `zero-prompt-notifications`, `ephemeral-agents`, `learning-loop`, `self-improvement`, `predictive-decision`, `world-perception`, `federation`, `management`, `agent-diagnostics`, `agent-registry-governance`, `agent-factory`, `decomposer`, `incubator`, `knowledge`, `memory`, `cognitive-memory`, `user-preferences`, `developer`, `edge`, `robotkez`, `browser-copilot`, `jules`, `viktoria-phygital`, `ai-agent-briefing`)
- `src/agents/registry.json`
- `myai/agents/*.toml`
- `.github/agents/*.agent.md`
- `.github/prompts/*.prompt.md`
- `src/core/conductor.ts`
- `src/core/autonomousInfraRuntime.ts`

## Do

- Keep agent contracts explicit: inputs, outputs, failure behavior.
- Update the registry, prompt, and docs together when an agent changes.
- Prefer small composable agents over a giant shared prompt.
- Make learning or reflection steps observable.

## Don't

- Add agent behavior directly into the UI layer.
- Hide side effects inside implicit memory writes.
- Introduce a new agent without its prompt / registry / validation trail.

## Validation

- The registry and prompt assets point to the same capability.
- The dashboard surface and the runtime behavior agree.
- Any self-improvement path is documented and auditable.
