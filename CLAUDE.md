# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt Áttekintés

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

**Technológiák:** TypeScript (ESM), Express 5, Socket.IO, React 19 (Dashboard), Ollama, Gemini, GitHub Models, Python (FastAPI), LanceDB, Cloudflare Workers, SQLite

## Parancsok

```bash
# Build & Run
npm run build        # TypeScript fordítás (kötelező deploy előtt)
npm run dev          # HTTP API + MCP szerver (port 3000, ts-node/esm)
npm run dev:ui       # Vite Dashboard (port 5173)
npm run lint         # ESLint (max-warnings=0)
npm run lint:fix     # ESLint auto-fix

# Tesztelés
npm test                              # Build + Vitest run (KÖTELEZŐ munka előtt/után!)
npm run test:watch                    # Vitest watch mód
npx vitest run test/foo.test.ts       # Egy teszt fájl
npm run test:dashboard                # Dashboard-specifikus tesztek
npm run test:coverage                 # Coverage riport
npm run test:e2e                      # Playwright e2e tesztek
npm run health                        # Health check (scripts/health_check.ts)
npm run test:phoenix                  # Phoenix Protocol state restoration tesztek

# CLI
brunella                     # Interaktív menü (nyilak + Enter)
brunella chat                # Interaktív chat
brunella agents              # Ügynökök listázása
brunella conductor status    # Projekt státusz
brunella run <tool>          # MCP tool futtatás
brunella harvest run         # Tech-harvester pipeline

# Python alrendszer
cd myai && uv sync           # Függőségek
uvicorn server:app --reload --port 8000
```

## Architektúra

### Kettős Belépési Pont

A rendszernek **két különálló módja** van:

1. **`src/index.ts`** — MCP Szerver (StdioServerTransport) - AI kliensek (Claude Desktop stb.) használják
2. **`src/server/web.ts`** — HTTP REST API + Socket.IO szerver (port 3000) - Dashboard és CLI használja

Mindkettő `registerAllTools()` hívásával regisztrálja az MCP eszközöket (`src/server/registry.ts`-ból).

### Fő Komponensek

```
src/
├── index.ts         # MCP szerver (StdioServerTransport) - AI klienseknek
├── cli.ts           # CLI belépési pont (Commander.js, 70+ parancs)
├── analytics.ts     # CEAN Analytics Engine (PipelineEventBuilder → D1)
├── agents/          # AI ügynökök (IAgent interfész implementációk)
│   ├── types.ts     # IAgent, AgentResponse, AgentHandoff interfaces
│   ├── BaseAgent.ts # Absztrakt ősosztály (Bridge pattern)
│   ├── AgentManager.ts  # Registry, Task Queue, Worker Loop, RBAC
│   ├── permissions.ts   # Agent Permission System (RBAC + path restrictions)
│   └── registry.json    # Ügynök konfigurációk (name, module, triggers, priority)
├── tools/           # MCP tool definíciók & handlerek
│   └── toolPermissions.ts  # Tool → Permission mapping
├── server/          # Express + Socket.IO backend
│   ├── web.ts       # Fő webszerver (mountolja az összes route-ot)
│   ├── registry.ts  # registerAllTools() - MCP tool regisztrációk
│   ├── routes/      # REST API route-ok (~30 endpoint csoport)
│   └── SocketService.ts  # WebSocket kezelés
├── core/            # Infrastruktúra primitívek
│   ├── llm_client.ts       # Multi-provider LLM kliens (Ollama/Gemini/GitHub Models)
│   ├── modelRouter.ts      # Intelligent routing: "brain" (cloud) vs "muscle" (local)
│   ├── goldenDatasetBridge.ts  # G4.1 - Agent outputs → D1 golden samples
│   ├── checkpoint.ts       # Phoenix Protocol - állapot mentés/visszaállítás
│   ├── retryStrategy.ts    # Retry logika exponential backoff-fal
│   ├── auditLog.ts         # Audit trail SQLite-ban
│   └── phoenixEventBus.ts  # Öngyógyító esemény bus
├── dashboard/       # React UI (Vite, Tailwind v4, Radix UI)
│   ├── components/dashboard/  # Dashboard komponensek
│   ├── lib/apiService.ts       # API client methods
│   └── lib/navigation.tsx      # NavigationRegistry - panel regisztrációk
├── config/
│   └── schema.ts    # Zod config validáció (kötelező env vars)
└── utils/
    ├── logger.ts       # Structured logging (HASZNÁLD console.log helyett!)
    ├── health.ts       # Service health checks
    ├── metrics.ts      # Prometheus metrics
    ├── d1Adapter.ts    # Cloudflare D1 HTTP bridge (Node.js → Worker → D1)
    ├── vectorize.ts    # Cloudflare Vectorize kliens
    └── pythonShell.ts  # Python alrendszer kommunikáció
```

### Ügynök Hierarchia

```
OrchestratorAgent / EnterpriseOrchestratorAgent (Koordinátorok)
├── Core: DeveloperAgent, EvaluatorAgent, ResearcherAgent, TaskDecomposerAgent
├── Automation: RobotkezAgent, RobotkezV2Agent (Playwright), VoiceAgent
├── Enterprise Suite (~20 ügynök):
│   ├── Finance: FinanceGuardian, FinancialGuardAgent, ProcurementAgent
│   ├── Sales: SalesAgent, SalesHunterAgent, MarketingAgent, PricingAgent
│   ├── HR: HeadHunterAgent, ConflictMediatorAgent, SentimentAnalysisModule
│   ├── Logistics: LogisticsDispatcherAgent, LogisticsDispatcher
│   ├── Admin: EmailTriageAgent, GrantWatcherAgent, GrantHunter
│   └── Knowledge: KnowledgeBaseBuilderAgent, KnowledgeBuilder
├── Marketing: CopywriterAgent, MarketingDirectorAgent (TOML-alapú DynamicAgent)
├── Engineering: SpecWriterAgent, GenesisOrchestrator, UXDesignerAgent, LintFixerAgent
└── Management: ProjectConductorAgent (tracks.md szinkron)
```

`AgentManager` kezeli a registry-t (`registry.json`), Task Queue-t (SQLite), és a Worker Loop-ot. `DynamicAgent` TOML konfigurációból tölti be az ügynöket (`myai/agents/*.toml`).

### Model Router (Brain vs Muscle)

A `src/core/modelRouter.ts` RULE-MR1–4 szabályok alapján route-ol:
- **Brain (Cloud):** Gemini (1M context), GitHub Models GPT-4o — `complexity: 'high'` esetén
- **Muscle (Local):** Ollama `qwen2.5-coder:7b` — `complexity: 'low'` vagy `budget=0` esetén
- Auto-detect: `routeTask(description)` → felismeri a komplexitást regex alapján

### Cloudflare D1 Adapter

`src/utils/d1Adapter.ts` — Node.js nem érheti el D1-et közvetlenül:
```
Node.js → HTTP POST /d1/query → Cloudflare Worker → D1 Database
```
Táblák: `enterprise_events`, `agent_tasks`, `golden_samples`
Aktiválás: `CLOUDFLARE_WORKER_URL` + `CEAN_API_KEY` env változók szükségesek.

### Golden Dataset Bridge (G4.1)

`src/core/goldenDatasetBridge.ts` — Sikeres agent futások mentése D1-be fine-tuning célra:
- RULE-GD1: Ha egy agent sikeres + LLM volt → mentés
- RULE-GD2: Min. 10 karakter prompt, min. 0.5 quality score
- RULE-GD3: FNV-1a hash dedup (500 elem cache)

### Agent Permission System (RBAC)

`src/agents/permissions.ts` — Permission-alapú hozzáférés vezérlés:
- Minden agent-hez `PermissionProfile` definiál engedélyeket és path-korlátozásokat
- `globalPermissionManager.hasPermission(agentName, Permission.WRITE_FILE)`
- MCP tool-okhoz: `src/tools/toolPermissions.ts` (ToolPermissionMap)

### Config Validáció

`src/config/schema.ts` — Zod schema validálja az env változókat induláskor. Ha hibás a `.env`, a szerver nem indul el. Importálj innen: `import { config } from '../config/schema.js'`

## Kód Konvenciók (KRITIKUS!)

### 1. ESM + .js Kiterjesztés (KÖTELEZŐ!)

```typescript
// ✅ HELYES
import { foo } from './bar.js';

// ❌ HELYTELEN (build fail!)
import { foo } from './bar';
```

### 2. Logging (console.log TILOS production kódban!)

```typescript
// Agent kódban:
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
logInfo('AgentName', 'message');

// Szerver kódban:
import { Logger } from '../utils/logger.js';
const logger = new Logger('feature.log');
await logger.info('message');
```

### 3. Agent Implementációs Minta

```typescript
import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

export class MyAgent implements IAgent {
  name = 'MyAgent';
  role = 'Agent célja';
  description = 'Mit csinál';
  capabilities = ['skill1', 'skill2'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      return { status: 'success', data: result };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle'); // KÖTELEZŐ - garantálja az idle visszatérést!
    }
  }
}
```

### 4. MCP Tool Minta

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

// Regisztráció: src/server/registry.ts → registerAllTools() függvényben
```

## Fejlesztési Workflow

### Track Rendszer

```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```

Minden nagyobb fejlesztés = Track a `conductor/tracks/` mappában. Beolvasandók:
- `conductor/tracks.md` — aktív track-ek listája
- `conductor/tracks/<track_id>/plan.md` — részletes terv

Track archiválásnál: mozgasd `conductor/archive/<track-id>/`-ba.

### 0-Hiba Stratégia (KÖTELEZŐ minden commit előtt)

```bash
npm run build   # TypeScript fordítás - MUSZÁJ 0 hiba!
npm test        # Vitest tesztek - MUSZÁJ mind PASS!
```

**Ha bármelyik FAIL → NE commitolj!** Javítsd először.

### Új Agent Létrehozása

**Kód-alapú:**
1. `src/agents/MyNewAgent.ts` — Implementáció (IAgent interfész)
2. `src/agents/registry.json` — Regisztráció (name, module, class, triggers, priority)
3. `test/myNewAgent.test.ts` — Tesztek
4. `npm run build && npm test`

**TOML-alapú (DynamicAgent):**
1. `myai/agents/MyAgent.toml` — Konfiguráció (system_prompt, capabilities)
2. `src/agents/registry.json` — Regisztráció: `"class": "DynamicAgent"`, `"config": { "tomlPath": "myai/agents/MyAgent.toml" }`

### Dashboard Komponens Hozzáadása

1. `src/dashboard/components/dashboard/MyComponent.tsx` — Komponens (Radix UI + Tailwind v4)
2. `src/dashboard/lib/apiService.ts` — API client method
3. `src/server/routes/` — Backend endpoint
4. `src/dashboard/lib/navigation.tsx` — `navigationRegistry.registerItem(...)` hívással, majd a megfelelő grouphoz add hozzá

## Environment Variables (.env)

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**LLM Providerek:**
```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash   # Default model
GITHUB_PAT=...                   # GitHub Models (GPT-4o) + Copilot
OLLAMA_MODEL=qwen2.5-coder:7b   # Default local model
```

**Model Router vezérlés:**
```env
ROUTER_BUDGET=50            # 0=csak Ollama, 100=mindig Cloud
ROUTER_PREFER_LOCAL=true    # Medium komplexitásnál local preferált
ROUTER_FALLBACK=true        # Cloud fallback engedélyezése
ROUTER_OVERRIDE_MODEL=...   # Kényszer model (manuális override)
```

**Cloudflare/Edge:**
```env
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_WORKER_URL=...   # CEAN Worker URL
CEAN_API_KEY=...            # D1 hozzáférés (Worker ↔ D1)
EDGE_ENABLED=true
```

**Opcionális:**
```env
LANGCHAIN_API_KEY=...       # LangSmith tracing
PYTHON_BASE_URL=http://localhost:8000
```

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

## API Végpontok

| Végpont | Leírás |
|---------|--------|
| `GET /api/health` | Rendszer állapot (Ollama, Cloudflare, Python) |
| `GET /api/agents` | Ügynökök listája |
| `POST /api/agents/:name/execute` | Ügynök futtatás |
| `POST /api/v1/tracks/generate` | Track generálás (SpecWriterAgent) |
| `GET /api/tools` | MCP eszközök |
| `POST /api/ollama/generate` | LLM generálás |
| `GET /metrics` | Prometheus metrics |
| `GET /api-docs` | Swagger UI |

## Anti-Patterns (Kerülendők!)

- `any` típus indoklás nélkül — használj `unknown` vagy konkrét típust
- CommonJS `require()` — ez ESM projekt!
- `console.log()` production kódban
- Import `.js` kiterjesztés nélkül
- Agent-ben hiányzó `finally` blokk
- `conductor/tracks.md` kézi szerkesztése (ProjectConductor kezeli)
- D1 közvetlen elérése Node.js-ből (mindig D1Adapter HTTP bridge-en keresztül)

## További Dokumentáció

- **README.md** — Teljes projekt dokumentáció
- **`.ai/FOSZAL.md`** — Mi történt legutóbb? (egyesített napló)
- **`docs/cloudflare/INFRASTRUCTURE.md`** — Cloudflare Workers dokumentáció
- **`conductor/tracks.md`** — Aktív fejlesztési szálak
- **`conductor/workflow.md`** — Data Flywheel & Phoenix Protocol

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
