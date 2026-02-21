# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Projekt Áttekintés

**Brunella Agent System (BAS)** - AI multi-agent rendszer szoftverfejlesztés automatizálására lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

**Technológiák:** TypeScript (ESM), Express 5, Socket.IO, React 19 (Dashboard), Ollama, Gemini, GitHub Models, Python (FastAPI), LanceDB, Cloudflare Workers, SQLite

## Parancsok

```bash
# Build & Run
npm run build        # TypeScript fordítás (kötelező deploy előtt)
npm run dev          # MCP szerver + HTTP API (port 3000, ts-node/esm)
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
│   ├── llm_client.ts     # Multi-provider LLM kliens (Ollama/Gemini/GitHub Models)
│   ├── modelRouter.ts    # Intelligent routing: "brain" (cloud) vs "muscle" (local)
│   ├── checkpoint.ts     # Phoenix Protocol - állapot mentés/visszaállítás
│   ├── retryStrategy.ts  # Retry logika exponential backoff-fal
│   ├── auditLog.ts       # Audit trail SQLite-ban
│   └── phoenixEventBus.ts # Öngyógyító esemény bus
├── dashboard/       # React UI (Vite, Tailwind v4, Radix UI)
│   ├── components/dashboard/  # Dashboard komponensek
│   ├── lib/apiService.ts       # API client methods
│   └── lib/navigation.tsx      # Routing (activeItem?.component minta)
├── config/
│   └── schema.ts    # Zod config validáció (kötelező env vars)
└── utils/
    ├── logger.ts    # Structured logging (HASZNÁLD console.log helyett!)
    ├── health.ts    # Service health checks
    ├── metrics.ts   # Prometheus metrics
    └── pythonShell.ts  # Python alrendszer kommunikáció
```

### Ügynök Hierarchia

```
OrchestratorAgent (Központi koordinátor)
  ├── DeveloperAgent        - Kód írás, Python végrehajtás, self-healing build
  ├── EvaluatorAgent        - Audit, testing, code review
  ├── ResearcherAgent       - Web search, RAG keresés (LanceDB)
  ├── DataScientistAgent    - Adat elemzés, LanceDB
  ├── EdgeProxyAgent        - Cloudflare Workers proxy
  ├── ProjectConductorAgent - Docs sync, track management, anomaly scan
  ├── SpecWriterAgent       - Automatikus track generálás LLM-mel
  ├── TaskDecomposerAgent   - Komplex feladat dekompozíció
  └── DynamicAgent          - TOML konfigból betöltött ügynök (myai/agents/*.toml)
```

`AgentManager` kezeli a registry-t (`registry.json`), Task Queue-t (SQLite), és a Worker Loop-ot (autonóm feladat feldolgozás). Ügynökök betöltése: `initialize()` → `registry.json` alapján dinamikus import.

### Model Router (Brain vs Muscle)

A `src/core/modelRouter.ts` intelligensen route-olja a feladatokat:
- **Brain (Cloud):** Gemini, GitHub Models (GPT-4o) — komplex tervezés, magas komplexitás
- **Muscle (Local):** Ollama — végrehajtás, alacsony komplexitás, budget=0

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
  // ... implementáció
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

1. `src/agents/MyNewAgent.ts` — Implementáció (IAgent interfész)
2. `src/agents/registry.json` — Regisztráció (name, module, class, triggers)
3. `test/myNewAgent.test.ts` — Tesztek
4. `npm run build && npm test`

### Dashboard Komponens Hozzáadása

1. `src/dashboard/components/dashboard/MyComponent.tsx` — Komponens (Radix UI + Tailwind v4)
2. `src/dashboard/lib/apiService.ts` — API client method
3. `src/server/routes/` — Backend endpoint
4. `src/dashboard/lib/navigation.tsx` — Navigáció bekötése

## Environment Variables (.env)

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**OPCIONÁLIS (de ajánlott):**
```env
GEMINI_API_KEY=...
GITHUB_PAT=...            # GitHub Models (GPT-4o) + Copilot
LANGCHAIN_API_KEY=...     # LangSmith tracing
CLOUDFLARE_API_TOKEN=...  # Edge deploy
CLOUDFLARE_WORKER_URL=... # Deployed worker URL
EDGE_ENABLED=true         # Cloudflare Edge funkciók bekapcsolása
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

## További Dokumentáció

- **README.md** — Teljes projekt dokumentáció
- **`.ai/FOSZAL.md`** — Mi történt legutóbb? (egyesített napló)
- **`docs/cloudflare/INFRASTRUCTURE.md`** — Cloudflare Workers dokumentáció
- **`conductor/tracks.md`** — Aktív fejlesztési szálak
- **`conductor/workflow.md`** — Data Flywheel & Phoenix Protocol

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
