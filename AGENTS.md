# AGENTS.md

> Architecture reference: `README.md`
> Copilot operating contract: `.github/copilot-instructions.md`
> AI docs index: `docs/ai/README.md`
> AI operating model: `docs/ai/brunella-copilot-operating-model.md`
> MCP integration guide: `docs/ai/brunella-mcp-integration.md`

## What Brunella is

Brunella Agent System is a modular multi-agent operating system that combines:

- Node.js/TypeScript orchestration in `src/`
- Python AI services in `myai/`
- MCP tool routing and discovery
- CLI and dashboard user surfaces
- conductor tracks for scoped work and closure evidence

Brunella is not a single assistant. It is a coordinated system of agents, skills, prompts, tools, and workflows.

## Bootstrap

1. Sync first: `scripts/sync.bat`, `./scripts/sync.ps1`, or `bash scripts/sync.sh`
2. Read, in order:
   - `.ai/BOOTSTRAP.md`
   - `conductor/tracks.md`
   - `.ai/FOSZAL.md`
   - `.ai/copilot.md`
3. If an active track exists, read its `meta.json`, `plan.md`, and `spec.md`.
4. Confirm the affected layer before editing anything.

## Agent philosophy

- Prefer small composable agents.
- Prefer explicit contracts: input, output, failure.
- Prefer observable tool paths.
- Prefer configuration-driven registration over hardcoded branching.
- Keep prompt assets separate from runtime code.
- Avoid hidden side effects.
- Choose the narrowest layer that solves the task.

## Roles

| Role | What it does | When to use |
| --- | --- | --- |
| Planner | Scope, boundaries, dependencies, rollout | Before code |
| Researcher | Read files, search code, summarize facts | Discovery only |
| Executor | Implement a bounded slice, update tests/docs | Code changes |
| Reviewer | Block risky or drifting changes | Before commit/merge |
| Orchestrator | Coordinate multiple roles and keep scope tight | Multi-step tasks |

## When to create what

| Need | Create | Notes |
| --- | --- | --- |
| New workflow with state and coordination | Agent | Use explicit input/output/failure contracts |
| Thin reusable behavior over existing tools | Skill/plugin | Make it discoverable and testable |
| New transport or external system boundary | MCP adapter | Define timeout, retry, logging, and secrets handling |
| New UI/admin surface | Dashboard/CLI layer | Register it where users actually interact |

## Non-negotiable rules

- If you add a tool call path, make it observable.
- If you add an integration, define retries, timeouts, and error handling.
- If you touch shared surfaces, update tests and docs.
- If you touch an agent, keep the registry and prompt/template in sync.
- If you touch a skill, update discovery and registry files.
- If you touch MCP config, keep `mcp_servers.json` declarative.
- Do not rely on `console.log`; use structured logging.
- Do not use `any` when `unknown` plus a guard is enough.
- Do not add new hidden globals or side effects.

## Validation

- `npm run build`
- `npm run test:fast`
- `npm test` when the change is broad or track closure is involved
- `npm run build:ui` for dashboard changes
- `cd myai && uv sync && pytest tests/` for Python changes
- Ask for a reviewer pass if the change is risky or cross-cutting

## Handoff

Always report:

- what changed
- why it changed
- files touched
- validation run
- known limitations
- next step
