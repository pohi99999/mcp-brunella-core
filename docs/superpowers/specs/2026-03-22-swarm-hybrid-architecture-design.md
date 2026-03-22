# Brunella Swarm Hybrid Architecture — Design Spec

**Dátum:** 2026-03-22
**Státusz:** APPROVED (brainstorming)
**Szerző:** Claude Code + Pohánka Péter
**Prioritás:** HIGH

---

## 1. Összefoglaló

Egy szigorúan rétegzett, hibrid lokális+felhő **Swarm architektúra** kiépítése a Brunella Agent System (BAS) meglévő kódbázisára. A cél a maximális autonómia, hibatűrés (Phoenix Protocol) és alacsony késleltetés elérése.

**Rendszer jelenlegi állapota:**
- 53 regisztrált agent (`src/agents/registry.json`)
- SwarmAgent + SwarmManager kód létezik (`src/agents/swarm/`) — de nincs bekötve
- Remote Layer (Phase 1–6) megépítve — de CEAN Worker nincs
- MCP tools regisztrálva (`src/server/registry.ts`) — de VSCode kapcsolat hibás
- Phoenix Protocol aktív (`src/core/checkpoint.ts` + `phoenixEventBus.ts`)
- Brunella szerver: Express HTTP `:3000` + MCP stdio (kettős mód)
- Python FastAPI: `:8000` (API), `:8010` (health)
- Dashboard: `:5173`

---

## 2. Architektúra — Hibrid Réteg (Választott megközelítés)

```
VSCode Copilot (Insiders)
    │
    ├── [STDIO — direkt, gyors, izolált]
    │   ├── filesystem-mcp      → projekt mappa + home
    │   ├── sqlite-mcp          → data/brunella.db
    │   ├── memory-mcp          → data/mcp_memory.json
    │   ├── fetch-mcp           → HTTP kérések
    │   ├── sequential-thinking → lépésenkénti gondolkodás
    │   ├── playwright-mcp      → browser automáció
    │   ├── chrome-devtools     → debug + teljesítmény
    │   ├── desktop-commander   → OS szintű vezérlés
    │   ├── context7            → docs keresés
    │   ├── vercel-devtools     → Next.js debug
    │   └── github-mcp          → [Docker] repo kezelés
    │
    └── [HTTP/SSE — Brunella :3000/sse]
            ├── agent_execute       → 53 agent bármelyike
            ├── swarm_dispatch      → SwarmManager kolónia
            ├── swarm_status        → kolónia állapotok
            ├── knowledge_search    → LanceDB RAG
            ├── knowledge_store     → dokumentum indexelés
            ├── track_list          → conductor/tracks.md
            ├── track_create        → SpecWriterAgent
            ├── task_decompose      → TaskDecomposer DAG
            ├── browser_action      → RobotkezV2
            ├── browser_extract     → strukturált adat
            ├── health_check        → teljes rendszer állapot
            └── phoenix_snapshot    → checkpoint mentés

Phoenix Protocol:
    Ollama timeout > 10s OR 3 sikertelen task
        → phoenixEventBus.subscribe('phoenix:degraded', ...)
        → BifrostGateway.setMode('edge-only')
        → CEAN Workers AI átvesz
        → Ollama visszatér → 'phoenix:recovery' → SwarmManager resume
```

---

## 3. Fázisok

### Fázis 1: MCP Tools + VSCode Konfiguráció

**Érintett fájlok:**
- `.vscode/mcp.json` — teljes újraírás
- `src/server/web.ts` — **NEM változik** (SSE transport `/sse`+`/messages` már létezik)

**`.vscode/mcp.json` — javított konfiguráció:**

Törlendő bejegyzések:
- `brunella-python` (nem létező modul)
- `my-mcp-server-ae032121` (hibás)
- `filesystem` (placeholder útvonal)
- `io.github.github/github-mcp-server` (duplikált GitHub)

Hozzáadandó bejegyzések:
- `brunella` — `type: "http"`, `url: "http://localhost:3000/sse"` (a meglévő SSE endpoint — lásd lent)
- `sequential-thinking` — `@modelcontextprotocol/server-sequential-thinking`
- `filesystem` — javított útvonalakkal (`F:\mcp-brunella-core`, `C:\Users\pohi9`)

Megtartandó (már OK):
- `chrome-devtools-mcp`, `desktop-commander`, `context7`, `vercel-devtools`, `playwright`, `sqlite`, `fetch`, `memory`, `cloudflare`

**Docker-ben futó MCP szerverek:**
- `github-mcp` — `ghcr.io/github/github-mcp-server:0.31.0`
- `memory-mcp` (opcionális Docker) — `node:22-alpine` + `@modelcontextprotocol/server-memory`

**Brunella SSE endpoint — MÁR LÉTEZIK, NEM KELL HOZZÁADNI:**
```
GET  /sse               → SSEServerTransport (MCP SDK) — web.ts:359
POST /messages?sessionId → MCP message handler — web.ts:369
```
A `web.ts` már importálja az `SSEServerTransport`-ot, és már hívja a `registerAllTools()`-t — az összes meglévő MCP tool automatikusan elérhető Copilotból.

**`src/server/web.ts` nem igényel módosítást Phase 1-ben.** Csak a `mcp.json` URL frissítése szükséges: `http://localhost:3000/sse`.

**Fontos:** A `src/server/routes/mcp.ts` router a `/api/v1/mcp/*` REST path-on fut — ez ELTÉR az SSE `/sse` + `/messages` endpoint-tól. Nincs routing ütközés.

---

### Fázis 2: Swarm Bekötés + Új MCP Tools

**Érintett fájlok:**
- `src/server/registry.ts` — 2 új tool: `swarm_dispatch`, `swarm_status`
- `src/agents/AgentManager.ts` — SwarmManager singleton inicializálás
- `src/agents/swarm/SwarmManager.ts` — alapértelmezett Triád kolónia konfig

**SwarmManager inicializálás (`AgentManager.ts`):**
```typescript
import { SwarmManager } from './swarm/SwarmManager.js';
export const swarmManager = new SwarmManager();
```

**Triád alapértelmezett kolónia:**
```typescript
const TRIAD_COLONY_CONFIG = {
  name: 'Triad',
  // IDs verified against src/agents/registry.json (lines 838, 139, 163):
  agentIds: ['researcher', 'DataScientist', 'Developer'],
  strategy: 'specialist',   // mindenki saját területén
  leaderElection: 'auto'    // competitive bid alapján
};
```

**Új MCP tool regisztrációk (`registry.ts`):**
```typescript
// swarm_dispatch: kolónia indítása feladattal
// swarm_status: aktív kolóniák listázása
```

---

### Fázis 3: Enterprise Event Bus (SQLite WAL)

**Érintett fájlok:**
- `src/core/eventBus.ts` — ÚJ fájl
- `src/server/SocketService.ts` — EventBus feliratkozás

**Adatbázis séma (`data/brunella.db`):**
```sql
CREATE TABLE IF NOT EXISTS event_bus (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  source   TEXT NOT NULL,
  type     TEXT NOT NULL,
  payload  TEXT NOT NULL,
  consumed INTEGER DEFAULT 0
);
PRAGMA journal_mode=WAL;
```

**Event típusok:**
```
task.started     | task.completed  | task.failed
swarm.spawned    | swarm.dissolved | swarm.leader_elected
agent.working    | agent.idle      | agent.error
system.failover  | system.recovered
phoenix.snapshot | phoenix.restored
```

**Integráció:**
- `SwarmManager` → `eventBus.emit()` minden kolónia eseménynél
- `AgentManager` → `eventBus.emit()` minden task state változásnál
- `SocketService` → `eventBus.on('*')` → WebSocket broadcast Dashboard-nak

---

### Fázis 4: CEAN Edge Agents + Phoenix Fallback

**Cloudflare Workers (új fájlok `workers/` mappában):**

| Worker | Cél | Trigger |
|--------|-----|---------|
| `cean-router` | API Gateway + Workers AI gyors feladatok | HTTP |
| `cean-harvest` | Scheduled harvest (GitHub, hírek, számlák) | Cron 6h |
| `cean-research` | ResearcherAgent edge verziója | HTTP (fallback) |
| `cean-refine` | DataScientist edge verziója | HTTP (fallback) |

**Workers AI modell:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast`

**Phoenix Protocol integráció (`src/core/phoenixEventBus.ts` kiegészítés):**

```typescript
// Failover küszöbök:
// - Ollama timeout > 10s → 'phoenix:degraded'
// - 3 egymást követő agent hiba → 'phoenix:degraded'
// - Ollama ping OK (30s polling) → 'phoenix:recovery'
//
// FONTOS: PhoenixEventBusClass szigorúan típusos PhoenixEventMap-et használ.
// Az eseménynevek: 'phoenix:degraded', 'phoenix:recovery' (NEM 'local.degraded'/'local.recovered')
// A metódus: phoenixEventBus.subscribe(...), NEM .on(...)

phoenixEventBus.subscribe('phoenix:degraded', async (_event) => {
  await saveCheckpoint('pre-edge-failover');
  bifrostGateway.setMode('edge-only');
  swarmManager.pauseAllColonies();  // lásd: Fázis 2 — SwarmManager módosítás
  eventBus.emit({ type: 'system.failover', target: 'edge' });
});

phoenixEventBus.subscribe('phoenix:recovery', async (_event) => {
  await restoreCheckpoint('pre-edge-failover');
  bifrostGateway.setMode('local-preferred');
  swarmManager.resumeAllColonies();  // lásd: Fázis 2 — SwarmManager módosítás
  eventBus.emit({ type: 'system.recovered' });
});
```

**Harvest sync endpoint (`src/server/routes/`):**
```
POST /api/harvest/sync  → CEAN Worker → D1 → LanceDB sync
GET  /api/harvest/status → utolsó harvest időpontja + stats
```

---

## 4. Adatfolyam — Teljes Kép

```
[Felhasználó / Copilot kérés]
        │
        ▼
[VSCode mcp.json réteg]
        │
        ├── Egyszerű feladat (fájl, SQL, fetch)
        │       └── STDIO szerver → azonnali válasz
        │
        └── Komplex feladat (agent, swarm, RAG)
                │
                ▼
        [Brunella :3000/sse SSE]
                │
                ▼
        [SwarmManager]
         Triád kolónia
                │
        ┌───────┴────────┐
        ▼                ▼
  [Ollama OK]      [Ollama DOWN]
  researcher       Phoenix emit
  DataScientist    'phoenix:degraded'
  Developer              │
        │                ▼
        │         [CEAN Workers]
        │         llama-3.3-70b
        │                │
        └───────┬─────────┘
                ▼
        [EventBus SQLite WAL]
                │
        ┌───────┴──────────┐
        ▼                  ▼
  [Dashboard :5173]   [D1 + LanceDB]
  real-time events    Golden Dataset
```

---

## 5. Érintett Fájlok Összefoglalója

| Fájl | Változás típusa |
|------|-----------------|
| `.vscode/mcp.json` | Teljes újraírás |
| `src/server/web.ts` | swarm router mount (Phase 2) — SSE transport már kész |
| `src/server/registry.ts` | 2 új MCP tool (swarm_dispatch, swarm_status) |
| `src/server/routes/swarm.ts` | ÚJ — REST route: `GET /api/v1/swarm/status`, `POST /api/v1/swarm/dispatch` |
| `src/server/web.ts` | swarm router mount hozzáadása (`v1Router.use('/swarm', swarmRouter)`) |
| `src/agents/AgentManager.ts` | SwarmManager singleton |
| `src/agents/swarm/SwarmManager.ts` | Triád default konfig + `pauseAllColonies()` + `resumeAllColonies()` hozzáadása + `'paused'` status a SwarmColony union-hoz |
| `src/core/eventBus.ts` | ÚJ — SQLite WAL event bus |
| `src/core/phoenixEventBus.ts` | Failover/recovery handler kiegészítés |
| `src/server/SocketService.ts` | EventBus → WebSocket bridge |
| `src/server/routes/harvest.ts` | ÚJ — harvest sync endpoint |
| `workers/cean-router/index.ts` | ÚJ — Edge API Gateway |
| `workers/cean-harvest/index.ts` | ÚJ — Scheduled harvest |
| `workers/cean-research/index.ts` | ÚJ — ResearcherAgent edge |
| `workers/cean-refine/index.ts` | ÚJ — DataScientist edge |
| `docker-compose.yml` | github-mcp + memory-mcp service |
| `.env` | CEAN_WORKER_URL, CEAN_API_KEY |
| `src/dashboard/components/dashboard/SwarmStatusWidget.tsx` | ÚJ — Swarm státusz widget stub (EPP v2 Rule 6) |
| `src/dashboard/lib/widgetRegistry.tsx` | SwarmStatusWidget regisztráció |
| `src/cli.ts` | `brunella swarm status` + `brunella swarm dispatch` parancsok |

---

## 6. Nem Változik (Scope határok)

- `src/agents/swarm/SwarmAgent.ts` — kód jó, csak inicializálás hiányzik
- `src/core/checkpoint.ts` — meglévő Phoenix snapshot logika marad
- `src/core/bifrost_gateway.ts` — edge-only mód már implementált
- `myai/` Python alrendszer — nincs érintve

## 6.1 Dashboard + CLI (EPP v2 Rule 6 megfelelőség)

**Fázis 2-ban kötelező** (EPP v2 Rule 6 — minden új feature Dashboard + CLI-t kap):

**Dashboard widget stub (`src/dashboard/components/dashboard/SwarmStatusWidget.tsx`):**
- Mutatja az aktív kolóniák listáját (colony name, status, agent count)
- Adatforrás: `GET /api/v1/swarm/status` REST endpoint (Fázis 2-ban hozzáadandó — `src/server/routes/swarm.ts`)
- `WIDGET_REGISTRY`-ba regisztrálva (`src/dashboard/lib/widgetRegistry.tsx`), alapból kikapcsolt

**CLI parancs (`src/cli.ts`):**
- `brunella swarm status` — aktív kolóniák listázása
- `brunella swarm dispatch "<task>"` — Triád kolónia indítása feladattal

Ez a stub minimális (csak read-only státusz megjelenítés) — teljes UI a Fázis 5 scope-ja.

---

## 7. Siker Kritériumok

- [ ] VSCode Copilot Chat látja az összes MCP szervert (stdio + brunella HTTP/SSE)
- [ ] `swarm_dispatch` tool elérhető Copilotból, Triád kolónia indul
- [ ] EventBus eseményei megjelennek a Dashboard SocketService-en
- [ ] Ollama leállításkor Phoenix automatikusan CEAN-ra vált (< 15s)
- [ ] Ollama visszatérésekor automatikusan visszakapcsol (< 35s)
- [ ] `npm run build && npm test` — 0 hiba, mind PASS
