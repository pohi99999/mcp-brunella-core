# Gold Protocol - Technikai Specifikáció
**Track:** gold_protocol
**Típus:** System Enhancement
**Prioritás:** CRITICAL
**Státusz:** pending_approval

---

## 1. Bevezetés

A Gold Protocol a Brunella Agent System (BAS) átfogó fejlesztési terve, amely 6 stratégiai pillérre épít:

1. **Spec-Driven Development** — Nincs kód specifikáció nélkül
2. **Phoenix Protocol v2** — Öngyógyító, reziliens rendszer
3. **Hibrid Intelligencia** — Intelligens modell-routing
4. **Kognitív Memória** — Proaktív tanulás és finomhangolás
5. **Glass Box Observability** — Teljes átláthatóság
6. **Autonóm Eszközkészlet** — Runtime permission enforcement + audit

## 2. Architekturális Változások

### 2.1 Új modulok (`src/core/`)
```
src/core/
├── checkpoint.ts        # Részfeladat állapotmentés (SQLite)
├── retryStrategy.ts     # Exponential backoff retry wrapper
├── processMonitor.ts    # Python shell + külső process health
├── gitRecovery.ts       # Automatikus git checkpoint hiba után
├── modelRouter.ts       # Feladat→Modell intelligens routing
├── codebaseIndexer.ts   # Proaktív LanceDB indexelés
├── goldenDatasetBridge.ts # Node.js→Python golden dataset mentés
└── auditLog.ts          # Persistent permission audit trail
```

### 2.2 Módosított modulok
```
src/agents/
├── AgentManager.ts      # +retry, +checkpoint, +trace, +audit, +golden save
├── DeveloperAgent.ts    # +spec gate enforcement
├── SpecWriterAgent.ts   # +meta.json status management
└── OrchestratorAgent.ts # +model selection via router

src/core/
└── llm_client.ts        # +model router integration

src/utils/
├── telemetry.ts         # Fix console.log → logger
└── agentTracer.ts       # ÚJ: Delegation chain tracing

src/server/
├── web.ts               # +audit routes, +telemetry routes, +reindex endpoint
├── registry.ts          # +permission middleware wrapper
└── telemetryRoutes.ts   # ÚJ: Token usage + trace API
```

### 2.3 Új adatbázis sémák
```sql
-- schemas/checkpoint.sql
CREATE TABLE IF NOT EXISTS checkpoints (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    step_index INTEGER NOT NULL,
    step_name TEXT NOT NULL,
    state_json TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- schemas/telemetry.sql  
CREATE TABLE IF NOT EXISTS token_usage (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trace_id TEXT,
    agent_name TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cost_usd REAL DEFAULT 0.0,
    latency_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- schemas/audit.sql
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    agent_name TEXT NOT NULL,
    action TEXT NOT NULL,
    resource TEXT,
    result TEXT CHECK(result IN ('ALLOWED','DENIED')),
    reason TEXT,
    metadata_json TEXT
);
```

## 3. Viselkedési Követelmények

### 3.1 Spec Freeze Protocol
- **RULE-SF1:** DeveloperAgent.execute() BLOCKED response-t ad, ha context.trackId-hez nincs `approved` státuszú spec
- **RULE-SF2:** SpecWriterAgent generál spec.md + meta.json (`status: "pending_approval"`)
- **RULE-SF3:** Jóváhagyás: `approveSpec(trackId)` → meta.json `status: "approved"`
- **EXCEPTION:** Ha a task nem tartalmaz trackId-t (ad-hoc feladat), a spec gate SKIP

### 3.2 Phoenix Protocol v2
- **RULE-PH1:** Minden agent execute UTÁN checkpoint mentés (ha sikeres részfeladat)
- **RULE-PH2:** Retry 3x exponential backoff: 1s → 3s → 10s
- **RULE-PH3:** Python shell crash → Silent Restart (max 3x)
- **RULE-PH4:** 3. retry FAIL → git auto-checkpoint + emberi értesítés
- **RULE-PH5:** Recovery: loadCheckpoint() → folytatás onnan ahol megállt

### 3.3 Model Router
- **RULE-MR1:** `task.complexity === 'high'` (planning, architecture) → Cloud model (GPT-4o/Gemini)
- **RULE-MR2:** `task.complexity === 'low'` (code gen, tests, docs) → Ollama lokális
- **RULE-MR3:** `budget === 0` → Kizárólag Ollama
- **RULE-MR4:** Fallback: ha Cloud nem elérhető → Ollama + warning

### 3.4 Golden Dataset Auto-Save
- **RULE-GD1:** `AgentResponse.status === 'success'` ÉS volt LLM call → mentés
- **RULE-GD2:** Minimum quality threshold: task.length > 10 ÉS response.data nem üres
- **RULE-GD3:** Deduplikáció: SHA256 hash alapján (ne mentsünk dupla mintát)
- **RULE-GD4:** Nightly training trigger: min 5 új minta az utolsó training óta

### 3.5 Observability
- **RULE-OB1:** Minden agent execute = TraceSpan (traceId + spanId)
- **RULE-OB2:** Orchestrator delegálás = parent-child span relationship
- **RULE-OB3:** LLM hívás = child span token usage-zsel
- **RULE-OB4:** LangSmith upload ha LANGCHAIN_API_KEY elérhető

### 3.6 Audit
- **RULE-AU1:** Minden tool execution → permission check → audit_log INSERT
- **RULE-AU2:** DENIED operations → logError + audit_log (result='DENIED')
- **RULE-AU3:** Audit log retention: 30 nap (auto-cleanup)

## 4. Nem-funkcionális Követelmények

- **Teljesítmény:** Permission check < 1ms (in-memory cache)
- **Checkpoint overhead:** < 5ms per save (SQLite WAL mode)
- **Embedding latency:** < 500ms per chunk (nomic-embed-text)
- **Trace overhead:** < 2ms per span creation
- **Audit write:** Async (non-blocking)

## 5. Dashboard & CLI Integráció (G7 Pillér)

### 5.1 Architekturális Elvek
- **RULE-UI1:** Minden Gold Protocol funkció (G1-G6) ELÉRHETŐ kell legyen a React Dashboard-ról ÉS a CLI-ből is
- **RULE-UI2:** Dashboard valós-idejű: minden backend esemény Socket.IO-n push-olva a frontenddel
- **RULE-UI3:** CLI-ből ugyanaz a REST API hívódik mint a Dashboard-ból → nincs dupla logika
- **RULE-UI4:** A `src/server/*Routes.ts` fájlok felelnek a REST API-ért, NEM a `web.ts` (clean separation)

### 5.2 Új Modulok (`src/server/`)
```
src/server/
├── specRoutes.ts          # Spec management API (list, show, approve, reject)
├── phoenixRoutes.ts       # Checkpoint, health, recovery API
├── routerRoutes.ts        # Model router config, decisions, override API
├── memoryRoutes.ts        # Golden dataset, index, training API
├── settingsRoutes.ts      # Gold Protocol centralized settings API
└── (telemetryRoutes.ts)   # Már G5.2-ben definiálva
```

### 5.3 Új Dashboard Komponensek (`src/dashboard/components/dashboard/`)
```
src/dashboard/components/dashboard/
├── SpecManagerPanel.tsx      # Spec életciklus kezelés UI
├── PhoenixPanel.tsx          # Checkpoint + health monitoring UI
├── ModelRouterPanel.tsx      # Model routing config + decisions UI
├── CognitiveMemoryPanel.tsx  # Golden dataset + index + training UI
├── TraceViewer.tsx           # Agent trace hierarchia vizualizáció
├── TokenUsageChart.tsx       # Token fogyasztás trend chart (Recharts)
├── CostSummary.tsx           # Költség összesítő kártya
├── AuditPanel.tsx            # Permission audit log böngészése
└── GoldStatusWidget.tsx      # Mini összefoglaló a főoldalra
```

### 5.4 Socket.IO Event Specifikáció
```typescript
// Új Gold Protocol Socket.IO események (backend → frontend)
interface GoldSocketEvents {
  'gold:spec_changed':     { trackId: string; status: string; updatedAt: string };
  'gold:checkpoint_saved': { taskId: string; step: number; stepName: string; timestamp: number };
  'gold:retry_attempt':    { taskId: string; attempt: number; delay: number; agent: string };
  'gold:process_health':   { processes: Array<{ name: string; status: string; pid?: number }> };
  'gold:recovery_event':   { type: 'crash' | 'restart' | 'git_checkpoint'; agent: string; details: string; timestamp: number };
  'gold:model_routed':     { taskId: string; model: string; reason: string; timestamp: number };
  'gold:golden_saved':     { source: string; quality: number; timestamp: number };
  'gold:reindex_complete': { fileCount: number; chunkCount: number; durationMs: number };
  'gold:trace_span':       { traceId: string; spanId: string; agent: string; operation: string; status: 'running' | 'success' | 'error' };
  'gold:token_update':     { agent: string; model: string; inputTokens: number; outputTokens: number; costUsd: number };
  'gold:audit_event':      { agent: string; action: string; resource: string; result: 'ALLOWED' | 'DENIED'; reason?: string };
}
```

### 5.5 Dashboard Viselkedési Szabályok
- **RULE-DB1:** DENIED audit event → `toast.error()` automatikus értesítés (sonner)
- **RULE-DB2:** Recovery event → `toast.warning()` értesítés
- **RULE-DB3:** Training complete → `toast.success()` értesítés
- **RULE-DB4:** Spec approved → `toast.info()` értesítés
- **RULE-DB5:** Dashboard lassulás megelőzés: Socket event throttle max 2/s per event típus
- **RULE-DB6:** Trace viewer: virtualized list nagy mennyiségű span esetén (react-window)
- **RULE-DB7:** Minden panel lazy-loaded (React.lazy + Suspense) → gyors első betöltés

### 5.6 CLI Viselkedési Szabályok
- **RULE-CL1:** Minden Gold parancs csoportosított alparancs (`brunella spec|phoenix|router|memory|trace|audit`)
- **RULE-CL2:** CLI parancsok a BrunellaClient-en (MCP SSE) VAGY közvetlen REST API-n működnek
- **RULE-CL3:** `--json` flag minden parancshoz → gépi feldolgozásra alkalmas output
- **RULE-CL4:** `ora` spinner hosszú műveleteknél (reindex, train, stb.)
- **RULE-CL5:** Interaktív menü (`src/interactive.ts`) tartalmaz minden Gold kategóriát

### 5.7 REST API Összesítő

| Endpoint | Metódus | Leírás | Modul |
|----------|---------|--------|-------|
| `/api/specs` | GET | Spec-ek listázása | specRoutes |
| `/api/specs/:trackId` | GET | Spec részletek | specRoutes |
| `/api/specs/:trackId/approve` | POST | Spec jóváhagyás | specRoutes |
| `/api/specs/:trackId/reject` | POST | Spec elutasítás | specRoutes |
| `/api/phoenix/checkpoints` | GET | Aktív checkpoint-ok | phoenixRoutes |
| `/api/phoenix/checkpoints/:taskId` | GET/DELETE | Egy checkpoint | phoenixRoutes |
| `/api/phoenix/health` | GET | Process health | phoenixRoutes |
| `/api/phoenix/recovery-log` | GET | Recovery napló | phoenixRoutes |
| `/api/router/models` | GET | Model profil-ok | routerRoutes |
| `/api/router/decisions` | GET | Routing döntések | routerRoutes |
| `/api/router/config` | GET/POST | Router beállítások | routerRoutes |
| `/api/router/override` | POST | Model kézi override | routerRoutes |
| `/api/memory/golden-stats` | GET | Golden dataset stats | memoryRoutes |
| `/api/memory/golden-samples` | GET | Sample-ök | memoryRoutes |
| `/api/memory/index-status` | GET | Kódbázis index | memoryRoutes |
| `/api/memory/reindex` | POST | Újraindexelés indítás | memoryRoutes |
| `/api/memory/training-log` | GET | Training napló | memoryRoutes |
| `/api/memory/train` | POST | Training indítás | memoryRoutes |
| `/api/telemetry/traces` | GET | Trace listázás | telemetryRoutes |
| `/api/telemetry/traces/:traceId` | GET | Trace részletek | telemetryRoutes |
| `/api/telemetry/usage` | GET | Token usage | telemetryRoutes |
| `/api/telemetry/cost` | GET | Költség breakdown | telemetryRoutes |
| `/api/telemetry/live` | GET (SSE) | Élő trace stream | telemetryRoutes |
| `/api/audit/log` | GET | Audit napló (szűrhető) | auditRoutes (G6.2) |
| `/api/audit/stats` | GET | Audit statisztikák | auditRoutes (G6.2) |
| `/api/audit/denied` | GET | Denied események | auditRoutes (G6.2) |
| `/api/settings/gold` | GET/POST | Gold beállítások | settingsRoutes |

### 5.8 Központi Gold Config
```typescript
// src/core/goldConfig.ts
interface GoldConfig {
  specFreeze: {
    enabled: boolean;           // Spec gate be/ki
    autoRejectAfterDays: number; // Auto-reject pending specs ennyi nap után
  };
  phoenix: {
    maxRetries: number;         // default: 3
    baseDelay: number;          // default: 1000ms
    backoffMultiplier: number;  // default: 3
    maxDelay: number;           // default: 10000ms
    autoCheckpoint: boolean;    // default: true
  };
  router: {
    budget: number;             // 0-100, 0=Ollama only
    preferLocal: boolean;       // default: true
    fallbackEnabled: boolean;   // default: true
  };
  golden: {
    autoSave: boolean;          // default: true
    minQualityThreshold: number; // default: 0.5
  };
  glassbox: {
    langsmithEnabled: boolean;  // default: false (API key szükséges)
    traceRetentionDays: number; // default: 30
  };
  audit: {
    retentionDays: number;      // default: 30
    autoCleanup: boolean;       // default: true
  };
}
```

## 6. Tesztelési Terv

| Fázis | Teszt típus | Leírás |
|-------|------------|--------|
| G1 | Unit | Spec gate BLOCKED/ALLOWED scenarios |
| G2 | Unit + Integration | Checkpoint save/load, retry count, backoff timing |
| G3 | Unit | Model selection heurisztika validáció |
| G4 | Integration | Golden save flow, indexer stats |
| G5 | Unit + E2E | Trace span creation, LangSmith upload |
| G6 | Unit | Audit log DENIED recording, cleanup |
| G7 | Unit + Integration | Route handler tesztek (specRoutes, phoenixRoutes, routerRoutes, memoryRoutes, settingsRoutes) |
| G7 | Component | React panel tesztek (SpecManagerPanel, PhoenixPanel, ModelRouterPanel, CognitiveMemoryPanel, TraceViewer, AuditPanel) |
| G7 | Integration | Socket.IO Gold event push + SocketContext reducer dispatch |
| G7 | E2E | CLI Gold parancsok (`brunella spec list`, `brunella phoenix status`, stb.) |
| G7 | Snapshot | GoldStatusWidget + GoldConfig UI snapshot tesztek |

**Összesen:** ~1200 sor új teszt kód, 12+ új teszt fájl.

---
*Spec v2.0 — Gold Protocol — Brunella Agent System*
