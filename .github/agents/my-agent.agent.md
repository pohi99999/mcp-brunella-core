# Copilot Instructions — Brunella Agent System (BAS)

> Master dokumentum: `README.md` — ha ellentmondást találsz bármely fájllal, a README az irányadó.

## Build, Test, Lint

```bash
npm run build                         # TypeScript fordítás (tsc + registry.json/TRIZ másolás)
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

**Node.js backend** (`src/`): TypeScript ESM, Express 5, Socket.IO. ~48 REST API route fájl a `src/server/routes/`-ban. WebSocket: `src/server/SocketService.ts`.

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

## Hibaelhárítás

| Hiba | Megoldás |
|------|----------|
| `ERR_MODULE_NOT_FOUND` | Import hiányzó `.js` kiterjesztés → add hozzá |
| `npm test` timeout | `fileParallelism: false` vitest.config-ban → növeld a timeout-ot |
| Ollama nem elérhető | Indítsd el: `ollama serve`, ellenőrizd: `http://localhost:11434` |
| FastAPI nem indul | `cd myai && uv sync && uvicorn server:app --reload --port 8000` |
| Agent "stuck" (working) | Phoenix Protocol: 3 retry → auto idle reset. Kézi: `setAgentStatus(name, 'idle')` |
| Dashboard build hiba | `npm run build:ui` — külön tsconfig.ui.json és vite.config.ts |
