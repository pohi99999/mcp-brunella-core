# Brunella Copilot Instructions

Use `README.md` as the master guide. If docs conflict, prefer `README.md`, then this file, then `docs/AGENTS.md`, then `docs/ai/README.md`.

## Session bootstrap

1. Run sync first: `scripts/sync.bat`, `./scripts/sync.ps1`, or `bash scripts/sync.sh`.
2. Read only the current context:
   - `.ai/BOOTSTRAP.md`
   - `conductor/tracks.md`
   - `.ai/FOSZAL.md`
   - `.ai/copilot.md`
   - active track `meta.json`, `plan.md`, and `spec.md` when relevant
3. Keep one active track or feature per session.

## Build, test, and lint

- `npm run build` - TypeScript build plus registry/TRIZ asset copy.
- `npm run build:stable` - Node + dashboard build.
- `npm run build:ui` - dashboard-only build.
- `npm run test:fast` - fast pre-push suite.
- `npm test` - full build + Vitest suite.
- `npx vitest run test/foo.test.ts` - single Vitest file.
- `npm run test:dashboard` - dashboard Vitest config.
- `npm run test:ui` - UI Vitest config.
- `npm run test:e2e` - Playwright suite.
- `npm run lint` / `npm run lint:fix` - ESLint.
- `cd myai && uv sync` - Python dependency sync.
- `cd myai && pytest tests/` - Python suite.
- `cd myai && pytest tests/test_<name>.py` - single Python test file.
- `cd myai && uvicorn server:app --reload --port 8000` - Python API dev server.
- `npm run smoke` / `npm run health` - fast system checks.

## Architecture at a glance

- Brunella is a modular multi-agent system, not a single assistant.
- `src/` is the Node.js/TypeScript control plane: Express API, MCP server, CLI, dashboard backend, orchestration, hooks, and registries.
- `myai/` is the Python subsystem: FastAPI, FastMCP, browser automation, RAG, and ML helpers.
- `src/index.ts` starts the web server first and defers heavy initialization so `/ping` stays fast.
- `src/server/routes/index.ts` is the lazy-loaded HTTP mount table; register routes there, not in `web.ts`.
- `src/server/registry.ts` stores MCP handlers and JSON schemas together.
- `mcp_servers.json` is the declarative MCP startup manifest; keep retries, env, and platforms there.
- `src/agents/registry.json` is the TypeScript agent catalog; `myai/agents/*.toml` are dynamic agents.
- `src/dashboard/lib/navigation.tsx` and `src/cli.ts` are parallel user-facing surfaces.
- `conductor/` owns track state, DoD evidence, and closure history.
- `src/core/autonomousInfraRuntime.ts` owns the `copilotFeedbackChannel` singleton; do not create a second one.
- `docs/ai/README.md` is the docs index for Copilot onboarding and MCP guidance.
- `docs/ai/brunella-copilot-operating-model.md` explains the Explore/Plan/Task/Code-review flow.

## Key conventions

### TypeScript

- ESM local imports must use `.js`.
- Prefer `unknown` plus type guards; avoid `any`.
- Use `logInfo`, `logWarn`, `logError`, or `Logger`; do not use `console.log`.
- If you implement `IAgent` directly, reset status in `finally`; `BaseAgent` already handles this.
- Use Vitest, not Jest.
- In tests, `fileParallelism: false` means files share one fork; do not assume isolation between files.

### Python

- Use `uv`, not `pip`.
- Cross-boundary data must use Pydantic models; add shared models in `myai/pydantic_models.py`.
- Use ASCII log prefixes on Windows (`[OK]`, `[WARN]`, `[ERROR]`, etc.); avoid emoji.
- `GET /health` in FastAPI must return `{"status": "ok"}`.
- Guard optional heavy imports such as LanceDB or browser-use.
- Use `browser-use` for LLM-driven browser automation; raw Playwright is for deterministic scripted flows.

### Repo-specific

- New routes go in `src/server/routes/index.ts`.
- New MCP tools go in `src/server/registry.ts`.
- New dashboard items go in `src/dashboard/lib/navigation.tsx`.
- New CLI commands go in `src/cli.ts` and the relevant command module.
- New user-facing capabilities usually need both dashboard and CLI coverage.
- Keep `mcp_servers.json` declarative and secret-free; use env vars or secret stores for credentials.
- Do not hand-edit `conductor/tracks.md`; treat it as the system-of-record index.
- Use specialized repo agents when work spans planning, implementation, review, or delivery: `brunella-architect`, `brunella-implementer`, `brunella-reviewer`, `brunella-delivery-lead`.
- Self-improvement workflows (`bas-self-reflect`, `bas-golden-dataset-enricher`, `bas-pattern-scout`) are singleton paths tied to the autonomous infra; do not create ad hoc duplicates.
- Prefer Hungarian for user-facing replies when the user writes Hungarian or explicitly asks for it.
- If the layer is unclear, ask before touching multiple surfaces.

## Reference docs

- `README.md`
- `CONTRIBUTING.md`
- `CLAUDE.md`
- `docs/AGENTS.md`
- `docs/ai/README.md`
- `docs/ai/brunella-mcp-integration.md`