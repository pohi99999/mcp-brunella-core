# Brunella Copilot Instructions

Use `README.md` as the human-facing master guide. This file is the always-on Copilot operating contract for Brunella.

## Bootstrap order

1. Run a sync first: `scripts/sync.bat`, `./scripts/sync.ps1`, or `bash scripts/sync.sh`
2. Read, in this order:
   - `.ai/BOOTSTRAP.md`
   - `conductor/tracks.md`
   - `.ai/FOSZAL.md`
   - `.ai/copilot.md`
3. If the task belongs to an active track, also read:
   - `conductor/tracks/<id>/meta.json`
   - `conductor/tracks/<id>/plan.md`
   - `conductor/tracks/<id>/spec.md` when present
4. If a more specific instruction file exists under `.github/instructions/`, follow it for that file set.

## High-level architecture

- Brunella is a modular multi-agent system, not a monolithic assistant.
- `src/` is the Node.js/TypeScript control plane: Express routes, MCP server, CLI, dashboard backend, orchestration, hooks, and registries.
- `src/index.ts` boots the web server first and defers heavy initialization so `/ping` stays fast.
- `src/server/routes/index.ts` is the lazy-loaded HTTP mount table; register new routes there, not in `web.ts`.
- `src/server/registry.ts` patches `server.tool()` so MCP tools keep both their handlers and JSON schemas.
- `myai/` is the Python subsystem: FastAPI, FastMCP, browser/RAG/ML helpers.
- `myai/server.py` exposes the HTTP API and model endpoints; `myai/mcp_server.py` exposes Python tools over FastMCP.
- `src/agents/registry.json` is the canonical TypeScript agent registry; `myai/agents/*.toml` are dynamic agents; `src/skills/` holds runtime skills/plugins; `.agents/skills/` holds the repo-level Copilot skill library; `.claude/skills/` mirrors it for compatibility.
- `.github/agents/` contains repo-level Copilot agents; `.github/prompts/` contains reusable prompt templates.
- `conductor/` owns track state, DoD evidence, and closure history.
- `mcp_servers.json` is the declarative MCP startup manifest.
- Default baseline MCP tools are `brunella-core`, `filesystem`, `memory`, `sequential-thinking`, and `fetch`.
- `src/core/autonomousInfraRuntime.ts` owns the `copilotFeedbackChannel` singleton; do not create a second instance.
- `src/core/conductor.ts` owns the 8-stage kernel pipeline.
- `src/dashboard/lib/navigation.tsx` and `src/cli.ts` are parallel user-facing surfaces.
- `docs/ai/README.md` is the human-readable AI docs index; `docs/ai/brunella-skill-catalog.md` maps dashboard surfaces to skills; `docs/ai/` holds the operating-model and MCP integration guides.
- Repo-level Brunella agents: `brunella-architect`, `brunella-implementer`, `brunella-reviewer`, `brunella-delivery-lead`.

## Build, test, and lint

- `npm run build`: TypeScript build plus registry/TRIZ asset copy.
- `npm run build:stable`: full Node + dashboard build.
- `npm run test:fast`: fast pre-push suite.
- `npm test`: full build + Vitest suite.
- `npx vitest run test/foo.test.ts`: single Vitest file.
- `npm run test:dashboard`: dashboard-specific Vitest config.
- `npm run test:ui`: UI-specific Vitest config.
- `npm run test:e2e`: Playwright end-to-end suite.
- `npm run lint` / `npm run lint:fix`: repo ESLint.
- `cd myai && uv sync`: Python dependency sync.
- `cd myai && pytest tests/`: Python suite.
- `cd myai && pytest tests/test_<name>.py`: single Python test file.

## Self-improvement loop agents

- `bas-self-reflect` — use after track closure or on explicit post-track reflection requests; it reviews recent `FOSZAL.md` entries and writes backlog proposals.
- `bas-golden-dataset-enricher` — use after a successful, high-signal tool or agent run to capture a training pair for the golden dataset pipeline.
- `bas-pattern-scout` — use on a weekly cadence or when the registry/agent map needs consolidation analysis.
- The single source of truth for self-improvement feedback ingestion is `src/core/autonomousInfraRuntime.ts` via the exported `copilotFeedbackChannel`; do not instantiate a second channel elsewhere.
- `copilotCognitiveBridge.reflect()` is the canonical aggregation path that updates the golden dataset and GraphRAG layers.

## Design rules

- Prefer small composable agents over giant all-in-one agents.
- Prefer explicit contracts: input schema, output schema, failure schema.
- Prefer config-driven registration over hardcoded branching.
- Separate orchestration logic from domain logic.
- Separate prompt assets from runtime code.
- Every tool call path must be observable.
- Avoid hidden side effects.
- Every new integration must define timeouts, retries, logging, and error handling.
- Skills/plugins must be discoverable, documented, and testable.
- Choose the narrowest layer that fits the job: core orchestrator, agent, skill/plugin, MCP adapter, or UI/admin layer.

## Working conventions

### TypeScript

- ESM imports must use `.js` for local modules.
- Prefer `unknown` plus type guards over `any`.
- Use `logInfo`, `logWarn`, `logError`, or `Logger`; avoid `console.log`.
- If you implement `IAgent` directly, reset status in `finally`; `BaseAgent` already handles this.
- Keep imports and side effects lazy when startup cost matters.
- Use Vitest only; no Jest.

### Python

- Use `uv` for dependency management.
- Use Pydantic models for cross-boundary data.
- Use ASCII log prefixes on Windows.
- Keep FastAPI/FastMCP handlers explicit and typed.

## Copilot CLI operating model

- **Explore**: read only the minimum context needed to understand the problem.
- **Plan**: decide the layer, scope, contracts, risks, and validation path before editing.
- **Task**: implement one bounded slice with tests and docs.
- **Code-review**: inspect the diff for security, regressions, coupling, observability, and maintainability before commit.
- Use Hungarian for user-facing replies when the user writes Hungarian or explicitly asks for it.
- For Maestro-style orchestration tasks, load `.github/prompts/brunella-maestro.prompt.md` or route through `copilot-cli-orchestrator`.
- If `copilot-llm-gateway` is available, pair it with `litellm_config.yaml` and the repo `.env` values to route Gemini traffic through the local LiteLLM proxy.
- Treat the gateway as optional; if it is not active, stay on native Copilot and do not assume Gemini routing.

Keep sessions small:

- one active track or feature at a time
- targeted file reads instead of whole-repo scans
- use diffs and specific tests when possible
- stop reading once you have enough evidence to decide

## Validation checklist

- `npm run build`
- `npm run test:fast`
- `npm test` for larger changes or track closure
- `npm run build:ui` when dashboard code changes
- `cd myai && uv sync`
- `cd myai && pytest tests/`
- `cd myai && pytest tests/test_<name>.py` for targeted Python work

## MCP and external integrations

- Keep MCP startup declarative in `mcp_servers.json`.
- Use `requiredEnv` and secret stores for credentials.
- Treat all tool input as untrusted.
- Canonicalize file paths and allow-list workspace roots.
- Parameterize shell commands and enforce timeouts.
- Prefer retry/backoff for networked tools.

## When to stop and ask

- The layer is unclear.
- The task crosses orchestration, domain logic, and UI without a clear owner.
- The requirements do not define inputs, outputs, or failure behavior.
- A new integration lacks a security, logging, or retry plan.

## Session hygiene

- Re-read the relevant files instead of relying on stale memory.
- Do not edit generated files directly when a generator exists.
- If FOSZAL needs updating, update `.ai/copilot.md` and re-run `python scripts/sync_foszal.py`.


