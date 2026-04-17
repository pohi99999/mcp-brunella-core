# Brunella Copilot Instructions

Use `README.md` as the master guide. If docs conflict, prefer `README.md`, then this file, then `AGENTS.md`, then `docs/ai/README.md`.

## Session bootstrap

1. Run sync first: `scripts/sync.bat`, `./scripts/sync.ps1`, or `bash scripts/sync.sh`
2. Read, in order:
   - `.ai/BOOTSTRAP.md`
   - `conductor/tracks.md`
   - `.ai/FOSZAL.md`
   - `.ai/copilot.md`
3. If the task belongs to an active track, also read:
   - `conductor/tracks/<id>/meta.json`
   - `conductor/tracks/<id>/plan.md`
   - `conductor/tracks/<id>/spec.md` when present
4. Keep sessions small: one active track or feature at a time; re-read targeted files instead of scanning the whole repo.

## Architecture at a glance

- Brunella is a modular multi-agent system, not a single assistant.
- `src/` is the Node.js/TypeScript control plane: Express routes, MCP server, CLI, dashboard backend, orchestration, hooks, and registries.
- `myai/` is the Python subsystem: FastAPI, FastMCP, browser/RAG/ML helpers.
- `src/index.ts` starts the web server first and defers heavy initialization so `/ping` stays fast.
- `src/server/routes/index.ts` is the lazy-loaded HTTP mount table; register routes there, not in `web.ts`.
- `src/server/registry.ts` preserves both MCP handlers and JSON schemas.
- `mcp_servers.json` is the declarative MCP startup manifest; keep retries, env, and platforms there.
- `src/agents/registry.json` is the canonical TypeScript agent registry; `myai/agents/*.toml` are dynamic agents.
- `.agents/skills/` is the repo-level skill library; `.claude/skills/` is the compatibility mirror.
- `.github/agents/` and `.github/prompts/` hold repo-level personas and prompt templates.
- `src/dashboard/lib/navigation.tsx` and `src/cli.ts` are parallel user-facing surfaces.
- `conductor/` owns track state, DoD evidence, and closure history.
- `src/core/autonomousInfraRuntime.ts` owns the `copilotFeedbackChannel` singleton; do not create a second one.
- `docs/ai/README.md` is the docs index for Copilot onboarding and MCP guidance.
- `docs/ai/brunella-skill-catalog.md` maps dashboard surfaces to skills.

## Build, test, and lint

- `npm run build` - TypeScript build plus registry/TRIZ asset copy.
- `npm run build:stable` - Node + dashboard build.
- `npm run test:fast` - fast pre-push suite.
- `npm test` - full build + Vitest suite.
- `npx vitest run test/foo.test.ts` - single Vitest file.
- `npm run test:dashboard` - dashboard-specific tests.
- `npm run test:ui` - UI tests.
- `npm run test:e2e` - Playwright end-to-end suite.
- `npm run lint` / `npm run lint:fix` - ESLint.
- `cd myai && uv sync` - Python dependency sync.
- `cd myai && pytest tests/` - Python suite.
- `cd myai && pytest tests/test_<name>.py` - single Python test file.

## Key conventions

### TypeScript

- ESM local imports must use `.js`.
- Prefer `unknown` plus type guards; avoid `any`.
- Use `logInfo`, `logWarn`, `logError`, or `Logger`; do not use `console.log`.
- If you implement `IAgent` directly, reset status in `finally`.
- Use Vitest, not Jest.
- In tests, `fileParallelism: false` means files share one fork; do not assume isolation between files.

### Python

- Use `uv`, not pip.
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
- Keep every tool path observable; integrations need timeouts, retries, logging, and explicit failure handling.
- Keep `mcp_servers.json` declarative and secret-free; use env vars or secret stores for credentials.
- `conductor/tracks.md` is the system-of-record index; do not hand-edit generated track state unless the workflow requires it.
- Use specialized repo agents when work spans planning, implementation, review, or delivery: `brunella-architect`, `brunella-implementer`, `brunella-reviewer`, `brunella-delivery-lead`.
- Self-improvement workflows (`bas-self-reflect`, `bas-golden-dataset-enricher`, `bas-pattern-scout`) are singleton paths tied to the autonomous infra; do not create ad hoc duplicates.
- Prefer Hungarian for user-facing replies when the user writes Hungarian or explicitly asks for it.

## When to ask

- The layer is unclear.
- The task crosses orchestration, domain logic, and UI without a clear owner.
- The requirements do not define inputs, outputs, or failure behavior.
- A new integration lacks a security, logging, or retry plan.
