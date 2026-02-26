# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt Áttekintés

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

**Technológiák:** TypeScript (ESM), Express 5, Socket.IO, React 19, Ollama, Gemini, GitHub Models, Python (FastAPI), LanceDB, Cloudflare Workers, SQLite, E2B Sandboxes

**Master dokumentum:** `README.md` — ha ellentmondást találsz, a README az irányadó.

---

## KÖTELEZŐ Bootstrap Protokoll (Munkamenet Elején!)

### 1. GitHub Szinkronizálás (MINDIG ELŐSZÖR!)
```bash
bash scripts/sync.sh          # Git Bash / WSL
# VAGY: scripts\sync.bat (Windows CMD)
```

### 2. Kritikus Fájlok Beolvasása
```
KÖTELEZŐ:
- package.json                    # Függőségek, scriptek, verzió
- tsconfig.json                   # TypeScript konfiguráció
- src/agents/registry.json        # Ügynök regisztráció
- PROJEKT_DIAGRAM.md              # Rendszer architektúra
- conductor/tracks.md             # Aktív track-ek
- .ai/FOSZAL.md                   # Mi történt legutóbb?
- TEST_RESULTS.md                 # Legutóbbi teszt eredmények
```

### 3. Rendszer Validáció
```bash
npm run build                 # TypeScript fordítás (MUSZÁJ OK!)
npm test                      # Vitest tesztek (MUSZÁJ PASS!)
tail -n 50 logs/phoenix.log   # Phoenix Protocol hibák ellenőrzése
```

**Ha BUILD FAIL vagy TESZT FAIL → NE kezdj fejlesztésbe! Javítsd először!**

---

## Parancsok

```bash
# Build & Run
npm run build        # TypeScript fordítás (kötelező deploy előtt)
npm run dev          # Dual-mode szerver: MCP stdio + Express HTTP (:3000)
npm run dev:ui       # Vite Dashboard (:5173)
npm run lint         # ESLint (max-warnings=0)
npm run lint:fix     # ESLint auto-fix
npm run smoke        # Gyors health check (Ollama, Express, FastAPI)

# Tesztelés
npm test                              # Build + Vitest run (KÖTELEZŐ munka előtt/után!)
npm run test:watch                    # Vitest watch mód
npx vitest run test/foo.test.ts       # Egy teszt fájl
npm run test:coverage                 # Coverage riport
npm run test:e2e                      # Playwright e2e tesztek
npm run test:phoenix                  # Phoenix Protocol state restoration tesztek
npm run health                        # Health check (scripts/health_check.ts)

# CLI
brunella                        # Interaktív menü (nyilak + Enter)
brunella chat                   # Interaktív chat
brunella agents                 # Ügynökök listázása
brunella conductor status       # Projekt státusz
brunella run <tool>             # MCP tool futtatás
brunella harvest run            # Tech-harvester pipeline
brunella robotkez chat "..."    # RobotkezV2 böngésző ügynök
brunella robotkez plan "..."    # RobotkezV2 plan preview (végrehajtás nélkül)
brunella robotkez status        # RobotkezV2 státusz
brunella decompose [task]       # Feladat dekompozíció (preview-only DAG)
brunella architect create [d]   # Új ügynök létrehozása TOML config-ból
brunella jules tests            # Jules async test suite

# Chat interaktív parancsok (brunella chat-en belül)
/edge on|off         # Cloudflare Edge mód be/ki
/switch ollama       # Váltás Ollama-ra
/switch gemini       # Váltás Gemini-re
/switch claude       # Váltás Claude-ra
/model <név>         # Ollama modell váltás
/save                # Utolsó kód mentése
/run                 # Utolsó kód futtatása

# Python alrendszer
cd myai && uv sync           # Függőségek
uvicorn server:app --reload --port 8000

# Szinkron & koordináció (munkamenet elején!)
bash scripts/sync.sh           # GitHub szinkronizálás (Jules PR-ek pull)
python scripts/sync_foszal.py  # .ai/FOSZAL.md frissítése munka után
```

---

## Architektúra

### Kettős Belépési Pont

**`src/index.ts`** — Dual-mode szerver: egyszerre indít MCP StdioServerTransport-ot (Claude Desktop / AI kliensek számára) ÉS Express HTTP szervert (:3000, Dashboard + CLI számára).

**`src/server/web.ts`** — Az Express webszerver modulja, amit `src/index.ts` importál. Ha csak a webes API-t akarod futtatni izoláltan, direkten is futtatható.

Mindkét mód `registerAllTools()` hívásával regisztrálja az MCP eszközöket (`src/server/registry.ts`).

### Fő Komponensek

```
src/
├── index.ts              # Dual-mode belépési pont (MCP stdio + Express)
├── cli.ts                # CLI belépési pont (Commander.js, 70+ parancs)
├── analytics.ts          # CEAN Analytics Engine (PipelineEventBuilder → D1)
├── agents/
│   ├── types.ts          # IAgent, AgentResponse, AgentHandoff, ChainStep interfaces
│   ├── BaseAgent.ts      # Absztrakt ősosztály (Bridge pattern + RAG memória)
│   ├── AgentManager.ts   # Registry, Task Queue, Worker Loop, RBAC
│   ├── permissions.ts    # Agent Permission System (RBAC + path restrictions)
│   └── registry.json     # Ügynök konfigurációk (name, module, triggers, priority)
├── tools/
│   └── toolPermissions.ts  # Tool → Permission mapping
├── server/
│   ├── web.ts            # Express + Socket.IO szerver
│   ├── registry.ts       # registerAllTools() — MCP tool regisztráció
│   ├── routes/           # REST API route-ok (~30 endpoint csoport)
│   └── SocketService.ts  # WebSocket kezelés
├── core/
│   ├── llm_client.ts         # Multi-provider LLM kliens (Ollama/Gemini/GitHub Models)
│   ├── modelRouter.ts        # Brain vs Muscle routing (RULE-MR1–4)
│   ├── bifrost_gateway.ts    # Multi-LLM Gateway (auto provider-select, 4 provider)
│   ├── goldenDatasetBridge.ts # G4.1 - Agent outputs → D1 golden samples
│   ├── checkpoint.ts         # Phoenix Protocol — állapot mentés/visszaállítás
│   ├── auditLog.ts           # Audit trail SQLite-ban
│   ├── phoenixEventBus.ts    # Öngyógyító esemény bus
│   └── julesIntegration.ts   # Jules AI async task management
├── security/
│   └── e2b_sandbox_manager.ts # E2B izolált Python végrehajtás
├── dashboard/            # React UI (Vite, Tailwind v4, Radix UI)
│   ├── components/dashboard/  # Dashboard komponensek
│   ├── lib/apiService.ts       # API client methods
│   └── lib/navigation.tsx      # NavigationRegistry — panel regisztrációk
├── config/
│   ├── schema.ts         # Zod config validáció (kötelező env vars)
│   └── safe_zones.json   # MCP Filesystem Server whitelist/blacklist
└── utils/
    ├── logger.ts         # Structured logging (HASZNÁLD console.log helyett!)
    ├── health.ts         # Service health checks
    ├── d1Adapter.ts      # Cloudflare D1 HTTP bridge
    ├── vectorize.ts      # Cloudflare Vectorize kliens
    └── pythonShell.ts    # Python alrendszer kommunikáció
```

### Ügynök Hierarchia

```
OrchestratorAgent / EnterpriseOrchestratorAgent (Koordinátorok)
├── Core: DeveloperAgent, EvaluatorAgent, ResearcherAgent, TaskDecomposerAgent
├── Automation: RobotkezV2Agent (Playwright/LLM), VoiceAgent (Whisper)
├── Engineering: SpecWriterAgent, GenesisOrchestrator, UXDesignerAgent, LintFixerAgent
├── Enterprise Suite (~20 ügynök):
│   ├── Finance: FinanceGuardian, FinancialGuardAgent, ProcurementAgent
│   ├── Sales/Marketing: SalesAgent, CopywriterAgent, MarketingDirectorAgent
│   ├── HR: HeadHunterAgent, ConflictMediatorAgent
│   ├── Logistics: LogisticsDispatcherAgent
│   └── Admin: EmailTriageAgent, GrantWatcherAgent, KnowledgeBaseBuilderAgent
├── TOML-alapú DynamicAgent: myai/agents/*.toml (MarketingDirector, stb.)
└── Management: ProjectConductorAgent (tracks.md szinkron)
```

`AgentManager` kezeli a registry-t (`registry.json`), Task Queue-t (SQLite), és a Worker Loop-ot.

### Model Router (Brain vs Muscle)

`src/core/modelRouter.ts` — RULE-MR1–4 szabályok:
- **Brain (Cloud):** Gemini (1M ctx), GitHub Models GPT-4o → `complexity: 'high'` esetén
- **Muscle (Local):** Ollama `qwen2.5-coder:7b` → `complexity: 'low'` vagy `budget=0`
- Auto-detect: `routeTask(description)` felismeri a komplexitást regex alapján

**Bifrost Gateway** (`src/core/bifrost_gateway.ts`) — magasabb szintű absztrakció, 4 providert kezel egyszerre (Ollama, Gemini, GitHub Models, Anthropic), auto-fallbackkel.

### Cloudflare D1 Adapter

`src/utils/d1Adapter.ts` — Node.js nem érheti el D1-et közvetlenül:
```
Node.js → HTTP POST /d1/query → Cloudflare Worker → D1 Database
```
Aktiválás: `CLOUDFLARE_WORKER_URL` + `CEAN_API_KEY` env változók szükségesek.

### MCP Filesystem Server & Safe Zones

`config/safe_zones.json` — Whitelist/blacklist alapú fájlrendszer-hozzáférés. A `.env`, `.git/**`, `*.key` automatikusan tiltva. Audit log: `logs/mcp_audit.log`.

### E2B Sandbox

`src/security/e2b_sandbox_manager.ts` — Izolált Python kód végrehajtás (DataScientistAgent alapértelmezetten ezt használja). Aktiválás: `E2B_API_KEY` env.

### Golden Dataset Bridge (G4.1)

`src/core/goldenDatasetBridge.ts` — Sikeres agent futások mentése D1-be fine-tuning célra. RULE-GD1–3: min. 10 karakter prompt, 0.5 quality score, FNV-1a hash dedup.

### Agent Permission System (RBAC)

`src/agents/permissions.ts` — Minden agent-hez `PermissionProfile` definiál engedélyeket és path-korlátozásokat. `globalPermissionManager.hasPermission(agentName, Permission.WRITE_FILE)`.

---

## Kód Konvenciók (KRITIKUS!)

### ESM + .js Kiterjesztés (KÖTELEZŐ!)

```typescript
import { foo } from './bar.js';   // ✅ HELYES
import { foo } from './bar';      // ❌ HELYTELEN (build fail!)
```

### Logging (console.log TILOS production kódban!)

```typescript
// Agent kódban:
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
logInfo('AgentName', 'message');

// Szerver kódban:
import { Logger } from '../utils/logger.js';
const logger = new Logger('feature.log');
await logger.info('message');
```

### Agent Implementációs Minta

**IAgent (egyszerű agent):**
```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = 'MyAgent';
  role = 'Agent célja';
  description = 'Mit csinál';
  capabilities = ['skill1'];

  async execute(task: string, context?: Record<string, unknown>): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      return { status: 'success', data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle'); // KÖTELEZŐ!
    }
  }
}
```

**BaseAgent (komplex agent, RAG memóriával):**
```typescript
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';

export class MyComplexAgent extends BaseAgent {
  name = 'MyComplex';
  role = 'Szerep';
  description = 'Komplex ügynök';
  capabilities = ['skill1'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // context.pastExperiences: RAG memória automatikusan betöltve
    return { success: true, message: 'OK', data: result };
  }
}
```

### MCP Tool Minta

```typescript
// src/tools/myTool.ts
export const myToolDefinition = {
  name: 'my_tool',
  description: 'Tool célja',
  inputSchema: { type: 'object', properties: { param: { type: 'string' } }, required: ['param'] }
};

export async function myToolHandler(params: { param: string }) {
  return { success: true, data: result };
}
// Regisztráció: src/server/registry.ts → registerAllTools()
```

---

## Fejlesztési Workflow

### Track Rendszer

```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```

Minden nagyobb fejlesztés = Track a `conductor/tracks/` mappában. Track archiválásnál: mozgasd `conductor/archive/<track-id>/`-ba.

**Aktuális állapot:** `conductor/tracks.md` — 14 aktív track, 74 archivált.

### Engineering Precision Protocol v2 (EPP v2) — 7 Arany Szabály

| # | Szabály | Mit jelent? |
|---|---------|-------------|
| 1 | Track Required | Nincs kódírás track nélkül |
| 2 | Fix Bugs First | Fejlesztés közben talált hibák azonnal javítandók |
| 3 | Commit Often | Minden Phase befejezése után git commit |
| 4 | TODO List | Track.md checkbox lista folyamatos frissítése |
| 5 | All Tests Green | COMPLETED csak ha: build ✅ + test ✅ + manual ✅ |
| **6** | **Dashboard + CLI** | **Mindkettő KÖTELEZŐ minden új funkcióhoz!** |
| 7 | Final Docs | Track befejezés után: `.ai/<agent>.md` + `sync_foszal.py` |

**Dashboard + CLI kötelező:**
- `src/dashboard/components/dashboard/MyComponent.tsx` — Radix UI + Tailwind
- `src/server/routes/` — Backend endpoint
- `src/dashboard/lib/navigation.tsx` — `navigationRegistry.registerItem(...)` hívás
- `src/cli.ts` — CLI parancs hozzáadása (magyar, inquirer.js menü, nyíl+enter navigáció)

### 0-Hiba Stratégia (KÖTELEZŐ minden commit előtt)

```bash
npm run build   # TypeScript fordítás - MUSZÁJ 0 hiba!
npm test        # Vitest tesztek - MUSZÁJ mind PASS!
```

**Ha bármelyik FAIL → NE commitolj! Javítsd először.**

### AI Ügynök Koordináció (.ai/ mappa)

```
.ai/
├── FOSZAL.md     # Egyesített napló (auto-generált, KÖTELEZŐ olvasni munkamenet elején!)
└── claude.md     # Claude Code saját naplója (KÖTELEZŐ frissíteni munkamenet végén!)
```

**Munkamenet végén add hozzá** `.ai/claude.md`-be:
```markdown
### YYYY-MM-DD HH:MM - [Rövid cím]
**Feladat:** Mit csináltál
**Érintett fájlok:** fájl1.ts, fájl2.ts
**Státusz:** ✅ Befejezve / ⏳ Folyamatban
**Megjegyzés:** Info a következő ügynöknek
```
Majd: `python scripts/sync_foszal.py`

### Teszt Eredmények Dokumentálása

Ha új tesztet írtál vagy teszteket futtattál:
```bash
echo "## Teszt Futás - $(date +%Y-%m-%d_%H-%M)" >> TEST_RESULTS.md
npm test 2>&1 | tee -a TEST_RESULTS.md
```

### Új Agent Létrehozása

**Kód-alapú:**
1. `src/agents/MyNewAgent.ts` — IAgent vagy BaseAgent implementáció
2. `src/agents/registry.json` — Regisztráció (name, module, class, triggers, priority)
3. `test/myNewAgent.test.ts` — Tesztek
4. `npm run build && npm test`

**TOML-alapú (DynamicAgent):**
1. `myai/agents/MyAgent.toml` — system_prompt, capabilities
2. `registry.json` — `"class": "DynamicAgent"`, `"config": { "tomlPath": "..." }`

---

## Environment Variables (.env)

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**LLM Providerek:**
```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
GITHUB_PAT=...              # GitHub Models (GPT-4o)
OLLAMA_MODEL=qwen2.5-coder:7b
ANTHROPIC_API_KEY=...       # Claude (Bifrost Gateway)
E2B_API_KEY=...             # Secure Python sandboxes
```

**Model Router:**
```env
ROUTER_BUDGET=50            # 0=csak Ollama, 100=mindig Cloud
ROUTER_PREFER_LOCAL=true
ROUTER_FALLBACK=true
ROUTER_OVERRIDE_MODEL=...   # Kényszer model
```

**Cloudflare/Edge:**
```env
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_WORKER_URL=...   # CEAN Worker URL
CEAN_API_KEY=...            # D1 hozzáférés
EDGE_ENABLED=true
```

---

## API Végpontok

| Végpont | Leírás |
|---------|--------|
| `GET /api/health` | Rendszer állapot (Ollama, Cloudflare, Python) |
| `GET /api/agents` | Ügynökök listája |
| `POST /api/agents/:name/execute` | Ügynök futtatás |
| `POST /api/v1/tracks/generate` | Track generálás (SpecWriterAgent) |
| `GET /api/v1/mcp/tools` | MCP eszközök |
| `POST /api/ollama/generate` | LLM generálás |
| `GET /metrics` | Prometheus metrics |
| `GET /api-docs` | Swagger UI |
| `GET /api/cloudflare/status` | Edge státusz |

---

## Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| "Ollama connection failed" | `ollama serve` futtatása |
| Port 3000 foglalt | `PORT=3001 npm run dev` |
| Python import hiba | `cd myai && uv sync` |
| Build hiba | `rmdir /s /q build && npm run build` |
| Teszt fail | **JAVÍTSD**, ne töröld! |
| `.js` import hiba | Add hozzá `.js` kiterjesztést |
| Cloudflare health fail | `.env` frissítés → Node.js restart → health check |
| D1 disabled | `CLOUDFLARE_WORKER_URL` + `CEAN_API_KEY` hiányzik |
| Dashboard fehér képernyő | Console import hiba, ellenőrizd a props-okat |
| LanceDB ImportError | `cd myai && uv pip install lancedb pyarrow` |
| uv sync lock hiba | `Remove-Item -Recurse -Force .venv && uv venv && uv sync` |

---

## Anti-Patterns (Kerülendők!)

- `any` típus indoklás nélkül — használj `unknown` vagy konkrét típust
- CommonJS `require()` — ez ESM projekt
- `console.log()` production kódban
- Import `.js` kiterjesztés nélkül
- Agent-ben hiányzó `finally` blokk (`setAgentStatus(this.name, 'idle')` kötelező!)
- `conductor/tracks.md` kézi szerkesztése (ProjectConductor kezeli)
- D1 közvetlen elérése Node.js-ből (mindig D1Adapter HTTP bridge-en keresztül)
- Új funkció Dashboard + CLI nélkül (EPP v2 6. szabály!)

---

## További Dokumentáció

- **README.md** — Master dokumentum (ez az elsődleges forrás!)
- **`PROJEKT_DIAGRAM.md`** — Rendszer architektúra (munkamenet elején KÖTELEZŐ!)
- **`.ai/FOSZAL.md`** — Mi történt legutóbb? (munkamenet elején KÖTELEZŐ!)
- **`TEST_RESULTS.md`** — Legutóbbi teszt eredmények
- **`docs/cloudflare/INFRASTRUCTURE.md`** — Cloudflare Workers részletek
- **`conductor/tracks.md`** — Aktív fejlesztési szálak
- **`conductor/epp-v2.md`** — EPP v2 teljes protokoll
- **`conductor/workflow.md`** — Data Flywheel & Phoenix Protocol
- **`docs/robotkezv2-user-guide.md`** — RobotkezV2 felhasználói útmutató

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
