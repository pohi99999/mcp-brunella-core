# Copilot Instructions - Brunella Agent System





> Source of truth: `README.md`. If anything conflicts, follow `README.md`.

## Start here



Read, in order:

- `README.md`
- `.ai/BOOTSTRAP.md`
- `conductor/tracks.md`
- `.ai/FOSZAL.md`
- `.ai/copilot.md` or the agent-specific log for your model

If the dev stack is running and you need a fast snapshot, `node scripts/copilot-dashboard.js --quick-status` is the quickest runtime check.

## Build, test, lint

- `npm run build` - TypeScript build; also copies `src/agents/registry.json` and TRIZ data into `build/`.
- `npm run build:ui` - dashboard build with its separate Vite/TS config.
- `npm run test:fast` - fast Vitest subset; run before every commit.
- `npm test` - full build + Vitest suite; run before push or track closure.
- `npx vitest run test/foo.test.ts` - run a single test file.
- `npm run test:watch` - watch mode.
- `npm run lint` / `npm run lint:fix`
- `npm run test:e2e`
- `npm run smoke`
- Python: `cd myai && uv sync`, `cd myai && pytest tests/`, `uvicorn server:app --reload --port 8000`
- Windows full stack: `start-full.bat`

## Architecture at a glance

- `src/index.ts` starts both MCP stdio and the Express server on `:3000`; both paths register tools through `registerAllTools()`.
- `src/cli.ts` is the CLI entry point; the CLI is Hungarian, menu-driven, and built with Commander/inquirer.
- `src/server/routes/index.ts` is the central API router. Search for existing route implementations before adding a new route file.
- `src/dashboard/lib/navigation.tsx` is the dashboard registry. New panels must be registered there, not only created as components.
- `src/agents/` contains the agent system (`AgentManager`, `BaseAgent`, and `registry.json`).
- `src/tools/` contains MCP tool definitions and handlers; `src/server/registry.ts` wires them into the server.
- `src/core/modelRouter.ts` and `src/core/bifrost_gateway.ts` centralize model selection and provider fallback.
- `src/core/checkpoint.ts` and `src/core/phoenixEventBus.ts` implement checkpointing and retry/recovery.
- `myai/` is the Python subsystem (FastAPI, FastMCP, Pydantic, `uv`).
- `src/utils/pythonShell.ts` is the bridge from Node to Python.

## Key conventions

- `README.md` wins when docs conflict.
- ESM imports must include `.js` extensions.
- TypeScript is strict; prefer `unknown` plus type guards over `any`.
- Never use `console.log`; use the repo logger.
- In agent code, always reset status to `idle` in a `finally` block.
- Vitest is the test runner; use `vi.fn()`, `vi.spyOn()`, and `vi.mock()` instead of Jest APIs.
- `src/dashboard/` is excluded from the main TS build; use `npm run build:ui` for UI work.
- New CLI commands must be Hungarian, menu-driven with `inquirer`, and use colorful output (`chalk`, `boxen`, `ora`).
- Branches should use prefixes like `feature/`, `fix/`, `perf/`, `docs/`, `refactor/`, `chore/`, or `test/`.
- Commit messages use Conventional Commits: `type(scope): subject`.
- Large changes should be tracked in `conductor/tracks/` and follow `PROPOSED -> ACTIVE -> TESTING -> COMPLETED -> ARCHIVED`.
- New features should generally include both a dashboard panel and a CLI command.
- Keep `.ai/<agent>.md` updated at the end of a session, then run `python scripts/sync_foszal.py`.
- Treat `package.json`, `src/agents/registry.json`, `src/index.ts`, `src/core/llm_client.ts`, `src/server/web.ts`, `src/server/registry.ts`, `.env`, `conductor/tracks.md`, and `.ai/FOSZAL.md` as protected unless explicitly requested.
- When changing routes or dashboard panels, register them in the central router/registry rather than relying on the component or route file alone.
- Use `uv` for Python dependencies; do not switch the Python subsystem to pip-based workflows.

## Practical reminders

- For route work, check whether the functionality already exists in an unregistered file before creating anything new.
- For dashboard work, prefer reusing existing panels/components and only register the new item once it is ready.
- For agent work, keep the registry and the implementation consistent.
