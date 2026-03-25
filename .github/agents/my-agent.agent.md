# Copilot Instructions — Brunella Agent System (BAS)

> Master dokumentum: `README.md` — ha ellentmondást találsz bármely fájllal, a README az irányadó.

## Build, Test, Lint

```bash
npm run build      
                   # TypeScript fordítás (tsc + registry.json/TRIZ másolás)
npm run test:fast                     # Gyors tesztek (~1-2 perc) — commit előtt, e2e/phase/swarm NÉLKÜL
npm test                              # Build + teljes Vitest suite (~10 perc) — track lezáráskor/push előtt
npx vitest run test/foo.test.ts       # Egy konkrét teszt fájl
npm run test:watch                    # Vitest watch mód (fejlesztés közben)
npm run lint                          # ESLint (max-warnings=0)
npm run lint:fix                      # ESLint auto-fix
npm run test:e2e                      # Playwright e2e tesztek
npm run smoke                         # Health check: Ollama, Express, FastAPI ellenőrzés
npm run test:coverage                 # Lefedettségi jelentés
```

**Mikor mit futtass:**
| Esemény | Parancs |
|---------|---------|
| Commit előtt | `npm run test:fast` (pre-commit hook is futtatja) |
| Track lezárásakor / Push előtt | `npm test` + `npm run smoke` |
| Napi fejlesztés | `npm run test:fast` elegendő |

**Python alrendszer:**
```bash
cd myai && uv sync                    # Python függőségek (uv a csomagkezelő)
cd myai && pytest tests/              # Python tesztek
```

**Rendszer indítás (Windows):**
```bash
start-full.bat                        # Teljes rendszer indítás (Express + FastAPI + Dashboard)
# Portok: Backend :3000, FastAPI :8000, Dashboard :5173
```

## Architektúra

Hibrid Node.js + Python multi-agent rendszer, Model Context Protocol (MCP) kommunikációval.

### Belépési pontok

**`src/index.ts`** — Dual-mode szerver: egyszerre indít MCP StdioServerTransport-ot (Claude Desktop / AI kliensek) ÉS Express HTTP szervert (:3000, Dashboard + CLI). Mindkét mód `registerAllTools()` hívásával regisztrálja az MCP eszközöket.

**`src/cli.ts`** — CLI belépési pont (Commander.js, 70+ parancs). Magyar nyelvű, inquirer.js menüvezérelt (nyíl + enter navigáció). Lásd: CLI konvenciók szekció.

### Fő komponensek

**Node.js backend** (`src/`): TypeScript ESM, Express 4, Socket.IO. ~51 REST API route fájl a `src/server/routes/`-ban. WebSocket: `src/server/SocketService.ts`.

**Python alrendszer** (`myai/`): FastAPI + FastMCP. Böngésző automatizálás (Playwright/browser-use), vektor DB-k (LanceDB, ChromaDB), ML pipeline-ok. A Node.js `pythonShell.ts`-en keresztül kommunikál vele.

**Dashboard** (`src/dashboard/`): React 19 + Vite + Tailwind v4 + Radix UI. Saját `vite.config.ts`, külön build: `npm run build:ui`. Új panelek regisztrációja: `src/dashboard/lib/navigation.tsx` (NavigationRegistry).

### Agent rendszer

50+ agent. Minden agent az `IAgent` interfészt (`src/agents/types.ts`) valósítja meg, vagy a `BaseAgent` absztrakt osztályt (RAG memóriával) terjeszti ki. Regisztráció: `src/agents/registry.json` (name, module, class, triggers, priority, capabilities). Az `AgentManager` (`src/agents/AgentManager.ts`) kezeli a registry-t, Task Queue-t (SQLite), Worker Loop-ot és RBAC-ot.

**Agent hierarchia:**
```
OrchestratorAgent / EnterpriseOrchestratorAgent (Koordinátorok)
├── Core: DeveloperAgent, EvaluatorAgent, ResearcherAgent, TaskDecomposerAgent
├── Automation: RobotkezV2Agent (Playwright/LLM), VoiceAgent (Whisper)
├── Engineering: SpecWriterAgent, GenesisOrchestrator, LintFixerAgent
├── Enterprise Suite (~20 agent): Finance, Sales, HR, Logistics, Admin
├── Swarm: SwarmManager + SwarmAgent (src/agents/swarm/)
├── TOML-alapú DynamicAgent: myai/agents/*.toml
└── Management: ProjectConductorAgent (tracks.md szinkron)
```

**RBAC**: `src/agents/permissions.ts` — Minden agent-hez `PermissionProfile` definiál jogosultságokat és path-korlátozásokat.

### Model Router

**`src/core/modelRouter.ts`** — Brain vs Muscle routing (RULE-MR1–4):
- **Brain (Cloud):** Gemini (1M ctx), GitHub Models GPT-4o → `complexity: 'high'`
- **Muscle (Local):** Ollama `qwen2.5-coder:7b` → `complexity: 'low'` vagy `budget=0`

**Bifrost Gateway** (`src/core/bifrost_gateway.ts`): 4 provider (Ollama, Gemini, GitHub Models, Anthropic) auto-fallbackkel.

### Cloudflare Edge

Workers (D1, KV, R2, Vectorize), AI Gateway. Node.js `d1Adapter.ts`-en keresztül HTTP POST-tal éri el D1-et: `Node.js → HTTP POST /d1/query → Cloudflare Worker → D1`. Aktiválás: `CLOUDFLARE_WORKER_URL` + `CEAN_API_KEY` env változók.

### Phoenix Protocol (Öngyógyítás)

`src/core/checkpoint.ts` + `phoenixEventBus.ts` — Hiba esetén: 1) Checkpointing (SQLite: `executing` → `failed`), 2) Auto-Reset (AgentManager retry: 1s → 3s → 10s, max 3 kísérlet), 3) Git Recovery (`sync_foszal.py` + commit).

### Data Flywheel (5 lépés)

1. **Harvest** (`myai/browser_worker.py`) — Webes adatgyűjtés Playwright-tel
2. **Refine** (`myai/refiner_logic.py`) — Adat tisztítás, validáció
3. **Index** (LanceDB) — Vektoros indexelés
4. **Learn** (RAG Query) — Releváns dokumentumok keresése
5. **Execute** (OrchestratorAgent) — Feladat végrehajtás → Feedback loop

### Egyéb alrendszerek

- **Golden Dataset Bridge** (`src/core/goldenDatasetBridge.ts`): Sikeres agent futások mentése D1-be fine-tuning célra
- **Safe Zones** (`config/safe_zones.json`): MCP Filesystem whitelist/blacklist, `.env`/`.git/**`/`*.key` automatikusan tiltva
- **E2B Sandbox** (`src/security/e2b_sandbox_manager.ts`): Izolált Python kód végrehajtás
- **Jules Integration** (`src/core/julesIntegration.ts`): Async task management, 15 párhuzamos test suite

## Kód konvenciók

### ESM importok — `.js` kiterjesztés KÖTELEZŐ

```typescript
import { foo } from './bar.js';      // ✅ Helyes
import { foo } from './bar';          // ❌ Build FAIL — Node16 moduleResolution megköveteli
```

### Típusok — `any` TILOS

```typescript
const data: unknown = getData();      // ✅ Helyes — unknown + type guard
const data: any = getData();          // ❌ Kerülendő — strict mode aktív
```

### Logging — `console.log` TILOS

ESLint `no-console: warn` szabály. Használd a projekt loggerét:

```typescript
// Agent kódban:
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
logInfo('AgentName', 'message');
setAgentStatus('AgentName', 'working', 'task leírás');

// Szerver/utility kódban:
import { Logger } from '../utils/logger.js';
const logger = new Logger('feature.log');
await logger.info('message');
```

### Agent implementáció

**1. Egyszerű agent — `IAgent` interfész:**

```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = 'MyAgent';
  role = 'Agent célja';
  description = 'Mit csinál';
  capabilities = ['skill1'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      // ... logika ...
      return { status: 'success', data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle'); // KÖTELEZŐ finally-ban!
    }
  }
}
```

**2. Komplex agent RAG memóriával — `BaseAgent` absztrakt osztály:**

A BaseAgent **Bridge Pattern**-t használ: `execute(task, context?)` az IAgent interfész (külső API), `executeTask(context)` a belső implementáció. Automatikus status management, logging, RAG memória lekérdezés.

```typescript
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MyComplexAgent extends BaseAgent {
  name = 'MyComplex';
  role = 'Szerep';
  description = 'Leírás';
  capabilities = ['skill1'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // context.pastExperiences: RAG memória automatikusan betöltve
    // context.task: az eredeti feladat szövege
    return { success: true, message: 'OK', data: result };
  }
}
```

**3. TOML-alapú DynamicAgent:**

Konfigurációs fájl: `myai/agents/MyAgent.toml` (systemPrompt, query template, tags). A `registry.json`-ban `"class": "DynamicAgent"` + `"tomlPath"` mező. Nincs TypeScript kód — a `DynamicAgent` (`src/agents/DynamicAgent.ts`) generikusan betölti.

**Új agent regisztráció:** add hozzá `src/agents/registry.json`-hoz:
```json
{
  "name": "MyAgent",
  "module": "./agents/MyAgent.js",
  "class": "MyAgent",
  "triggers": ["kulcsszó1", "kulcsszó2"],
  "priority": 5,
  "capabilities": ["skill1"]
}
```

### MCP Tool minta

```typescript
// src/tools/myTool.ts — Definíció + Handler
export const myToolDefinition = {
  name: 'my_tool',
  description: 'Tool célja',
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

// Regisztráció: src/server/registry.ts → registerAllTools() → server.registerTool(myToolDefinition, handler)
```

### CLI konvenció

Minden új CLI parancs **magyar nyelvű**, **inquirer.js menüvezérelt** (nyíl + enter navigáció). Színes output: chalk, boxen, ora. Nincs szöveg begépelés — interaktív kiválasztás. Fájlok helye: `src/cli/commands/`. Regisztráció: `src/cli.ts`.

### Tesztelés — Vitest (NE Jest!)

```typescript
import { describe, it, expect, vi } from 'vitest';
// Vitest globals is elérhetők a tsconfig "types": ["vitest/globals"] miatt
```

- Teszt fájlok: `test/**/*.test.ts`
- Setup: `test/setup.ts`
- Timeout: 15s
- `fileParallelism: false`
- Mock-olás: `vi.fn()`, `vi.spyOn()`, `vi.mock()` — NE `jest.fn()`!

### TypeScript konfig

- Target: ES2022, Module: Node16, Strict mode
- rootDir: `./src`, outDir: `./build`
- Dashboard (`src/dashboard/`) ki van zárva a fő tsconfig-ból, saját `tsconfig.ui.json`-ja van

### Python konvenciók (`myai/`)

- Python ≥3.12, csomagkezelő: `uv` (pyproject.toml)
- Strict Pydantic modellek adatcseréhez
- MCP szerverek: FastMCP ≥2.14.3 (`@mcp.tool()` dekorátor, stdio transport)
- Böngésző automatizálás: `browser_use` könyvtár (RobotkezV2)

### Commit konvenció

Conventional Commits: `feat(scope): subject`, `fix(scope): subject`, stb. Scope példák: `agent`, `cli`, `api`, `ui`, `dashboard`, `cloudflare`, `phoenix`.

## EPP v2 — Engineering Precision Protocol

Teljes dokumentáció: `conductor/epp-v2.md`. A 7 Arany Szabály:

1. **Track Required** — Nincs kódírás track nélkül (`conductor/tracks/<name>/`)
2. **Fix Bugs** — Fejlesztés közben talált hibák AZONNAL javítandók
3. **Commit Often** — Minden phase befejezése után git commit
4. **TODO List** — Track.md checkbox lista folyamatos frissítése
5. **All Tests Green** — COMPLETED csak ha: build ✅ + test ✅ + manual ✅
6. **Dashboard + CLI** — Minden új funkció = Dashboard komponens (React, Radix UI) + CLI parancs (magyar, inquirer.js)
7. **Final Docs** — Track lezárás után: `.ai/<agent>.md` + `python scripts/sync_foszal.py`

**Track életciklus:** `PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED`

## Védett fájlok

Ne módosítsd explicit kérés nélkül: `package.json`, `src/agents/registry.json`, `src/index.ts`, `src/core/llm_client.ts`, `src/server/web.ts`, `src/server/registry.ts`, `.env`.

## Projekt koordináció

- **Track rendszer**: `conductor/tracks.md` (aktív fejlesztések, 105+ track). Minden nagyobb feature = track a `conductor/tracks/` mappában.
- **AI ügynök naplók**: `.ai/FOSZAL.md` (központi napló, auto-generált), `.ai/copilot.md` (Copilot saját naplója). Szinkronizálás: `python scripts/sync_foszal.py`.
- **Bootstrap**: `.ai/BOOTSTRAP.md` — gyors projekt összefoglaló munkamenet elejére.
- **Multi-agent munkamenet**: Claude Code, Gemini CLI, GitHub Copilot, Jules, Cursor párhuzamosan dolgoznak. Koordináció a `.ai/` naplókon és `conductor/tracks.md`-n keresztül.
- **Log fájlok**: `logs/` mappa — `brunella.db` (SQLite), `dashboard.log`, `health.log`, `http.log`, `orchestrator.log`, `startup.log` stb.

## Copilot ↔ BAS Full Integration

**A Copilot CLI teljes hozzaferessel rendelkezik a BAS rendszerhez — 300+ REST endpoint, 95+ agent, 53 MCP tool, 103 befejezett track kepessegeivel.**

### 3 eszkoz — mikor melyiket hasznald

| Eszkoz | Mikor | Szerver kell? |
|--------|-------|---------------|
| `node scripts/copilot-route.js` | Gyors dontes: melyik agent kell | ❌ NEM |
| `node scripts/copilot-dashboard.js` | BARMILYEN dashboard/API muvelet | ✅ IGEN (npm run dev) |
| `.\scripts\copilot-dispatch.ps1` | PowerShell wrapper (legacy) | ✅ IGEN |

### Dashboard Bridge — Teljes rendszer vezérles

**28 domain, 200+ muvelet** — a BAS OSSZES kepcssege egyetlen CLI-bol:

```powershell
# Rendszer attekintes
node scripts/copilot-dashboard.js --quick-status     # Health + Agents + Tasks egyben
node scripts/copilot-dashboard.js --domains           # 28 domain listazasa

# Agent muveletek (70+ agent)
node scripts/copilot-dashboard.js agents list
node scripts/copilot-dashboard.js agents execute lint_fixer "Fix ESLint errors"
node scripts/copilot-dashboard.js agents orchestrate "Create marketing campaign"

# PAIOSZ Chat (5 LLM provider)
node scripts/copilot-dashboard.js paios chat "Analyze system health"
node scripts/copilot-dashboard.js paios chat-gemini "Summarize project status"
node scripts/copilot-dashboard.js paios chat-claude "Review this architecture"
node scripts/copilot-dashboard.js paios chat-ollama "Quick code suggestion"

# MCP Tools (53 tool)
node scripts/copilot-dashboard.js mcp tools
node scripts/copilot-dashboard.js mcp execute knowledge_semantic_search '{"query":"auth"}'

# Enterprise (18 modul: Finance, HR, Sales, Legal, Marketing, stb.)
node scripts/copilot-dashboard.js enterprise modules
node scripts/copilot-dashboard.js enterprise execute finance_guardian "Check invoices"

# Browser Automation (Robotkez)
node scripts/copilot-dashboard.js robotkez exec "Navigate to google.com"
node scripts/copilot-dashboard.js robotkez chat "Search for AI trends"
node scripts/copilot-dashboard.js browser navigate "https://example.com"
node scripts/copilot-dashboard.js browser screenshot

# Developer Pipeline (Git, Code Review, Scaffold)
node scripts/copilot-dashboard.js developer execute "Review auth module"
node scripts/copilot-dashboard.js developer scaffold agent

# Knowledge & RAG (LanceDB + ChromaDB)
node scripts/copilot-dashboard.js knowledge semantic "authentication flow"
node scripts/copilot-dashboard.js knowledge index src/auth/login.ts

# Memory & Preferences
node scripts/copilot-dashboard.js memory store default theme "dark"
node scripts/copilot-dashboard.js memory query default

# Swarm (Multi-Agent Colony)
node scripts/copilot-dashboard.js swarm dispatch "Research competitor landscape"

# Tasks & Tracks
node scripts/copilot-dashboard.js tasks stats
node scripts/copilot-dashboard.js tasks decompose "Build new authentication system"
node scripts/copilot-dashboard.js tracks list
node scripts/copilot-dashboard.js tracks todos

# Python Subsystem (FastAPI)
node scripts/copilot-dashboard.js python health
node scripts/copilot-dashboard.js python comet "Execute ML pipeline"
node scripts/copilot-dashboard.js python harvest "https://example.com"

# Invoice & Finance
node scripts/copilot-dashboard.js invoice unpaid
node scripts/copilot-dashboard.js invoice list 50

# Google Workspace
node scripts/copilot-dashboard.js google gmail 20
node scripts/copilot-dashboard.js google calendar

# Web Crawling
node scripts/copilot-dashboard.js crawl fetch "https://example.com"

# Observability & Security
node scripts/copilot-dashboard.js observability stats
node scripts/copilot-dashboard.js security audit

# Cloudflare Edge
node scripts/copilot-dashboard.js cloudflare status
```

### Offline Agent Router (szerver NELKUL)

```powershell
node scripts/copilot-route.js "Fix TypeScript lint errors"   # → JSON: bestAgent, confidence
node scripts/copilot-route.js --domain marketing              # Domain szures
node scripts/copilot-route.js --list                          # Osszes agent
```

### Mikor delegalj BAS agentre (vs. csinald magad)

| Feladattipus | BAS Agent | Bridge parancs |
|---|---|---|
| ESLint / TSC javitas | `lint_fixer` | `agents execute lint_fixer "Fix..."` |
| Kod generalas | `Developer` | `developer execute "Build..."` |
| Web scraping | `robotkezv2` | `robotkez exec "Navigate..."` |
| Szamla / penzugy | `finance_guardian` | `enterprise execute finance_guardian "..."` |
| Marketing | `marketing_director` | `enterprise execute marketing_director "..."` |
| HR / toborzas | `DigitalHeadhunter` | `enterprise execute digital_headhunter "..."` |
| Jogi | `law_detective` | `enterprise execute law_detective "..."` |
| Track kezeles | `ProjectConductor` | `tracks list` / `tracks todos` |
| Multi-agent | orchestrator | `swarm dispatch "..."` |
| RAG kereses | knowledge tools | `knowledge semantic "..."` |
| Browser auto | Robotkez | `robotkez exec "..."` / `browser navigate "..."` |

### Dontesi logika

1. `node scripts/copilot-route.js "feladat"` → JSON (confidence score)
2. **confidence >= 0.7** → delegald: `node scripts/copilot-dashboard.js agents execute <name> "<task>"`
3. **confidence < 0.7** → nezd meg alternativakat, vagy csinald magad
4. **Fajl szerkesztes / git** → NE delegald (nativ Copilot kepesseg jobb)
5. **LLM generacio** → hasznald a `paios chat` parancsot (5 provider)
6. **Agent kepesseg index:** `config/copilot-agents.json`

## Hibaelharitas

| Hiba | Megoldas |
|------|----------|
| `ERR_MODULE_NOT_FOUND` | Import hianyzo `.js` kiterjesztes → add hozza |
| `npm test` timeout | `fileParallelism: false` vitest.config-ban → noveld a timeout-ot |
| Ollama nem elerheto | Inditsd el: `ollama serve`, ellenorizd: `http://localhost:11434` |
| FastAPI nem indul | `cd myai && uv sync && uvicorn server:app --reload --port 8000` |
| Agent "stuck" (working) | Phoenix Protocol: 3 retry → auto idle reset. Kezi: `setAgentStatus(name, 'idle')` |
| Dashboard build hiba | `npm run build:ui` — kulon tsconfig.ui.json es vite.config.ts |

## BAS Teljes Kepcsseg Inventar (Deep Audit 2026-03-25)

> 103 befejezett track, 95+ agent, 300+ endpoint, 53 MCP tool — 2 honap intenziv fejlesztes eredmenye.

### RENDSZER MERETEK

| Kategoria | Mennyiseg | Helye |
|-----------|-----------|-------|
| Regisztralt agentek | 95+ | `src/agents/registry.json` |
| MCP toolok | 53 (20 kategoria) | `src/tools/` (33 fajl) |
| REST route fajlok | 52 | `src/server/routes/` |
| Aktiv (regisztralt) route-ok | ~20 | `src/server/routes/index.ts` |
| Dashboard panelek (regisztralt) | ~55 | `src/dashboard/lib/navigation.tsx` |
| Automation scriptek | 100+ | `scripts/` |
| Python workerek | 7 | `myai/` (browser, crawl4ai, vision, ocr, web_scraper, cma, os) |
| LLM providerek | 5 | GitHub Models, Gemini, Claude, Ollama, CF Workers AI |
| SQLite adatbazisok | 6 | brunella.db, tasks.db, checkpoints.db, audit.db, cean.db, comet_memory.db |
| Befejezett trackkek | 103 | `conductor/archive/` |
| Aktiv trackkek | 10 | `conductor/tracks/` |

### 32 INAKTIV ROUTE FAJL — Teljes kod, de NEM regisztralt index.ts-ben

Ezek a `src/server/routes/` konyvtarban leteznek es teljes endpoint-okat kinalnak, de az `index.ts` NEM importalja oket:

| Route fajl | Funkcio | Ertek |
|------------|---------|-------|
| `autonomousInfra.ts` | HyperKernel, self-replication, goal engine | 🔴 MAGAS |
| `universalOrchestrator.ts` | Multi-provider LLM routing | 🔴 MAGAS |
| `studio.ts` | Vite React scaffold generation | 🟡 KOZEPES |
| `pythonWorkers.ts` | OCR, web scraper, LanceDB batch | 🔴 MAGAS |
| `cean.ts` | Cloudflare Edge Agent Network | 🟡 KOZEPES |
| `paiosOrchestrator.ts` | Universal provider + tool registry | 🔴 MAGAS |
| `prometheus.ts` | Prometheus metrics endpoint | 🟡 KOZEPES |
| `metrics.ts` | Rendszer metrikak | 🟡 KOZEPES |
| `swarm.ts` | Swarm Intelligence API | 🔴 MAGAS |
| `fleet.ts` | Worker fleet management | 🟡 KOZEPES |
| `scaling.ts` | Auto-scaling | 🟡 KOZEPES |
| `sales.ts` | Sales pipeline | 🟡 KOZEPES |
| `goldenDataset.ts` | Fine-tuning golden dataset | 🔴 MAGAS |
| `voice.ts` | Hang feldolgozas (Whisper) | 🟡 KOZEPES |
| `contact.ts` | Kapcsolatkezeles | 🟢 ALACSONY |
| `remote.ts` | Remote session management | 🔴 MAGAS |
| `webhooks.ts` | Webhook integraciok | 🟡 KOZEPES |
| `crawl4ai.ts` | Web crawling API | 🔴 MAGAS |
| `evhunter.ts` | Event/lead intelligence | 🟡 KOZEPES |
| `dashboard.ts` | Dashboard specifikus API-k | 🟡 KOZEPES |
| `suggestedTasks.ts` | AI javasolt feladatok | 🔴 MAGAS |
| `scheduledTasks.ts` | Utemezett feladatok | 🔴 MAGAS |
| `testScheduler.ts` | Teszt utemezesi API | 🟢 ALACSONY |
| `harvests.ts` | Data pipeline harvesting | 🟡 KOZEPES |
| `preferences.ts` | Felhasznaloi preferencia | 🟢 ALACSONY |
| `observability.ts` | OpenTelemetry + tracing | 🔴 MAGAS |
| `mcp.ts` | MCP szerver API | 🔴 MAGAS |
| `workers.ts` | Worker management | 🟡 KOZEPES |
| `wrangler.ts` | Cloudflare Wrangler wrapper | 🟡 KOZEPES |

### 15 LATHATATLAN DASHBOARD PANEL — Letezik de NEM regisztralt a NavigationRegistry-ben

| Komponens | Funkcio |
|-----------|---------|
| `AdminSelfCheckWidget` | Admin rendszer on-diagnozis |
| `CognitiveMemoryPanel` | Agent memoria vizualizacio |
| `CostSummary` | LLM koltseg osszesito |
| `HarvestPipelineWidget` | Adat gyujtesi pipeline monitor |
| `LiveChatterWidget` | Real-time chat monitor |
| `LiveExecutionMonitor` | Agent vegrehajtasi monitor |
| `MachineHunterWidget` | Ipari gep kereso |
| `ModelRouterPanel` | LLM model routing vizualizacio |
| `MarketWatcherWidget` | Piac megfigyelesi panel |
| `ProcessControlWidget` | Folyamat vezerles |
| `ServiceControlWidget` | Szolgaltatas vezerles |
| `VectorizeAnalyticsWidget` | Vektor DB analitika |
| `TokenUsageChart` | Token hasznalati grafikon |
| `TraceViewer` | Elosztott nyomkovetes |
| `LogViewer` | Log nezo |

### KULCS RENDSZER-KEPCSSGEK (103 archivalt trackbol)

#### Agent Framework
- **Agent Architect 2.0** — Automatikus agent generalas termeszetes nyelvbol (TOML + hot-reload)
- **Agent Memory Structured** — SQLite memória, pattern reuse, FNV hash + vektor, 30 napos TTL
- **Agent Orchestration DAG** — DAG workflow engine (parhuzamos vegrehajtás, elágazas, ciklus, budget)
- **MCP Tool Discovery** — Dinamikus tool registry, semver, tool lancok, per-tool metrikak (latency, p95)
- **Task Decomposer** — Komplex feladat bontás mikro-lepesekre

#### Orkesztracio
- **Orchestrator State Machine** — LangGraph-inspiralt TS impl (IDLE→ANALYZING→ROUTING→EXECUTING→DONE)
- **Phoenix Protocol** — Ongyogyitas: checkpoint + auto-retry (1s→3s→10s) + git recovery
- **Universal Orchestrator** — Multi-provider routing + fallback chain + conversational history
- **Hungarian Cognition** — Magyar nyelvu optimalizacio, multi-turn, kontextus kezelés

#### Swarm Intelligence v2
- **Colony Persistence** — SQLite checkpoint auto-save
- **Weighted Voting** — confidence × experience × recentSuccessRate
- **Negotiation Protocol** — Max 3 round, >70% consensus
- **Dynamic Resizing** — Auto-scale 2-10 agent, queue-alapu
- **Failure Recovery** — Heartbeat + respawn, max 3 retry

#### Security & Safety
- **VM Sandbox** — Node.js vm izolacio resource limitekkel
- **Network Policy** — URL whitelist/blacklist, metadata endpoint blokk
- **RBAC** — 6 profil: ADMIN, DEVELOPER, RESEARCHER, EVALUATOR, ROBOTKEZ, READONLY
- **Cost Tracking** — Napi koltseg limit per agent tipus
- **Guardrails** — Confidence scoring (0.0-1.0), auto-evaluation <0.6 kueszobnel
- **PII Redactor** — Email, telefon, API key, password, credit card detektalas + redakcio

#### Observability
- **OpenTelemetry** — Span instrumentacio: minden agent.execute() = trace span
- **Token Counting** — Preciz prompt + completion token szamolas per LLM hivas
- **Cost Tracking** — Provider-specifikus ár × token → USD
- **Fallback Tracking** — Provider valtasi esemenyek naplozasa
- **Dashboard TelemetryPanel** — Timeline waterfall, koltseg bontás (napi/heti)

#### Cloudflare Ecosystem (16+ integracio)
- Workers, D1, KV, Vectorize, Durable Objects, Queues, R2, Workflows
- Analytics Engine, Browser Rendering, Hyperdrive
- Worker fleet fallback policy, token permissions
- CEAN (Cloudflare Edge Agents Network) — elosztott agent vegrehajtás az edge-en

#### Browser Automation
- **CometBrowser** — 3-layer: Planner (GPT-4o) → Actor (Playwright) → Critic (Gemini vision)
- **RobotkezV2** — Playwright + LLM szelektorok, multi-tab, session persistence
- **Chrome DevTools MCP** — CDP, network capture, JS error detection, performance metrics
- **Computer Use API** — 6 endpoint (vision-click, screenshot, navigate, type, scroll, extract)

#### Data & AI Pipeline
- **Golden Dataset Bridge** — Sikeres agent futasok → D1 → fine-tuning
- **Data Flywheel** — Harvest→Refine→Index→Learn→Execute korforgas
- **Brunella Incubator** — Unsloth QLoRA fine-tuning, Ollama Modelfile
- **Structured Memory** — SQLite + FNV hash + vektor similarity
- **LanceDB/ChromaDB** — Vektor indexelés RAG lekerdezeshez

#### Uzleti Intelligencia (Enterprise Suite)
- **18 modul:** Finance, Sales, HR, Logistics, Admin, Marketing, Legal, Procurement, Claims, Pricing
- **Lead Intelligence** — 550 LOC CF Worker, D1/KV/Google Sheets szinkron
- **Invoice OCR** — Gemini Vision dokumentum feldolgozas
- **Campaign Generators** — Marketing + turizmus automatizalas
- **Law Detective** — Jogi dokumentum elemzes
- **Grant Watcher** — Palyazat figyelő
- **Property Visionary/Analyst** — Ingatlan elemzes

#### Remote Layer (7 fazis kesz, 8-9 folyamatban)
- Phase 1: Foundation (REST + WebSocket)
- Phase 2: Discovery + Auth (MCP autodiscovery, token auth)
- Phase 3: Mobile (responsive + touch)
- Phase 4: Voice (Whisper ASR)
- Phase 5: Distributed Mesh (multi-node)
- Phase 6: Adaptive Swarms (onallo rajok)
- Phase 7: Collective Evolution (kollektiv tanulas)
- Phase 8-9: Planet-Scale + Superintelligence (folyamatban)

### KRITIKUS FAJLOK REFERENCIA

**Core:**
- `src/core/dagEngine.ts` — DAG workflow motor
- `src/core/dynamicToolRegistry.ts` — Runtime tool registry
- `src/core/toolComposition.ts` — Tool lancok transforms-szel
- `src/core/structuredMemory.ts` — Pattern reuse engine
- `src/core/agentStateMachine.ts` — Orkesztrator allapot gep
- `src/core/telemetry.ts` — OpenTelemetry integracio
- `src/core/sandbox/wasmSandbox.ts` — VM izolacio
- `src/core/sandbox/networkPolicy.ts` — Halozati policy
- `src/core/bifrost_gateway.ts` — 4 LLM provider auto-fallback
- `src/core/modelRouter.ts` — Brain vs Muscle routing
- `src/core/checkpoint.ts` — Phoenix Protocol
- `src/core/goldenDatasetBridge.ts` — Fine-tuning adat gyujtes

**Security:**
- `src/security/redactor.ts` — PII felismeres + redakcio
- `src/core/rbac/agentPermissions.ts` — RBAC 6 profil
- `src/agents/permissions.ts` — Per-agent jogosultsagok

**Python alrendszer:**
- `myai/agents/comet/` — CometBrowser (planner, actor, critic, memory, orchestrator)
- `myai/mcp_server.py` — FastMCP MCP szerver (stdio)
- `myai/server.py` — FastAPI (:8000) + Comet endpoints
- `myai/browser_worker.py` — Playwright browser worker
- `myai/refiner_logic.py` — Adat tisztitas/validacio

**Dashboard:**
- `src/dashboard/components/dashboard/GuardrailsPanel.tsx`
- `src/dashboard/components/dashboard/SecurityPanel.tsx`
- `src/dashboard/components/dashboard/TelemetryPanel.tsx`
- `src/dashboard/components/dashboard/ToolDiscoveryPanel.tsx`
- `src/dashboard/components/dashboard/SwarmPanel.tsx`

### REJTETT KEPCSSGEK (12 azonositott)

1. **Swarm Voting & Negotiation** — Sullyozott szavazas konszenszus kuszobertekkel
2. **Phoenix Protocol Checkpoints** — Allapot mentest az orkesztrator helyreallitashoz
3. **Golden Dataset Pattern Reuse** — FNV hash + vektor minta talalat gyors ujrafelhasznalas
4. **Network Policy Enforcement** — Granularis URL/domain hozzaferes kontroll sandbox-ban
5. **Cost Tracking per RBAC Profile** — Napi koltseg limit per agent tipus
6. **Tool Composition Chains** — Multi-tool pipeline-ok transformokkal
7. **DAG Loop & Conditional Support** — Komplex elagazas a workflowkban
8. **Remote Session Persistence** — SQLite session store elosztott agenteknek
9. **Confidence Score Thresholds** — Auto-evaluation <0.6 trigger
10. **Worker Fleet Fallback Policies** — Edge worker automatikus failover
11. **PII Redaction Audit Log** — Redaktalt mezok naplozasa idopecsettel
12. **Vectorize Fallback** — Alternativ lekcrdezes ha vektor DB nem elerheto

---

## TELJES AGENT KATALOGUS (54 regisztralt + TOML dinamikus)

> Az alabbi tablazat a `src/agents/registry.json` alapjan tartalmazza az OSSZES BAS agent-et.
> Mindegyik meghivhato a Copilot CLI-bol az `agent dispatch <feladat>` paranccsal.

### Core Agents (10)
| Agent | Szerep | Trigger kulcsszavak |
|-------|--------|---------------------|
| orchestrator | Fo orkesztrator, agent valasztas | task, delegate, plan |
| enterprise_orchestrator | Enterprise feladatok koordinacioja | enterprise, business, organization |
| Developer | Kodfejlesztes, debug, refaktor | code, develop, implement, debug, fix |
| evaluator | Kod/feladat ertekelese, minoseg ellenorzes | evaluate, review, quality, score |
| researcher | Web kutatas, informacio gyujtes | research, search, find, investigate |
| task_decomposer | Komplex feladatok reszekre bontasa | decompose, breakdown, split, plan |
| knowledge_base_builder | Tudasbazis epitese es karbantartas | knowledge, learn, index, rag |
| SpecWriter | Specifikacio es dokumentacio iras | spec, specification, document, write |
| lint_fixer | ESLint/TSC hiba automatikus javitas | lint, fix, eslint, format |
| project_organizer | Projekt szervezes, struktúra | organize, structure, clean |

### Enterprise Suite (20)
| Agent | Szerep | Trigger kulcsszavak |
|-------|--------|---------------------|
| finance_guardian | Penzugyi monitoring, szamlak | finance, money, budget, invoice |
| FinancialGuard | Koltseg limit, audit | cost, limit, spending, audit |
| sales | Ertekesites, lead management | sales, sell, revenue, deal |
| sales_hunter | Lead kutatas, prospecting | prospect, lead, outreach, cold |
| lead_mining | Lead adatbanyaszat | mine, leads, data, contacts |
| marketing_director | Marketing strategia | marketing, campaign, brand, seo |
| MarketingDirector | Marketing muveletek | ads, social, content, promotion |
| CampaignGenerator | Kampany tartalom generalas | campaign, generate, ad, creative |
| logistics_dispatcher | Logisztika, szallitas | logistics, ship, delivery, route |
| LogisticsDispatcher | Flotta menedzsment | fleet, dispatch, track, vehicle |
| procurement | Beszerzes, beszallito management | procure, vendor, supply, purchase |
| PricingAgent | Arazes, strategia | pricing, price, discount, margin |
| ProactiveClaimsAgent | Reklamaciok, panaszkezeles | claim, complaint, refund, issue |
| NurturerAgent | Ugyfel gondozas, retention | nurture, retain, engagement |
| LocalCSR | Helyi ugyfelfelelős | local, community, csr, region |
| ConflictMediator | Konfliktuskezeles | conflict, dispute, mediate |
| copywriter | Szovegiras, tartalomkeszites | copy, write, text, content |
| grant_watcher | Palyazat figyeles | grant, funding, application, tender |
| PropertyAnalyst | Ingatlan elemzes | property, real-estate, valuation |
| PropertyVisionary | Ingatlan strategia, fejlesztes | development, vision, project, invest |

### Engineering & DevOps (10)
| Agent | Szerep | Trigger kulcsszavak |
|-------|--------|---------------------|
| DevOps | CI/CD, deployment, infra | devops, deploy, ci, pipeline, docker |
| Architect | Rendszer architektura | architect, design, pattern, system |
| agent_architect | Agent tervezes, template | agent-design, template, scaffold |
| DependencyGraph | Fuggoseg elemzes | dependency, graph, import, module |
| qa | Minosegbiztositas, teszteles | qa, test, quality, verify |
| critic_agent | Kod kritika, code review | critique, review, feedback, improve |
| documenter | Automatikus dokumentacio | document, readme, jsdoc, api-doc |
| UXDesigner | UI/UX tervezes, Figma | ux, ui, design, figma, mockup |
| EdgeProxy | Edge deployment, Cloudflare | edge, proxy, cloudflare, cdn |
| Python | Python kod futtatas, bridge | python, pip, fastapi, script |

### Automation & AI (8)
| Agent | Szerep | Trigger kulcsszavak |
|-------|--------|---------------------|
| robotkezv2 / RobotkezV2 | Bongeszo automatizalas (Playwright+LLM) | browser, automate, web, click, scrape |
| voice | Hang feldolgozas (Whisper) | voice, speech, transcribe, audio |
| ApifyScraping | Apify web scraping | apify, scrape, crawl, extract |
| ChromeDevTools | Chrome DevTools automatizalas | chrome, devtools, inspect, debug |
| DataScientist | Adat elemzes, ML | data, analysis, ml, statistics |
| email_triage | Email besorolasa, feldolgozasa | email, inbox, triage, sort |
| github_models | GitHub Models LLM hivas | github-models, gpt, inference |
| innovation_bridge | Innovacios otletek kezelese | innovate, idea, brainstorm |

### Specialized (6)
| Agent | Szerep | Trigger kulcsszavak |
|-------|--------|---------------------|
| DigitalHeadhunter | Toborzas, CV elemzes | recruit, hire, cv, talent |
| law_detective | Jogi kutatas | legal, law, compliance, regulation |
| market_intel | Piaci intelligencia | market, competitor, analysis, trend |
| ops | Uzemeltetesi feladatok | ops, monitor, uptime, system |
| ProjectConductor | Projekt vezetes, track management | conductor, track, milestone, status |
| DigitalHeadhunter | Allaskeresesi asszisztens | job, search, career, talent |

---

## MCP ESZKOZ REFERENCIAK (11 rejtett tool fajl)

> Ezek a `src/tools/` mappa fajljai amelyek regisztralt MCP eszkozok de nem voltak dokumentalva.

| Tool fajl | Eszkoz neve | Funkció |
|-----------|-------------|---------|
| `anythingllm.ts` | anythingllm_* | AnythingLLM tudasbazis integracio (kerdezz, indexelj) |
| `browserBridge.ts` | browser_bridge_* | Bongeszo tavvezerles (navigate, click, screenshot) |
| `claudeTool.ts` | claude_* | Claude API kozvetlen hivas |
| `copilotCliTool.ts` | copilot_cli_* | Copilot CLI utasitas vegrehajtas |
| `deploymentAnalyzer.ts` | deployment_analyze | Deployment hiba elemzes |
| `getAiRecommendation.ts` | ai_recommend | AI ajanlasok MCP tool |
| `githubModelsTool.ts` | github_models_* | GitHub Models inference hivas |
| `interpreter.ts` | code_interpret | Kod vegrehajtás sandbox-ban |
| `n8n.ts` | n8n_* | n8n workflow integráció (trigger, status) |
| `negotiationEngine.ts` | negotiate_* | Targyalasi strategia es kimenet elemzes |
| `toolPermissions.ts` | permissions_* | Tool hozzaferes RBAC ellenorzes |

---

## PYTHON FASTAPI ENDPOINT KATALOGUS (35 endpoint — :8000)

> A `myai/server.py` tartalmazza. Elerheto a `python <sub>` bridge parancson keresztul.

| Endpoint csoport | Parancs | FastAPI utvonal |
|------------------|---------|-----------------|
| **Core** | `python health` | GET /health |
| | `python execute <code>` | POST /execute |
| | `python refine <content>` | POST /refine |
| **Harvest** | `python harvest <url>` | POST /harvest |
| | `python harvest-status` | GET /harvest/status |
| | `python harvest-results` | GET /harvest/results |
| | `python harvest-clean` | POST /harvest/clean |
| **Comet** | `python comet <task>` | POST /comet/execute |
| | `python comet-memory` | GET /comet/memory |
| | `python comet-delete <key>` | POST /comet/memory/delete |
| **Browser** | `python browser-chat <msg>` | POST /browser/chat |
| | `python browser-start` | POST /browser/start |
| | `python browser-stop` | POST /browser/stop |
| | `python browser-status` | GET /browser/status |
| | `python browser-screenshot` | GET /browser/screenshot |
| | `python browser-navigate <url>` | POST /browser/navigate |
| **Voice** | `python voice-transcribe <file>` | POST /voice/transcribe |
| **OS Automation** | `python os-screenshot` | GET /os/screenshot |
| | `python os-click <x> <y>` | POST /os/click |
| | `python os-click-pct <x%> <y%>` | POST /os/click-pct |
| | `python os-screen-size` | GET /os/screen-size |
| | `python os-type <text>` | POST /os/type |
| | `python os-vision-click <desc>` | POST /os/vision-click |
| **Robotkez** | `python robotkez-action <instr>` | POST /robotkez/action |
| | `python robotkez-snapshot` | GET /robotkez/snapshot |
| **Crawl4AI** | `python crawl4ai <url>` | POST /crawl4ai/crawl |
| | `python crawl4ai-batch <urls>` | POST /crawl4ai/batch |
| **Incubator** | `python incubator-sample` | POST /incubator/gold-sample |
| | `python incubator-stats` | GET /incubator/stats |
| | `python incubator-train` | POST /incubator/train |
| **Testing** | `python test-run` | POST /test/run |
| | `python test-logs` | GET /test/logs |

---

## AKTIVALT ROUTE-OK (10 uj — 2026-03-25)

> A `src/server/routes/index.ts`-ben regisztralt uj route-ok:

| Route | Mount pont | Leiras |
|-------|-----------|--------|
| observability | /api/v1/observability | LLM hivas monitoring, timeline, stats |
| swarm | /api/v1/swarm | Multi-agent swarm vezerles, voting |
| golden-dataset | /api/v1/golden-dataset | Sikeres futasok fine-tuning adathalmaza |
| suggested-tasks | /api/v1/suggested-tasks | AI altal javasolt feladatok |
| crawl4ai | /api/v1/crawl4ai | Web crawling Crawl4AI integracióval |
| python-workers | /api/v1/python-workers | Python script futtatás Node.js bridge-en |
| evhunter | /api/v1/evhunter | Elektromos auto kereso |
| preferences | /api/v1/preferences | Felhasznaloi beallitasok mentese |
| sales | /api/v1/sales | Ertekesitesi pipeline, lead management |
| voice | /api/v1/voice | Hang feldolgozas, Whisper integracio |

## COPILOT COGNITIVE BRIDGE — 13 Intelligencia Rendszer

> `src/core/copilotCognitiveBridge.ts` — Copilot CLI kozvetlen hozzaferes MINDEN BAS intelligencia reteghez.
> REST API: `/api/v1/cognitive/*` — CLI script: `node scripts/copilot-dashboard.js cognitive <action>`

### Hasznalat

```bash
# Kontextus gazdagitas (MINDEN reteg egyszerre)
node scripts/copilot-dashboard.js cognitive enrich "média kampány tervezés"

# Tanulasi ciklus (feladat utan)
node scripts/copilot-dashboard.js cognitive reflect task-001 MarketingAgent true "Campaign created"

# Reteg statisztikak
node scripts/copilot-dashboard.js cognitive stats

# Egeszseg ellenorzes
node scripts/copilot-dashboard.js cognitive health

# Kozvetlen reteg lekerdezes
node scripts/copilot-dashboard.js cognitive query structured "marketing campaign"
node scripts/copilot-dashboard.js cognitive query graphrag "user authentication"
```

### 13 Osszekotott Rendszer

| # | Reteg | Forras | Funkcio |
|---|-------|--------|---------|
| 1 | StructuredMemory | structuredMemory.ts | Task cache + pattern reuse (SQLite) |
| 2 | PatternReuse | patternReuse.ts | Fuzzy feladat illesztes (0.7 threshold) |
| 3 | UserPreferences | userPreferences.ts | Felhasznaloi kontextus (epizodikus/szemantikus) |
| 4 | GraphRAG | graphRagEngine.ts | Tudasgraf + entitas extrakció + leckek |
| 5 | SharedCognition | sharedCognition.ts | Kollektiv tudatossag (agent kozi) |
| 6 | ReflectionEngine | reflectionEngine.ts | Onreflexio + tanulsag kinyeres |
| 7 | GoldenDataset | goldenDatasetBridge.ts | Sikeres futasok archivuma (fine-tuning) |
| 8 | SelfModel | selfModel.ts | Onismeret + kepesseg tracking |
| 9 | MetaReasoner | metaReasoner.ts | Dontes elemzes + pattern felismeres |
| 10 | PredictiveIntelligence | predictiveIntelligence.ts | Anomalia detektalas + alertek |
| 11 | CollectiveMind | collectiveMind.ts | Perspektiva szintezis + konszenzus |
| 12 | VotingProtocol | swarm/ | Multi-agent szavazas |
| 13 | KnowledgeGraph | knowledgeGraph.ts | Entitas-relacio graf |

### REST API Endpointok

| Method | Endpoint | Leiras |
|--------|----------|--------|
| POST | /api/v1/cognitive/enrich | Multi-forras kontextus gazdagitas (11 reteg) |
| POST | /api/v1/cognitive/reflect | Feladat utani tanulasi ciklus (6 reteg) |
| GET | /api/v1/cognitive/stats | Osszesitett statisztikak |
| POST | /api/v1/cognitive/query | Kozvetlen reteg lekerdezes (layer + query) |
| GET | /api/v1/cognitive/health | Rendszer egeszseg |

### Mikor hasznald

- **enrich**: MINDEN uj feladat elott — kontextust ad korabbi tapasztalatokbol, javasol agentet
- **reflect**: MINDEN feladat utan — elmenti a tanulsagot, noveli az intelligenciat
- **stats**: Rendszer diagnosztika — hany reteg aktiv, mennyi adat van
- **query**: Specifikus reteg lekerdezes — pl. "volt mar hasonlo feladat?"

