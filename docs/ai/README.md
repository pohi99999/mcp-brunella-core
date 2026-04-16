# Brunella AI Docs Index

This folder collects the human-readable AI operating-model docs for Brunella.

Use this index when you need the Copilot onboarding path or MCP integration rules without scanning the entire repo.

## Canonical source order

If the docs conflict, read them in this order of authority:

1. `README.md` — master guide and project-wide bootstrap
2. `.github/copilot-instructions.md` — always-on Copilot contract
3. `AGENTS.md` — repo bootstrap and handoff rules
4. `docs/ai/README.md` — navigation index and asset map
5. `docs/ai/brunella-skill-catalog.md` — dashboard surface to skill map and canonical `.agents/skills/` source of truth
6. `docs/ai/*.md` — operational guidance
7. `.github/agents/*.agent.md` / `.github/prompts/*.prompt.md` — execution templates and personas
8. `.agents/skills/*.md` — repo-level Copilot skills; `.claude/skills/*.md` is a compatibility mirror

## Start here

- [Brunella Copilot Operating Model](./brunella-copilot-operating-model.md) — Copilot session flow, context discipline, and Explore/Plan/Task/Code-review.
- [Brunella MCP Integration](./brunella-mcp-integration.md) — MCP server classes, security boundaries, timeouts, retries, and logging.

## Related onboarding files

- [`README.md`](../../README.md) — master guide and top-level docs map.
- [`.github/copilot-instructions.md`](../../.github/copilot-instructions.md) — always-on Copilot contract.
- [`AGENTS.md`](../../AGENTS.md) — repository-wide bootstrap and handoff rules.
- [`.ai/BOOTSTRAP.md`](../../.ai/BOOTSTRAP.md) — session quick start.
- [`.ai/FOSZAL.md`](../../.ai/FOSZAL.md) — unified session history.
- [`.ai/copilot.md`](../../.ai/copilot.md) — Copilot session notes.

## Repo-level custom agents

| File | Purpose |
| --- | --- |
| [`.github/agents/brunella-architect.agent.md`](../../.github/agents/brunella-architect.agent.md) | Architecture and boundary decisions |
| [`.github/agents/brunella-implementer.agent.md`](../../.github/agents/brunella-implementer.agent.md) | Feature implementation with tests |
| [`.github/agents/brunella-reviewer.agent.md`](../../.github/agents/brunella-reviewer.agent.md) | Safety, regression, and maintainability review |
| [`.github/agents/brunella-delivery-lead.agent.md`](../../.github/agents/brunella-delivery-lead.agent.md) | Track prioritization, planning, and risk control |
| [`.github/agents/brunella-orchestrator.agent.md`](../../.github/agents/brunella-orchestrator.agent.md) | Multi-agent delegation and workflow coordination |

> Any other `.agent.md` files in `.github/agents/` should be treated as legacy or experimental until their persona and purpose are clear. The current `my-agent.agent.md` file is a broad compatibility mirror of repo guidance, not a first-class Brunella persona.

## Prompt templates

| File | Purpose |
| --- | --- |
| [`.github/prompts/brunella-feature.prompt.md`](../../.github/prompts/brunella-feature.prompt.md) | Canonical prompt for new Brunella feature work |
| [`.github/prompts/brunella-agent.prompt.md`](../../.github/prompts/brunella-agent.prompt.md) | Template for creating a new Brunella agent |
| [`.github/prompts/brunella-skill.prompt.md`](../../.github/prompts/brunella-skill.prompt.md) | Template for creating a new Brunella skill / plugin |
| [`.github/prompts/new-feature.prompt.md`](../../.github/prompts/new-feature.prompt.md) | Legacy EPP v2 feature alias; prefer `brunella-feature.prompt.md` for new work |

## Skill catalog

Brunella Copilot skills live in `.agents/skills/<skill-name>/SKILL.md`. The catalog below maps those skills to the major dashboard surfaces so future onboarding stays aligned with the actual UI.

| File | Purpose |
| --- | --- |
| [`.agents/skills/paios/SKILL.md`](../../.agents/skills/paios/SKILL.md) | `/paios` and PAIOS orchestrator chat surface |
| [`.agents/skills/brunella-studio/SKILL.md`](../../.agents/skills/brunella-studio/SKILL.md) | `Brunella Studio` video / post-production workflow |
| [`.agents/skills/mission-control-ops/SKILL.md`](../../.agents/skills/mission-control-ops/SKILL.md) | Mission Control, system health, process and service operations |
| [`.agents/skills/ai-agent-governance/SKILL.md`](../../.agents/skills/ai-agent-governance/SKILL.md) | AI & Agents governance, registry, kernels, self-improvement |
| [`.agents/skills/knowledge-memory-intelligence/SKILL.md`](../../.agents/skills/knowledge-memory-intelligence/SKILL.md) | Knowledge, memory, preferences, and vector intelligence surfaces |
| [`.agents/skills/track-lifecycle-quality/SKILL.md`](../../.agents/skills/track-lifecycle-quality/SKILL.md) | Track generator, conductor monitor, and closure quality flow |
| [`.agents/skills/edge-fleet-automation/SKILL.md`](../../.agents/skills/edge-fleet-automation/SKILL.md) | CEAN, Cloudflare, swarm, workflow, and edge fleet automation |
| [`.agents/skills/enterprise-services/SKILL.md`](../../.agents/skills/enterprise-services/SKILL.md) | Enterprise suite, HR, onboarding, grants, law, property ops |
| [`.agents/skills/revenue-finance-ops/SKILL.md`](../../.agents/skills/revenue-finance-ops/SKILL.md) | Sales, campaigns, invoice, bookkeeping, and reconciliation flows |
| [`.agents/skills/system-observability-admin/SKILL.md`](../../.agents/skills/system-observability-admin/SKILL.md) | Telemetry, logs, traces, admin, model router, and scheduled tasks |

## Compatibility note

- New repo-level custom agents should use the `.agent.md` suffix.
- The `.md` siblings currently present for Brunella architect/implementer/reviewer are compatibility mirrors.
- Future additions should follow the `.agent.md` convention unless a repo-specific loader explicitly requires otherwise.
