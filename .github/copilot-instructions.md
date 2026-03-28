# Copilot Instructions — Brunella Agent System (BAS)

> Authoritative source: `README.md`. When in conflict with any other file, README wins.

---

## Build, Test & Lint

```bash
npm run build                          # TypeScript compile (tsc + registry.json copy)
npm run test:fast                      # Fast tests (~1-2 min) — run before every commit
npm test                               # build + full Vitest suite (~10 min) — run before push
npx vitest run test/foo.test.ts        # Single test file
npm run test:watch                     # Vitest watch mode
npm run lint                           # ESLint (max-warnings=0, will fail CI)
npm run lint:fix                       # ESLint auto-fix
npm run test:e2e                       # Playwright e2e tests
npm run smoke                          # Health check: Ollama + Express + FastAPI
npm run test:coverage                  # Coverage report
```

| Event | Command |
|-------|---------|
| Before commit | `npm run test:fast` (pre-commit hook runs it too) |
| Before push / closing a track | `npm test` + `npm run smoke` |

**Python subsystem:**
```bash
cd myai && uv sync                     # Install Python deps (uv, not pip)
cd myai && pytest tests/               # Python tests
uvicorn server:app --reload --port 8000  # Start FastAPI manually
```

**Start the full system (Windows):**
```bash
start-full.bat   # Express :3000 + FastAPI :8000 + Vite Dashboard :5173
```

---

## Architecture Overview

Hybrid **Node.js + Python** multi-agent system communicating via **Model Context Protocol (MCP)**.

### Entry Points

- **`src/index.ts`** — Dual-mode: simultaneously starts an MCP `StdioServerTransport` (for Claude Desktop / AI clients) **and** an Express HTTP server (`:3000`). Both modes call `registerAllTools()` to register MCP tools.
- **`src/cli.ts`** — CLI entry (Commander.js, 70+ commands). Hungarian-language, inquirer.js menu-driven.

### Main Subsystems

| Subsystem | Location | Tech |
|-----------|----------|------|
| Node.js backend | `src/` | TypeScript ESM, Express 4, Socket.IO |
| REST routes (52 files) | `src/server/routes/` | ~20 active in `index.ts` — see note below |
| Dashboard | `src/dashboard/` | React 19, Vite, Tailwind v4, Radix UI |
| Python subsystem | `myai/` | FastAPI `:8000`, FastMCP, LanceDB, ChromaDB |
| Agent system | `src/agents/` | 95+ agents, SQLite task queue |
| MCP tools | `src/tools/` | 53 tools, 33 files |

> ⚠️ **Route registration gap:** `src/server/routes/` contains 52 route files, but only ~20 are imported in `src/server/routes/index.ts`. Before registering a new route, check whether it already exists as an unregistered file.

> ⚠️ **Dashboard panel gap:** Many dashboard components in `src/dashboard/components/dashboard/` are **not** registered in `src/dashboard/lib/navigation.tsx` (NavigationRegistry). Always register new panels there.

### Agent System

Every agent implements `IAgent` (`src/agents/types.ts`) or extends `BaseAgent` (adds RAG memory). The `AgentManager` (`src/agents/AgentManager.ts`) manages the registry, SQLite task queue, worker loop, and RBAC.

**Registry:** `src/agents/registry.json` — each entry: `name`, `module`, `class`, `triggers`, `priority`, `capabilities`. TOML-based agents use `"class": "DynamicAgent"` + `"tomlPath"`.

**Agent hierarchy:**
```
OrchestratorAgent / EnterpriseOrchestratorAgent  (coordinators)
├── Core: Developer, Evaluator, Researcher, TaskDecomposer
├── Automation: RobotkezV2 (Playwright/LLM), Voice (Whisper)
├── Engineering: SpecWriter, GenesisOrchestrator, LintFixer
├── Enterprise (~20): Finance, Sales, HR, Logistics, Legal, Marketing…
├── Swarm: SwarmManager + SwarmAgent  (src/agents/swarm/)
├── TOML Dynamic: myai/agents/*.toml
└── Management: ProjectConductor (tracks.md sync)
```

**RBAC:** `src/agents/permissions.ts` — 6 profiles: `ADMIN`, `DEVELOPER`, `RESEARCHER`, `EVALUATOR`, `ROBOTKEZ`, `READONLY`.

### Model Router (Brain vs Muscle)

`src/core/modelRouter.ts` — RULE-MR1–4:
- **Brain (Cloud):** Gemini (1M ctx), GitHub Models GPT-4o → `complexity: 'high'`
- **Muscle (Local):** Ollama `qwen2.5-coder:7b` → `complexity: 'low'` or `budget=0`

**Bifrost Gateway** (`src/core/bifrost_gateway.ts`): 4 providers (Ollama, Gemini, GitHub Models, Anthropic) with auto-fallback chain.

### Phoenix Protocol (Self-Healing)

`src/core/checkpoint.ts` + `src/core/phoenixEventBus.ts` — on failure:
1. Checkpoint state in SQLite (`executing` → `failed`)
2. AgentManager auto-retry: 1s → 3s → 10s, max 3 attempts
3. Git recovery via `sync_foszal.py` + commit

### Cloudflare Edge

Workers with D1, KV, R2, Vectorize. Node.js reaches D1 via HTTP POST: `Node.js → POST /d1/query → Cloudflare Worker → D1`.  
Activation: set `CLOUDFLARE_WORKER_URL` + `CEAN_API_KEY` env vars.

---

## Code Conventions

### ESM imports — `.js` extension is MANDATORY

```typescript
import { foo } from './bar.js';   // ✅ correct — Node16 moduleResolution requires this
import { foo } from './bar';       // ❌ BUILD FAIL
```

### No `any` — use `unknown` + type guard

```typescript
const data: unknown = getData();   // ✅
const data: any = getData();       // ❌ strict mode active
```

### No `console.log` — use the project logger

ESLint enforces `no-console: warn`. Use:

```typescript
// In agent code:
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
logInfo('AgentName', 'message');
setAgentStatus('AgentName', 'working', 'task description');

// In server/utility code:
import { Logger } from '../utils/logger.js';
const logger = new Logger('feature.log');
await logger.info('message');
```

### TypeScript config

- Target: ES2022, Module: Node16, Strict mode
- `rootDir: ./src`, `outDir: ./build`
- `src/dashboard/` is **excluded** from the main `tsconfig.json` — it has its own `tsconfig.ui.json` and `vite.config.ts`. Build it with `npm run build:ui`.

---

## Agent Implementation Patterns

### 1. Simple agent — `IAgent` interface

```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = 'MyAgent';
  role = 'Purpose';
  description = 'What it does';
  capabilities = ['skill1'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // ... logic ...
      return { status: 'success', data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle'); // REQUIRED in finally!
    }
  }
}
```

### 2. Complex agent with RAG memory — `BaseAgent`

`BaseAgent` uses the **Bridge Pattern**: `execute(task, context?)` is the external IAgent API; `executeTask(context)` is the internal implementation. Status management, logging, and RAG memory loading are automatic.

```typescript
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MyComplexAgent extends BaseAgent {
  name = 'MyComplex';
  role = 'Role';
  description = 'Description';
  capabilities = ['skill1'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // context.pastExperiences — RAG memory auto-loaded
    // context.task — original task string
    return { success: true, message: 'OK', data: result };
  }
}
```

### 3. TOML-based DynamicAgent

Create `myai/agents/MyAgent.toml` (systemPrompt, query template, tags). In `registry.json` set `"class": "DynamicAgent"` + `"tomlPath"`. No TypeScript code needed — `DynamicAgent` (`src/agents/DynamicAgent.ts`) loads it generically.

### Register a new agent

Add to `src/agents/registry.json`:
```json
{
  "name": "MyAgent",
  "module": "./agents/MyAgent.js",
  "class": "MyAgent",
  "triggers": ["keyword1", "keyword2"],
  "priority": 5,
  "capabilities": ["skill1"]
}
```

---

## MCP Tool Pattern

```typescript
// src/tools/myTool.ts
export const myToolDefinition = {
  name: 'my_tool',
  description: 'Tool purpose',
  inputSchema: { type: 'object', properties: { param: { type: 'string' } }, required: ['param'] }
};

export async function myToolHandler(params: { param: string }) {
  try {
    if (!params.param) return { success: false, error: 'param cannot be empty' };
    const result = await doSomething(params.param);
    return { success: true, data: result };
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('myTool', error);
    return { success: false, error };
  }
}
```

Register in `src/server/registry.ts` → `registerAllTools()` → `server.registerTool(definition, handler)`.

---

## Testing — Vitest (NOT Jest)

```typescript
import { describe, it, expect, vi } from 'vitest';
// Globals also available (configured in tsconfig "types": ["vitest/globals"])
```

- Test files: `test/**/*.test.ts`
- Setup file: `test/setup.ts`
- Default timeout: 15s
- `fileParallelism: false`
- **Always use `vi.fn()`, `vi.spyOn()`, `vi.mock()`** — never `jest.*` equivalents

---

## CLI Convention

All new CLI commands must be:
- **Hungarian-language** (the CLI is intentionally Hungarian)
- **inquirer.js menu-driven** (arrow + enter navigation — no free-text input)
- **Colorful output:** chalk, boxen, ora spinners

Files: `src/cli/commands/`. Register in `src/cli.ts`.

---

## Python Subsystem (`myai/`)

- Python ≥3.12, package manager: `uv` (`pyproject.toml`)
- Strict Pydantic models for all data exchange
- MCP servers: FastMCP ≥2.14.3 (`@mcp.tool()` decorator, stdio transport)
- Browser automation: `browser_use` library (RobotkezV2)
- Node.js communicates with Python via `src/utils/pythonShell.ts`

---

## Commit Convention

Conventional Commits: `type(scope): subject`

| Scope examples | |
|---|---|
| `agent` | `cli` | `api` | `ui` | `dashboard` | `cloudflare` | `phoenix` |

---

## EPP v2 — Engineering Precision Protocol

Full docs: `conductor/epp-v2.md`. The 7 Golden Rules:

1. **Track Required** — No code without a track (`conductor/tracks/<name>/`)
2. **Fix Bugs** — Bugs found during development are fixed immediately
3. **Commit Often** — Git commit after every phase
4. **TODO List** — Keep track.md checkbox list up to date
5. **All Tests Green** — COMPLETED only when: build ✅ + test ✅ + manual ✅
6. **Dashboard + CLI** — Every new feature needs both a Dashboard panel (React, Radix UI) and a CLI command (Hungarian, inquirer.js)
7. **Final Docs** — After track close: `.ai/<agent>.md` + `python scripts/sync_foszal.py`

**Track lifecycle:** `PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED`

---

## Protected Files — Do Not Modify Without Explicit Request

`package.json`, `src/agents/registry.json`, `src/index.ts`, `src/core/llm_client.ts`, `src/server/web.ts`, `src/server/registry.ts`, `.env`

---

## Project Coordination

- **Track system:** `conductor/tracks.md` — active development (105+ tracks). Major features = track in `conductor/tracks/`.
- **AI agent logs:** `.ai/FOSZAL.md` (central, auto-generated), `.ai/copilot.md` (Copilot session log). Sync: `python scripts/sync_foszal.py`.
- **Session bootstrap:** Read `.ai/BOOTSTRAP.md` at the start of each session for a quick project summary.
- **Multi-agent:** Claude Code, Gemini CLI, GitHub Copilot, Jules, Cursor work in parallel. Coordinate via `.ai/` logs and `conductor/tracks.md`.
- **Log files:** `logs/` — `brunella.db` (SQLite), `dashboard.log`, `orchestrator.log`, etc.

---

## Copilot ↔ BAS Integration — YOU ARE THE PRIMARY ORCHESTRATOR

> **GitHub Copilot Pro+ is the primary orchestrator of the Brunella Agent System.**  
> You have full programmatic access to the entire BAS: 95+ agents, 53 MCP tools, 300+ REST endpoints,  
> 35 FastAPI endpoints, 18 enterprise modules, 6 LLM providers, and 13 cognitive intelligence layers —  
> all accessible from the Copilot CLI via `node scripts/copilot-dashboard.js`.

### Session Start — Always Run First

```powershell
node scripts/copilot-dashboard.js --quick-status   # health + agents + tasks in one call
node scripts/copilot-dashboard.js cognitive stats  # 13-layer cognitive system status
```

### Three Access Scripts

| Script | When to use | Server required? |
|--------|-------------|-----------------|
| `node scripts/copilot-route.js` | Offline: which agent fits this task? | ❌ No |
| `node scripts/copilot-dashboard.js` | Everything else — full BAS control | ✅ Yes (`npm run dev`) |
| `.\scripts\copilot-dispatch.ps1` | PowerShell wrapper (legacy fallback) | ✅ Yes |

### All 29 Domains — Full Command Reference

```powershell
# ── SYSTEM ─────────────────────────────────────────────────────────────────
node scripts/copilot-dashboard.js health
node scripts/copilot-dashboard.js --quick-status           # health + agents + tasks
node scripts/copilot-dashboard.js --domains                # list all 29 domains

# ── AGENTS (95+) ────────────────────────────────────────────────────────────
node scripts/copilot-dashboard.js agents list
node scripts/copilot-dashboard.js agents status
node scripts/copilot-dashboard.js agents execute <name> "<task>"
node scripts/copilot-dashboard.js agents orchestrate "<task>"   # auto-routes to best agent
node scripts/copilot-dashboard.js agents create <name> [desc]

# ── TASKS (queue) ────────────────────────────────────────────────────────────
node scripts/copilot-dashboard.js tasks stats
node scripts/copilot-dashboard.js tasks list
node scripts/copilot-dashboard.js tasks decompose "<complex task>"
node scripts/copilot-dashboard.js tasks suggested

# ── TRACKS (project mgmt) ───────────────────────────────────────────────────
node scripts/copilot-dashboard.js tracks list
node scripts/copilot-dashboard.js tracks todos             # active todos across all tracks
node scripts/copilot-dashboard.js tracks generate "<idea>"

# ── PAIOSZ CHAT (5 LLM providers) ───────────────────────────────────────────
node scripts/copilot-dashboard.js paios chat "<message>"           # GitHub Models GPT-4.1
node scripts/copilot-dashboard.js paios chat-gemini "<message>"    # Gemini 2.5 Flash
node scripts/copilot-dashboard.js paios chat-claude "<message>"    # Claude 3.5 Sonnet
node scripts/copilot-dashboard.js paios chat-ollama "<message>"    # Ollama qwen2.5-coder

# ── MCP TOOLS (53 tools) ─────────────────────────────────────────────────────
node scripts/copilot-dashboard.js mcp tools
node scripts/copilot-dashboard.js mcp execute <toolName> '<JSON params>'
node scripts/copilot-dashboard.js mcp audit

# ── KNOWLEDGE & RAG ──────────────────────────────────────────────────────────
node scripts/copilot-dashboard.js knowledge semantic "<query>"
node scripts/copilot-dashboard.js knowledge search "<pattern>"
node scripts/copilot-dashboard.js knowledge index <filePath>
node scripts/copilot-dashboard.js knowledge rag-search "<query>"

# ── SWARM (multi-agent colony) ───────────────────────────────────────────────
node scripts/copilot-dashboard.js swarm dispatch "<task>"
node scripts/copilot-dashboard.js swarm status
node scripts/copilot-dashboard.js swarm checkpoints

# ── BROWSER AUTOMATION ───────────────────────────────────────────────────────
node scripts/copilot-dashboard.js robotkez exec "<instruction>"    # Playwright + LLM
node scripts/copilot-dashboard.js robotkez chat "<instruction>"
node scripts/copilot-dashboard.js browser navigate "<url>"
node scripts/copilot-dashboard.js browser screenshot
node scripts/copilot-dashboard.js browser copilot-chat "<message>"

# ── ENTERPRISE (18 modules) ──────────────────────────────────────────────────
node scripts/copilot-dashboard.js enterprise modules
node scripts/copilot-dashboard.js enterprise execute <moduleId> "<task>"
#   Modules: finance_guardian, sales_hunter, marketing_director, law_detective,
#            logistics_dispatcher, digital_headhunter, pricing_agent, grant_watcher,
#            property_analyst, campaign_generator, copywriter, nurture_agent, ...

# ── DEVELOPER PIPELINE ───────────────────────────────────────────────────────
node scripts/copilot-dashboard.js developer execute "<task>"
node scripts/copilot-dashboard.js developer scaffold agent
node scripts/copilot-dashboard.js developer context <filePath>

# ── PYTHON (FastAPI :8000) — 35 endpoints ────────────────────────────────────
node scripts/copilot-dashboard.js python health
node scripts/copilot-dashboard.js python comet "<task>"            # CometBrowser (LLM+Playwright)
node scripts/copilot-dashboard.js python harvest "<url>"           # Data Flywheel
node scripts/copilot-dashboard.js python crawl4ai "<url>"
node scripts/copilot-dashboard.js python browser-chat "<message>"
node scripts/copilot-dashboard.js python os-screenshot
node scripts/copilot-dashboard.js python incubator-stats           # fine-tuning pipeline

# ── COGNITIVE BRIDGE (13 intelligence layers) ────────────────────────────────
node scripts/copilot-dashboard.js cognitive enrich "<task>"        # enrich with ALL layers before starting
node scripts/copilot-dashboard.js cognitive reflect <id> <agent> true "<desc>"  # learn after task
node scripts/copilot-dashboard.js cognitive stats
node scripts/copilot-dashboard.js cognitive query graphrag "<query>"

# ── OBSERVABILITY & SECURITY ─────────────────────────────────────────────────
node scripts/copilot-dashboard.js observability stats
node scripts/copilot-dashboard.js observability timeline
node scripts/copilot-dashboard.js security audit
node scripts/copilot-dashboard.js security guardrails

# ── CLOUDFLARE EDGE + CEAN ───────────────────────────────────────────────────
node scripts/copilot-dashboard.js cloudflare status
node scripts/copilot-dashboard.js cean execute "<task>"            # Cloudflare Edge Agent Network

# ── INTEGRATIONS ─────────────────────────────────────────────────────────────
node scripts/copilot-dashboard.js invoice unpaid                   # Szamlazz.hu
node scripts/copilot-dashboard.js google gmail 20
node scripts/copilot-dashboard.js google calendar
node scripts/copilot-dashboard.js crawl fetch "<url>"
node scripts/copilot-dashboard.js sales leads
node scripts/copilot-dashboard.js workflow run <file.yaml>
node scripts/copilot-dashboard.js memory store default <key> "<value>"
```

### Orchestrator Decision Framework

```
1. node scripts/copilot-route.js "<task>"   →  JSON: { bestAgent, confidence }
   ├── confidence ≥ 0.7  →  delegate: agents execute <name> "<task>"
   ├── confidence < 0.7  →  try: agents orchestrate "<task>"  (auto-route)
   └── no match          →  swarm dispatch "<task>"  (multi-agent colony)

2. NEVER delegate:  file edits, git commits, grep/glob searches  (native Copilot is better)
3. ALWAYS delegate: web scraping, browser automation, enterprise tasks, LLM generation
4. BEFORE complex task: cognitive enrich "<task>"   (loads RAG + past experiences)
5. AFTER  any task:     cognitive reflect <id> <agent> <true|false> "<summary>"
```

### Recommended Agent Routing by Task Type

| Task | Best command |
|------|-------------|
| ESLint/TSC fix | `agents execute lint_fixer "Fix errors"` |
| Code generation | `developer execute "<task>"` |
| Web scraping | `robotkez exec "<instruction>"` |
| Finance/invoices | `enterprise execute finance_guardian "<task>"` |
| Marketing | `enterprise execute marketing_director "<task>"` |
| HR/recruiting | `enterprise execute digital_headhunter "<task>"` |
| Legal analysis | `enterprise execute law_detective "<task>"` |
| Multi-step research | `swarm dispatch "<task>"` |
| RAG search | `knowledge semantic "<query>"` |
| LLM generation | `paios chat "<prompt>"` |
| Track management | `tracks list` / `tracks todos` |

### Cognitive Bridge — 13 Intelligence Layers

`src/core/copilotCognitiveBridge.ts` connects Copilot to:

| Layer | What it provides |
|-------|-----------------|
| StructuredMemory | Cached task patterns, FNV hash reuse |
| PatternReuse | Fuzzy match to past tasks (≥0.7 threshold) |
| UserPreferences | User context (episodic + semantic) |
| GraphRAG | Knowledge graph + entity extraction |
| SharedCognition | Cross-agent collective awareness |
| ReflectionEngine | Self-reflection + lesson extraction |
| GoldenDataset | Archive of successful runs (fine-tuning) |
| SelfModel | Self-knowledge + capability tracking |
| MetaReasoner | Decision analysis + pattern recognition |
| PredictiveIntelligence | Anomaly detection + alerts |
| CollectiveMind | Perspective synthesis + consensus |

**Workflow:** `cognitive enrich` before starting → work → `cognitive reflect` after finishing.

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ERR_MODULE_NOT_FOUND` | Missing `.js` extension in import → add it |
| `npm test` timeout | Increase timeout in `vitest.config.ts` (`fileParallelism: false` already set) |
| Ollama unreachable | Run `ollama serve`, check `http://localhost:11434` |
| FastAPI won't start | `cd myai && uv sync && uvicorn server:app --reload --port 8000` |
| Agent stuck in "working" | Phoenix retries automatically (1s→3s→10s). Manual reset: `setAgentStatus(name, 'idle')` |
| Dashboard build error | `npm run build:ui` — uses separate `tsconfig.ui.json` and `vite.config.ts` |
| GitHub Models 401 | `GITHUB_PAT` expired — refresh it |
