# Brunella AI Docs Index

This folder collects the human-readable AI operating-model docs for Brunella.

Use this index when you need the Copilot onboarding path or MCP integration rules without scanning the entire repo.

## Canonical source order

If the docs conflict, read them in this order of authority:

1. `README.md` — master guide and project-wide bootstrap
2. `.github/copilot-instructions.md` — always-on Copilot contract
3. `AGENTS.md` — repo bootstrap and handoff rules
4. `docs/ai/README.md` — navigation index and asset map
5. `docs/ai/*.md` — operational guidance
6. `.github/agents/*.agent.md` / `.github/prompts/*.prompt.md` — execution templates and personas

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

## Compatibility note

- New repo-level custom agents should use the `.agent.md` suffix.
- The `.md` siblings currently present for Brunella architect/implementer/reviewer are compatibility mirrors.
- Future additions should follow the `.agent.md` convention unless a repo-specific loader explicitly requires otherwise.
