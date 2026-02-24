# 🏆 GOLD PROTOCOL - Implementation Roadmap
**Track ID:** gold_protocol
**Státusz:** ACTIVE
**Létrehozva:** 2026-02-09
**Cél:** A BAS rendszer "felokosítása" - 100% hatékonyság és teljes autonómia elérése

---

## 📊 GAP Analízis Összefoglaló

| Pillér | Megvalósítottság | Hiányzó elemek |
|--------|-----------------|----------------|
| 1. Spec-Driven Development | 60% | Runtime enforcement, approval gate |
| 2. Phoenix Protocol | 40% | Checkpointing, exponential backoff, auto-recovery |
| 3. Hibrid Intelligencia | 70% | Intelligens model routing |
| 4. Kognitív Memória | 65% | Auto-save, proaktív indexelés, nightly training |
| 5. Glass Box Observability | 35% | Agent tracing, dashboard, cost monitor |
| 6. Robotkéz Autonómia | 80% | Runtime enforcement, audit persistence |

**Összesített:** ~58% kész → Cél: 95%+

---

## 🎯 IMPLEMENTÁCIÓS FÁZISOK

### ═══════════════════════════════════════════════
### FÁZIS G1: Spec Freeze Enforcement (Prioritás: KRITIKUS)
### ═══════════════════════════════════════════════
**Időbecslés:** 2-3 óra | **Komplexitás:** Közepes

#### G1.1 - Spec Status Manager (`src/agents/specStatus.ts`)
**Leírás:** Központi spec státusz kezelő rendszer.
```
Funkciók:
- getSpecStatus(trackId): 'pending_approval' | 'approved' | 'rejected' | 'not_found'
- approveSpec(trackId): boolean
- requiresSpec(agentName): boolean
- isSpecApproved(trackId): boolean

Adattárolás: conductor/tracks/<trackId>/meta.json → { status: "approved" }
```

**Fájlok:**
- ÚJ: `src/agents/specStatus.ts` (~80 sor)
- MÓDOSÍT: `src/agents/SpecWriterAgent.ts` (meta.json status írás)

#### G1.2 - DeveloperAgent Spec Gate
**Leírás:** A DeveloperAgent ne kezdjen kódolni jóváhagyott spec nélkül.
```typescript
// DeveloperAgent.execute() elején:
if (this.requiresSpec(context)) {
  const specStatus = await getSpecStatus(context.trackId);
  if (specStatus !== 'approved') {
    return {
      status: 'blocked',
      error: 'SPEC_NOT_APPROVED',
      suggestion: 'Futtasd először a SpecWriterAgent-et'
    };
  }
}
```

**Fájlok:**
- MÓDOSÍT: `src/agents/DeveloperAgent.ts` (~20 sor)

#### G1.3 - Spec Gate Tesztek
**Fájlok:**
- ÚJ: `test/specStatus.test.ts` (~60 sor)
- MÓDOSÍT: `test/DeveloperAgent.test.ts` (spec gate test cases)

**Elfogadási kritérium:** DeveloperAgent BLOCKED response-t ad ha nincs approved spec.

---

### ═══════════════════════════════════════════════
### FÁZIS G2: Phoenix Protocol v2 (Prioritás: MAGAS)
### ═══════════════════════════════════════════════
**Időbecslés:** 3-4 óra | **Komplexitás:** Magas

#### G2.1 - Checkpoint System (`src/core/checkpoint.ts`)
**Leírás:** Részfeladat-szintű állapotmentés SQLite-ba.
```
Interface:
- saveCheckpoint(taskId, step, state): void
- loadCheckpoint(taskId): CheckpointState | null
- clearCheckpoint(taskId): void

Tárolja:
- task_id, step_index, step_name, state_json, created_at
- Sikeres részfeladat után automatikus mentés
```

**Fájlok:**
- ÚJ: `src/core/checkpoint.ts` (~120 sor)
- ÚJ: `schemas/checkpoint.sql` (~15 sor)

#### G2.2 - Exponential Backoff Retry (`src/core/retryStrategy.ts`)
**Leírás:** Konfiguálható retry stratégia az agent hibákhoz.
```typescript
interface RetryConfig {
  maxRetries: number;      // default: 3
  baseDelay: number;       // default: 1000ms
  maxDelay: number;        // default: 10000ms
  backoffMultiplier: number; // default: 3
}

// Delays: 1s → 3s → 10s (cap)
async function withRetry<T>(fn: () => Promise<T>, config: RetryConfig): Promise<T>
```

**Fájlok:**
- ÚJ: `src/core/retryStrategy.ts` (~60 sor)
- MÓDOSÍT: `src/agents/AgentManager.ts` (retry integráció)

#### G2.3 - Process Health Monitor
**Leírás:** Python shell és külső process-ek figyelése, automatikus Silent Restart.
```
Funkciók:
- monitorPythonShell(): void  // Exit code figyelés
- silentRestart(processName): void  // Automatikus újraindítás
- healthCheck(): SystemHealth  // Rendszer állapot
```

**Fájlok:**
- ÚJ: `src/core/processMonitor.ts` (~100 sor)
- MÓDOSÍT: `src/utils/pythonShell.ts` (health reporting)

#### G2.4 - Git Auto-Recovery
**Leírás:** Hiba esetén automatikus állapotmentés git-be.
```
Trigger: Agent hiba UTÁN (catch blokk)
Akció:
  1. sync_foszal.py futtatás
  2. git add -A && git commit -m "checkpoint: <agent> failed at <step>"
  3. Log az eseményt
```

**Fájlok:**
- ÚJ: `src/core/gitRecovery.ts` (~50 sor)
- MÓDOSÍT: `src/agents/AgentManager.ts` (error handler hook)

#### G2.5 - Phoenix Protocol Tesztek
**Fájlok:**
- ÚJ: `test/checkpoint.test.ts` (~80 sor)
- ÚJ: `test/retryStrategy.test.ts` (~60 sor)

**Elfogadási kritérium:** Agent crash után checkpoint-ból folytatás, exponential backoff működik.

---

### ═══════════════════════════════════════════════
### FÁZIS G3: Intelligens Model Router (Prioritás: KÖZEPES)
### ═══════════════════════════════════════════════
**Időbecslés:** 2-3 óra | **Komplexitás:** Közepes

#### G3.1 - Model Router (`src/core/modelRouter.ts`)
**Leírás:** Feladat alapú automatikus modell kiválasztás.
```typescript
interface ModelProfile {
  name: string;           // "ollama/qwen2.5-coder", "github/gpt-4o", "gemini-pro"
  role: 'brain' | 'muscle'; // Tervezés vs Végrehajtás
  contextWindow: number;
  costPerToken: number;   // 0 = lokális
  speed: 'fast' | 'medium' | 'slow';
  strengths: string[];    // ['code_gen', 'planning', 'analysis']
}

function selectModel(task: TaskProfile): ModelProfile {
  // Heurisztika:
  // - Tervezés, kontextus-betöltés → Gemini/GPT-4o ("Agy")
  // - Repetitív kódolás, tesztírás → Ollama Qwen/Llama ("Izom")
  // - Budget constraint → Ollama first, Cloud fallback
}
```

**Fájlok:**
- ÚJ: `src/core/modelRouter.ts` (~150 sor)
- MÓDOSÍT: `src/core/llm_client.ts` (router integráció)
- MÓDOSÍT: `src/agents/OrchestratorAgent.ts` (model selection)

#### G3.2 - Model Router Tesztek
**Fájlok:**
- ÚJ: `test/modelRouter.test.ts` (~80 sor)

**Elfogadási kritérium:** Planning task → GPT-4o, Kódolás → Ollama Qwen, Budget=0 → Ollama only.

---

### ═══════════════════════════════════════════════
### FÁZIS G4: Kognitív Memória Bővítés (Prioritás: MAGAS)
### ═══════════════════════════════════════════════
**Időbecslés:** 3-4 óra | **Komplexitás:** Magas

#### G4.1 - Auto-Save Golden Samples
**Leírás:** Sikeres agent futások automatikus mentése a Golden Dataset-be.
```
Hook pont: AgentManager.executeTask() → SIKER UTÁN
Mikor mentünk:
  - Agent response.status === 'success'
  - Volt LLM hívás (nem üres prompt/response)
  - Quality score heurisztika (task length, response quality)

Mentés: dataset_manager.save_gold_sample(prompt, input, output, agent_name)
```

**Fájlok:**
- MÓDOSÍT: `src/agents/AgentManager.ts` (~30 sor, post-execute hook)
- ÚJ: `src/core/goldenDatasetBridge.ts` (~60 sor, Node→Python bridge)

#### G4.2 - Proaktív Kódbázis Indexelő (`src/core/codebaseIndexer.ts`)
**Leírás:** Időszakos teljes kódbázis indexelés LanceDB-be.
```
Funkciók:
- indexCodebase(rootDir): Promise<IndexStats>
- reindexChangedFiles(): Promise<IndexStats>  // git diff alapján
- scheduleReindex(intervalMinutes): void

Index tartalom:
  - Minden .ts, .py, .md fájl
  - Chunk size: 500 karakter, 100 overlap
  - Embedding: nomic-embed-text (Ollama)
```

**Fájlok:**
- ÚJ: `src/core/codebaseIndexer.ts` (~180 sor)
- MÓDOSÍT: `src/server/web.ts` (scheduled reindex endpoint)

#### G4.3 - Nightly Training Scheduler
**Leírás:** Éjszakai batch training job Windows Task Scheduler-rel.
```
Script: scripts/nightly_train.ps1
Logika:
  1. Ellenőrizd: van-e elég új adat (min 5 sample az utolsó training óta)
  2. GPU szabad? (nvidia-smi check)
  3. python myai/incubator/train.py --auto
  4. Ha siker: ollama create brunella-v1 -f Modelfile
  5. Log eredmény → data/training/training_log.jsonl
```

**Fájlok:**
- ÚJ: `scripts/nightly_train.ps1` (~80 sor)
- ÚJ: `scripts/register_nightly_task.ps1` (Windows Task Scheduler regisztráció)
- MÓDOSÍT: `myai/incubator/train.py` (--auto flag)

#### G4.4 - Memória Tesztek
**Fájlok:**
- ÚJ: `test/codebaseIndexer.test.ts` (~60 sor)
- ÚJ: `test/goldenDatasetBridge.test.ts` (~40 sor)

**Elfogadási kritérium:** Sikeres agent futás → golden dataset-be mentve, kódbázis indexelve.

---

### ═══════════════════════════════════════════════
### FÁZIS G5: Glass Box Observability v2 (Prioritás: KÖZEPES)
### ═══════════════════════════════════════════════
**Időbecslés:** 3-4 óra | **Komplexitás:** Magas

#### G5.1 - Agent Delegation Tracer (`src/utils/agentTracer.ts`)
**Leírás:** Orchestrator → Agent delegálási lánc komplett trace-elése.
```typescript
interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  agentName: string;
  operation: string;
  startTime: number;
  endTime?: number;
  status: 'running' | 'success' | 'error';
  metadata: Record<string, unknown>;
  tokenUsage?: { input: number; output: number };
}

// Automatikusan trace-eli:
// Orchestrator.execute() → span
//   └── Developer.execute() → child span
//       └── LLM call → child span
```

**Fájlok:**
- ÚJ: `src/utils/agentTracer.ts` (~200 sor)
- MÓDOSÍT: `src/agents/AgentManager.ts` (trace injection)
- MÓDOSÍT: `src/core/llm_client.ts` (LLM span)
- MÓDOSÍT: `src/utils/telemetry.ts` (console.log → logger)

#### G5.2 - Token Cost Dashboard API
**Leírás:** Összesített token költség és használat monitoring.
```
Endpoints:
  GET /api/telemetry/usage → { today, week, month, byAgent, byModel }
  GET /api/telemetry/traces/:traceId → TraceSpan[]
  GET /api/telemetry/cost → { totalCost, breakdown }

Adattárolás: SQLite telemetry tábla
```

**Fájlok:**
- ÚJ: `src/server/telemetryRoutes.ts` (~100 sor)
- ÚJ: `schemas/telemetry.sql` (~20 sor)
- MÓDOSÍT: `src/server/web.ts` (route mount)

#### G5.3 - Dashboard Trace Viewer Panel
**Leírás:** React komponens a trace-ek vizualizálásához.
```
Komponensek:
  - TraceViewer.tsx: Hierarchikus span megjelenítés (Orchestrator → Agent → LLM)
  - TokenUsageChart.tsx: Napi/heti token trend (Recharts)
  - CostSummary.tsx: Költség összesítő kártya
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/TraceViewer.tsx` (~150 sor)
- ÚJ: `src/dashboard/components/dashboard/TokenUsageChart.tsx` (~80 sor)
- MÓDOSÍT: `src/dashboard/App.tsx` (route beillesztés)

#### G5.4 - Observability Tesztek
**Fájlok:**
- ÚJ: `test/agentTracer.test.ts` (~80 sor)

**Elfogadási kritérium:** LangSmith-ben látható az Orchestrator→Agent→LLM lánc, Dashboard-on token usage graf.

---

### ═══════════════════════════════════════════════
### FÁZIS G6: Runtime Permission Enforcement & Audit (Prioritás: MAGAS)
### ═══════════════════════════════════════════════
**Időbecslés:** 2 óra | **Komplexitás:** Közepes

#### G6.1 - Permission Middleware
**Leírás:** Minden agent execute hívás előtt automatikus permission check.
```typescript
// AgentManager.executeTask() elején:
const permCheck = checkToolPermission(toolName, { agentName: agent.name });
if (!permCheck.allowed) {
  await auditLog.record('DENIED', agent.name, toolName, permCheck.reason);
  return { status: 'error', error: `PERMISSION_DENIED: ${permCheck.reason}` };
}
```

**Fájlok:**
- MÓDOSÍT: `src/agents/AgentManager.ts` (~15 sor)
- MÓDOSÍT: `src/server/registry.ts` (MCP tool-ok permission wrapping)

#### G6.2 - Persistent Audit Trail (`src/core/auditLog.ts`)
**Leírás:** Minden permission ellenőrzés eredménye SQLite-ba mentve.
```
Tábla: audit_log
  - id, timestamp, agent_name, action, resource, result ('ALLOWED'|'DENIED'), reason
  
API:
  GET /api/audit/log → AuditEntry[] (paginált)
  GET /api/audit/denied → AuditEntry[] (csak megtagadottak)
```

**Fájlok:**
- ÚJ: `src/core/auditLog.ts` (~80 sor)
- ÚJ: `schemas/audit.sql` (~15 sor)
- MÓDOSÍT: `src/server/web.ts` (audit routes)

#### G6.3 - Audit Tesztek
**Fájlok:**
- ÚJ: `test/auditLog.test.ts` (~50 sor)

**Elfogadási kritérium:** Denied operations SQLite-ban naplózva, API-n lekérdezhető.

---

## 📋 ÖSSZESÍTETT TODO LISTA (Végrehajtási sorrend)

### 🔴 SPRINT 1: Alapok Megerősítése (G1 + G2) — ~6 óra
| # | Feladat | Fázis | Fájl | Komplexitás |
|---|---------|-------|------|-------------|
| 1 | Spec Status Manager létrehozása | G1.1 | `src/agents/specStatus.ts` | Közepes |
| 2 | SpecWriterAgent meta.json status frissítés | G1.1 | `src/agents/SpecWriterAgent.ts` | Alacsony |
| 3 | DeveloperAgent Spec Gate beépítés | G1.2 | `src/agents/DeveloperAgent.ts` | Közepes |
| 4 | Spec Gate tesztek | G1.3 | `test/specStatus.test.ts` | Alacsony |
| 5 | Checkpoint rendszer implementálás | G2.1 | `src/core/checkpoint.ts` | Magas |
| 6 | Checkpoint SQL séma | G2.1 | `schemas/checkpoint.sql` | Alacsony |
| 7 | Exponential Backoff Retry | G2.2 | `src/core/retryStrategy.ts` | Közepes |
| 8 | AgentManager retry integráció | G2.2 | `src/agents/AgentManager.ts` | Közepes |
| 9 | Process Health Monitor | G2.3 | `src/core/processMonitor.ts` | Magas |
| 10 | Git Auto-Recovery | G2.4 | `src/core/gitRecovery.ts` | Közepes |
| 11 | Phoenix Protocol tesztek | G2.5 | `test/checkpoint.test.ts`, `test/retryStrategy.test.ts` | Közepes |

### 🟡 SPRINT 2: Intelligencia Bővítés (G3 + G4) — ~6 óra
| # | Feladat | Fázis | Fájl | Komplexitás |
|---|---------|-------|------|-------------|
| 12 | Model Router implementálás | G3.1 | `src/core/modelRouter.ts` | Közepes |
| 13 | LLM client router integráció | G3.1 | `src/core/llm_client.ts` | Közepes |
| 14 | Model Router tesztek | G3.2 | `test/modelRouter.test.ts` | Alacsony |
| 15 | Auto-Save Golden Samples hook | G4.1 | `src/agents/AgentManager.ts` | Közepes |
| 16 | Golden Dataset Bridge (Node→Python) | G4.1 | `src/core/goldenDatasetBridge.ts` | Közepes |
| 17 | Proaktív Kódbázis Indexelő | G4.2 | `src/core/codebaseIndexer.ts` | Magas |
| 18 | Nightly Training script | G4.3 | `scripts/nightly_train.ps1` | Közepes |
| 19 | Windows Task Scheduler regisztráció | G4.3 | `scripts/register_nightly_task.ps1` | Alacsony |
| 20 | Memória tesztek | G4.4 | `test/codebaseIndexer.test.ts` | Közepes |

### 🟢 SPRINT 3: Observability & Security (G5 + G6) — ~5 óra
| # | Feladat | Fázis | Fájl | Komplexitás |
|---|---------|-------|------|-------------|
| 21 | Agent Delegation Tracer | G5.1 | `src/utils/agentTracer.ts` | Magas |
| 22 | AgentManager trace injection | G5.1 | `src/agents/AgentManager.ts` | Közepes |
| 23 | Telemetry fix (console.log → logger) | G5.1 | `src/utils/telemetry.ts` | Alacsony |
| 24 | Token Cost API endpoints | G5.2 | `src/server/telemetryRoutes.ts` | Közepes |
| 25 | Telemetry SQL séma | G5.2 | `schemas/telemetry.sql` | Alacsony |
| 26 | Dashboard TraceViewer | G5.3 | `TraceViewer.tsx`, `TokenUsageChart.tsx` | Magas |
| 27 | Observability tesztek | G5.4 | `test/agentTracer.test.ts` | Közepes |
| 28 | Permission Middleware enforcement | G6.1 | `src/agents/AgentManager.ts` | Közepes |
| 29 | Persistent Audit Trail | G6.2 | `src/core/auditLog.ts` | Közepes |
| 30 | Audit SQL séma + API | G6.2 | `schemas/audit.sql`, route mount | Alacsony |
| 31 | Audit tesztek | G6.3 | `test/auditLog.test.ts` | Alacsony |

---

## 📊 RESOURCE BECSLÉS

| Metrika | Érték |
|---------|-------|
| **Összes feladat** | 31 |
| **Új fájlok** | ~18 |
| **Módosított fájlok** | ~12 |
| **Új kódsorok (becsült)** | ~2500 |
| **Új teszt sorok (becsült)** | ~600 |
| **Összes időbecslés** | ~17 óra (3 sprint) |

## 🎯 SIKER METRIKÁK

| Pillér | Jelenlegi | Cél | Mérőszám |
|--------|-----------|-----|----------|
| Spec-Driven | 60% | 95% | Developer BLOCKED ha nincs spec |
| Phoenix | 40% | 90% | Crash → auto-recovery < 30s |
| Model Intelligence | 70% | 85% | Planning → Cloud, Code → Local |
| Memória | 65% | 90% | Auto-save rate > 80%, nightly train |
| Glass Box | 35% | 80% | Teljes trace chain LangSmith-ben |
| Security | 80% | 95% | 100% audit coverage, SQLite log |

---

## ⚠️ KOCKÁZATOK ÉS MITIGÁCIÓ

| Kockázat | Valószínűség | Hatás | Mitigáció |
|----------|-------------|-------|-----------|
| SQLite lock contention (checkpoints) | Közepes | Magas | WAL mode + connection pooling |
| LanceDB reindex lassú nagy kódbázisnál | Alacsony | Közepes | Incremental index (git diff) |
| LangSmith API rate limit | Alacsony | Alacsony | Local buffer + batch upload |
| Nightly training OOM (RTX 3060) | Közepes | Magas | 4-bit quant, batch_size=2 |
| Permission enforcement lassítja az agent-eket | Alacsony | Közepes | In-memory cache, lazy check |

---

## 🚦 AJÁNLOTT VÉGREHAJTÁSI SORREND

```
SPRINT 1 (Alapok) ─────────────────────────────────
  G1: Spec Freeze ──── G2: Phoenix Protocol
  [1-4]                [5-11]
  ~2h                  ~4h
                       
SPRINT 2 (Intelligencia) ──────────────────────────
  G3: Model Router ─── G4: Memória
  [12-14]              [15-20]
  ~2h                  ~4h
                       
SPRINT 3 (Observability) ──────────────────────────
  G5: Glass Box ────── G6: Audit
  [21-27]              [28-31]
  ~4h                  ~2h
```

**Megjegyzés:** A Sprintek párhuzamosíthatók ha több ügynök dolgozik egyszerre (pl. Claude + Copilot + Jules).

---

### ═══════════════════════════════════════════════
### FÁZIS G7: Dashboard Teljes Integráció & Vezérlés (Prioritás: MAGAS)
### ═══════════════════════════════════════════════
**Időbecslés:** 6-8 óra | **Komplexitás:** Magas

**Cél:** Minden Gold Protocol funkció (G1-G6) elérhető legyen a React Dashboardon ÉS a CLI-n is,
valós-idejű Socket.IO push-sal és REST API végpontokkal.

---

#### G7.1 — Spec Freeze Dashboard Panel (`SpecManagerPanel.tsx`)
**Leírás:** Spec-ek kezelése a dashboardon: listázás, jóváhagyás, elutasítás, státusz megjelenítés.
```
Funkciók:
  - Track-ok listázása spec státusszal (pending/approved/rejected/not_found)
  - Spec tartalom megtekintése (Markdown renderelés)
  - "Approve Spec" / "Reject Spec" gombok
  - DeveloperAgent BLOCKED állapot vizuális jelzés
  - Socket.IO push: spec_status_changed event
```

**Backend API:**
```
GET  /api/specs                    → { specs: [{ trackId, status, title, updatedAt }] }
GET  /api/specs/:trackId           → { spec: { content, meta, status } }
POST /api/specs/:trackId/approve   → { success: true }
POST /api/specs/:trackId/reject    → { success: true, reason }
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/SpecManagerPanel.tsx` (~200 sor)
- ÚJ: `src/server/specRoutes.ts` (~120 sor)
- MÓDOSÍT: `src/server/web.ts` (spec route mount + socket emit)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (sidebar + tab)

**CLI parancsok:**
```
brunella spec list              → Track-ok és spec státuszok
brunella spec show <trackId>    → Spec tartalom megjelenítés
brunella spec approve <trackId> → Spec jóváhagyás
brunella spec reject <trackId>  → Spec elutasítás
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (spec command csoport)
- MÓDOSÍT: `src/interactive.ts` (spec menüpont)

---

#### G7.2 — Phoenix Protocol Dashboard (Checkpoint & Recovery Monitor)
**Leírás:** Checkpoint állapotok, retry események, process health valós-idejű megjelenítése.
```
Funkciók:
  - Aktív checkpoint-ok listája (task, step, timestamp)
  - Retry counter és backoff state vizualizáció
  - Process health indikátorok (Python shell, Ollama, stb.)
  - Recovery napló (utolsó N crash + recovery esemény)
  - Socket.IO push: checkpoint_saved, retry_attempt, process_health, recovery_event
```

**Backend API:**
```
GET  /api/phoenix/checkpoints            → { checkpoints: [...] }
GET  /api/phoenix/checkpoints/:taskId    → { checkpoint: { steps, state } }
DELETE /api/phoenix/checkpoints/:taskId  → { cleared: true }
GET  /api/phoenix/health                 → { processes: [{ name, status, pid, uptime }] }
GET  /api/phoenix/recovery-log           → { events: [{ type, agent, timestamp, details }] }
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/PhoenixPanel.tsx` (~250 sor)
- ÚJ: `src/server/phoenixRoutes.ts` (~150 sor)
- MÓDOSÍT: `src/server/web.ts` (phoenix route mount)
- MÓDOSÍT: `src/server/SocketService.ts` (phoenix event típusok)
- MÓDOSÍT: `src/dashboard/context/SocketContext.tsx` (phoenix event listeners)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (Phoenix tab)

**CLI parancsok:**
```
brunella phoenix status      → Checkpoint + health összefoglaló
brunella phoenix checkpoints → Aktív checkpoint-ok listája
brunella phoenix clear <id>  → Checkpoint törlése
brunella phoenix health      → Rendszer process-ek állapota
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (phoenix command csoport)
- MÓDOSÍT: `src/interactive.ts` (Phoenix menüpont)

---

#### G7.3 — Model Router Dashboard (Intelligens Modell Vezérlőpult)
**Leírás:** Model routing konfiguráció, aktuális modell-választás megjelenítése, kézi override.
```
Funkciók:
  - Regisztrált model profil-ok listája (name, role, cost, speed, strengths)
  - Utolsó N routing döntés megjelenítése (task → model kiválasztás indoklással)
  - Budget slider (0 = Ollama only → 100 = Cloud preferred)
  - Model override: kézzel kiválasztott modell kényszerítése
  - Provider státusz mutatók (online/offline/latency)
  - Socket.IO push: model_routed event
```

**Backend API:**
```
GET  /api/router/models              → { models: ModelProfile[] }
GET  /api/router/decisions           → { decisions: [{ taskId, selected, reason, timestamp }] }
GET  /api/router/config              → { budget, preferLocal, fallbackEnabled }
POST /api/router/config              → { budget, preferLocal, fallbackEnabled }
POST /api/router/override            → { model: string, duration: 'once' | 'session' }
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/ModelRouterPanel.tsx` (~220 sor)
- ÚJ: `src/server/routerRoutes.ts` (~100 sor)
- MÓDOSÍT: `src/server/web.ts` (router route mount)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (Router tab)

**CLI parancsok:**
```
brunella router status     → Aktuális config + provider állapotok
brunella router models     → Regisztrált model profil-ok
brunella router budget <n> → Budget beállítás (0-100)
brunella router override <model> → Kézi model kényszerítés
brunella router history    → Utolsó routing döntések
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (router command csoport)
- MÓDOSÍT: `src/interactive.ts` (Router menüpont)

---

#### G7.4 — Kognitív Memória Dashboard (Golden Dataset & Indexer)
**Leírás:** Golden Dataset statisztikák, kódbázis index állapot, training trigger a dashboardon.
```
Funkciók:
  - Golden Dataset méret, minta-szám, forrás breakdown, minőség átlag
  - Utolsó N mentett golden sample előnézet
  - Kódbázis index állapot (utolsó index idő, fájl szám, chunk szám)
  - "Reindex Now" gomb → manuális kódbázis újraindexelés
  - "Start Training" gomb → nightly_train.ps1 manuális indítás
  - Training log megjelenítés (utolsó N futás eredménye)
  - Socket.IO push: golden_sample_saved, reindex_complete, training_started/completed
```

**Backend API:**
```
GET  /api/memory/golden-stats         → { total, bySource, avgQuality, lastSaved }
GET  /api/memory/golden-samples       → { samples: [{ prompt, completion, source, quality, timestamp }], total }
GET  /api/memory/index-status         → { lastIndexed, fileCount, chunkCount, provider }
POST /api/memory/reindex              → { status: 'started', estimatedTime }
GET  /api/memory/training-log         → { runs: [{ startedAt, status, samples, duration, modelOutput }] }
POST /api/memory/train                → { status: 'started' }
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/CognitiveMemoryPanel.tsx` (~280 sor)
- ÚJ: `src/server/memoryRoutes.ts` (~180 sor)
- MÓDOSÍT: `src/server/web.ts` (memory route mount)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (Memory tab)

**CLI parancsok:**
```
brunella memory stats          → Golden dataset + index statisztikák
brunella memory samples [n]    → Utolsó N golden sample
brunella memory reindex        → Kódbázis újraindexelés indítás
brunella memory train           → Training indítás manuálisan
brunella memory training-log   → Utolsó training futások
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (memory command csoport)
- MÓDOSÍT: `src/interactive.ts` (Memory menüpont)

---

#### G7.5 — Glass Box Dashboard (Trace Viewer & Token Monitor)
**Leírás:** Agent trace vizualizáció, token költség monitoring, delegálási lánc.
```
Funkciók:
  - Trace lista: traceId, agent chain, status, duration, token total
  - Trace részletek: hierarchikus span fa (Orchestrator → Agent → LLM)
    - Span-onként: agent, operation, duration, tokenUsage, status
  - Token Usage Chart: napi/heti trend (Recharts area chart)
  - Cost Breakdown: agent-enkénti és model-enkénti költség
  - Élő trace stream: Socket.IO-n push-olt aktív trace span-ok
  - Socket.IO push: trace_span_start, trace_span_end, token_usage_update
```

**Backend API:**
```
GET  /api/telemetry/traces              → { traces: TraceSpan[], total }
GET  /api/telemetry/traces/:traceId     → { spans: TraceSpan[] }
GET  /api/telemetry/usage               → { today, week, month, byAgent, byModel }
GET  /api/telemetry/cost                → { totalCost, breakdown: { byAgent, byModel } }
GET  /api/telemetry/live                → SSE stream aktív trace span-ok
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/TraceViewer.tsx` (~200 sor)
- ÚJ: `src/dashboard/components/dashboard/TokenUsageChart.tsx` (~120 sor)
- ÚJ: `src/dashboard/components/dashboard/CostSummary.tsx` (~80 sor)
- VÁLTAKOZIK (G5.2-ből): `src/server/telemetryRoutes.ts` (+live SSE endpoint)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (Observability tab)

**CLI parancsok:**
```
brunella trace list [--limit n]    → Traces listázás
brunella trace show <traceId>      → Trace span fa megjelenítése
brunella trace usage               → Token usage összesítő (napi/heti/havi)
brunella trace cost                → Költség breakdown
brunella trace live                → Élő trace stream (SSE → terminál)
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (trace command csoport)
- MÓDOSÍT: `src/interactive.ts` (Observability menüpont)

---

#### G7.6 — Audit Dashboard (Permission Log & Security Monitor)
**Leírás:** Audit log böngészése, szűrése, permission denied események kiemelése.
```
Funkciók:
  - Audit log tábla: timestamp, agent, action, resource, result, reason
  - Szűrők: agent, result (ALLOWED/DENIED), időszak
  - Denied események piros kiemeléssel
  - Statisztikák: összesen, denied %, top denied agent-ek
  - Socket.IO push: audit_event (valós-idejű log push)
```

**Backend API:**
```
GET /api/audit/log        → { entries: AuditEntry[], total }
    ?agent=X&result=DENIED&from=ISO&to=ISO&limit=50&offset=0
GET /api/audit/stats      → { total, deniedCount, deniedRate, topDenied }
GET /api/audit/denied     → { entries: AuditEntry[] } (shortcut)
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/AuditPanel.tsx` (~200 sor)
- VÁLTAKOZIK (G6.2-ből): `src/core/auditLog.ts` (+stats aggregáció)
- MÓDOSÍT: `src/server/web.ts` (audit route integration, lásd G6.2)
- MÓDOSÍT: `src/server/SocketService.ts` (audit_event típus)
- MÓDOSÍT: `src/dashboard/context/SocketContext.tsx` (audit event listener)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (Audit tab)

**CLI parancsok:**
```
brunella audit log [--limit n] [--agent X] [--denied]  → Audit napló
brunella audit stats                                     → Audit statisztikák
brunella audit denied                                    → Csak megtagadott események
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (audit command csoport)
- MÓDOSÍT: `src/interactive.ts` (Audit menüpont)

---

#### G7.7 — Unified Settings Panel Bővítés
**Leírás:** A meglévő SettingsPanel kiegészítése Gold Protocol beállításokkal.
```
Funkciók:
  - Spec Freeze: ON/OFF toggle (requiresSpec global)
  - Phoenix: retry config szerkesztés (maxRetries, baseDelay, backoffMultiplier)
  - Model Router: budget slider, preferLocal toggle, fallback ON/OFF
  - Golden Dataset: auto-save ON/OFF, min quality threshold slider
  - Glass Box: LangSmith ON/OFF, trace retention napok
  - Audit: retention napok, auto-cleanup ON/OFF
  - Mentés gomb → backend POST /api/settings/gold
  - Beállítások betöltése → backend GET /api/settings/gold
```

**Backend API:**
```
GET  /api/settings/gold  → { specFreeze, phoenix, router, golden, glassbox, audit }
POST /api/settings/gold  → mentés
```

**Fájlok:**
- MÓDOSÍT: `src/dashboard/components/dashboard/SettingsPanel.tsx` (~150 sor új szekció)
- ÚJ: `src/server/settingsRoutes.ts` (~80 sor)
- ÚJ: `src/core/goldConfig.ts` (~60 sor, központi Gold beállítások)
- MÓDOSÍT: `src/server/web.ts` (settings route mount)

**CLI parancsok:**
```
brunella config gold            → Aktuális Gold Protocol beállítások
brunella config gold set <key> <value>  → Beállítás módosítás
brunella config gold reset      → Alapértelmezések visszaállítása
```

**Fájlok:**
- MÓDOSÍT: `src/cli.ts` (config gold alparancs)

---

#### G7.8 — Socket.IO Event Bővítés & Dashboard Context Frissítés
**Leírás:** Központi Socket.IO event rendszer bővítése minden Gold Protocol eseménnyel.
```
Új Socket.IO események (backend → frontend):
  - 'gold:spec_changed'        → { trackId, status, updatedAt }
  - 'gold:checkpoint_saved'    → { taskId, step, timestamp }
  - 'gold:retry_attempt'       → { taskId, attempt, delay, agent }
  - 'gold:process_health'      → { processes: [{ name, status, pid }] }
  - 'gold:recovery_event'      → { type, agent, details, timestamp }
  - 'gold:model_routed'        → { taskId, model, reason }
  - 'gold:golden_saved'        → { source, quality, timestamp }
  - 'gold:reindex_complete'    → { fileCount, chunkCount, duration }
  - 'gold:trace_span'          → { traceId, spanId, agent, status }
  - 'gold:token_update'        → { agent, model, input, output, cost }
  - 'gold:audit_event'         → { agent, action, resource, result }

Notification system:
  - DENIED audit → toast error (sonner)
  - Recovery event → toast warning
  - Training complete → toast success
  - Spec approved → toast info
```

**Fájlok:**
- MÓDOSÍT: `src/server/SocketService.ts` (~60 sor új metódusok)
- MÓDOSÍT: `src/dashboard/context/SocketContext.tsx` (~80 sor új event handlers + state)
- ÚJ: `src/dashboard/hooks/useGoldProtocol.ts` (~100 sor, dedikált hook Gold állapothoz)

#### G7.9 — Sidebar Bővítés & Navigáció
**Leírás:** Dashboard navigáció frissítése az új panel-ekhez.
```
Új sidebar elemek:
  - 📋 Specs       → SpecManagerPanel
  - 🔥 Phoenix     → PhoenixPanel
  - 🧠 Router      → ModelRouterPanel
  - 💾 Memory      → CognitiveMemoryPanel
  - 👁 Traces      → TraceViewer + TokenUsageChart + CostSummary
  - 🔒 Audit       → AuditPanel

Meglévő elemek kiegészítése:
  - ⚙️ Settings    → +Gold Protocol szekció
  - 🏠 Dashboard   → mini Gold status widgetek a jobb oldalsávban
```

**Fájlok:**
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (SIDEBAR_ITEMS + tab logic)

#### G7.10 — Dashboard Home Widget-ek (Gold Status Overview)
**Leírás:** A főoldal jobb oldali sávjában Gold Protocol mini összefoglaló kártyák.
```
Widget-ek:
  - SpecStatus: X approved / Y pending / Z total
  - Phoenix Health: ✅ All OK / ⚠ 1 process down
  - Token Budget: $X.XX / $Y.YY havi limit
  - Golden Dataset: N minták, utolsó mentés: X perce
  - Audit Alert: N denied az elmúlt 24h-ban
```

**Fájlok:**
- ÚJ: `src/dashboard/components/dashboard/GoldStatusWidget.tsx` (~150 sor)
- MÓDOSÍT: `src/dashboard/components/dashboard/MissionControlLayout.tsx` (jobb sáv kiegészítés)

#### G7.11 — Dashboard & CLI Tesztek
**Fájlok:**
- ÚJ: `test/specRoutes.test.ts` (~60 sor)
- ÚJ: `test/phoenixRoutes.test.ts` (~60 sor)
- ÚJ: `test/routerRoutes.test.ts` (~40 sor)
- ÚJ: `test/memoryRoutes.test.ts` (~60 sor)
- ÚJ: `test/goldConfig.test.ts` (~40 sor)

**Elfogadási kritérium:** Minden G1-G6 művelet végrehajtható CLI-ből ÉS Dashboard-ról is, valós-idejű Socket.IO push működik.

---

## 📋 ÖSSZESÍTETT TODO LISTA — SPRINT 4: Dashboard & CLI Integráció

### 🔵 SPRINT 4: Dashboard & CLI Teljes Integráció (G7) — ~7 óra
| # | Feladat | Alfázis | Fájl(ok) | Komplexitás |
|---|---------|---------|----------|-------------|
| 32 | Gold Config központi modul | G7.7 | `src/core/goldConfig.ts` | Alacsony |
| 33 | Spec Routes (backend API) | G7.1 | `src/server/specRoutes.ts` | Közepes |
| 34 | Spec Manager Panel (React) | G7.1 | `SpecManagerPanel.tsx` | Közepes |
| 35 | Spec CLI parancsok | G7.1 | `src/cli.ts`, `src/interactive.ts` | Közepes |
| 36 | Phoenix Routes (backend API) | G7.2 | `src/server/phoenixRoutes.ts` | Közepes |
| 37 | Phoenix Panel (React) | G7.2 | `PhoenixPanel.tsx` | Magas |
| 38 | Phoenix CLI parancsok | G7.2 | `src/cli.ts`, `src/interactive.ts` | Közepes |
| 39 | Router Routes (backend API) | G7.3 | `src/server/routerRoutes.ts` | Közepes |
| 40 | Model Router Panel (React) | G7.3 | `ModelRouterPanel.tsx` | Közepes |
| 41 | Router CLI parancsok | G7.3 | `src/cli.ts`, `src/interactive.ts` | Alacsony |
| 42 | Memory Routes (backend API) | G7.4 | `src/server/memoryRoutes.ts` | Magas |
| 43 | Cognitive Memory Panel (React) | G7.4 | `CognitiveMemoryPanel.tsx` | Magas |
| 44 | Memory CLI parancsok | G7.4 | `src/cli.ts`, `src/interactive.ts` | Közepes |
| 45 | Trace Viewer + Token Chart (React) | G7.5 | `TraceViewer.tsx`, `TokenUsageChart.tsx`, `CostSummary.tsx` | Magas |
| 46 | Trace CLI parancsok | G7.5 | `src/cli.ts`, `src/interactive.ts` | Közepes |
| 47 | Audit Panel (React) | G7.6 | `AuditPanel.tsx` | Közepes |
| 48 | Audit CLI parancsok | G7.6 | `src/cli.ts`, `src/interactive.ts` | Alacsony |
| 49 | Settings Panel Gold szekció | G7.7 | `SettingsPanel.tsx`, `settingsRoutes.ts` | Közepes |
| 50 | Socket.IO event bővítés | G7.8 | `SocketService.ts`, `SocketContext.tsx` | Közepes |
| 51 | useGoldProtocol hook | G7.8 | `hooks/useGoldProtocol.ts` | Közepes |
| 52 | Sidebar + navigáció frissítés | G7.9 | `MissionControlLayout.tsx` | Alacsony |
| 53 | Gold Status Widget (főoldal) | G7.10 | `GoldStatusWidget.tsx` | Közepes |
| 54 | Dashboard & CLI tesztek | G7.11 | `test/specRoutes.test.ts` + 4 fájl | Közepes |

---

## 📊 FRISSÍTETT RESOURCE BECSLÉS

| Metrika | Eredeti (G1-G6) | + Sprint 4 (G7) | **Összesen** |
|---------|-----------------|-----------------|--------------|
| **Összes feladat** | 31 | 23 | **54** |
| **Új fájlok** | ~18 | ~16 | **~34** |
| **Módosított fájlok** | ~12 | ~10 | **~22** |
| **Új kódsorok (becsült)** | ~2500 | ~3200 | **~5700** |
| **Új teszt sorok (becsült)** | ~600 | ~260 | **~860** |
| **Összes időbecslés** | ~17 óra | ~7 óra | **~24 óra (4 sprint)** |

## 🎯 FRISSÍTETT SIKER METRIKÁK

| Pillér | Jelenlegi | Cél (G1-G6) | Cél (G7 után) | Mérőszám |
|--------|-----------|-------------|---------------|----------|
| Spec-Driven | 60% | 95% | 98% | Dashboard-ról approve/reject, CLI-ből status |
| Phoenix | 40% | 90% | 95% | Dashboard live health, CLI phoenix status |
| Model Intelligence | 70% | 85% | 95% | Dashboard model routing config, CLI budget set |
| Memória | 65% | 90% | 95% | Dashboard reindex/train trigger, CLI stats |
| Glass Box | 35% | 80% | 95% | Dashboard trace viewer, cost chart, CLI trace |
| Security | 80% | 95% | 98% | Dashboard audit panel, real-time denied alerts |
| **Dashboard Coverage** | **40%** | **40%** | **95%** | **Minden funkció elérhető UI-ról** |
| **CLI Coverage** | **30%** | **30%** | **90%** | **Minden funkció elérhető CLI-ből** |

## 🚦 FRISSÍTETT VÉGREHAJTÁSI SORREND

```
SPRINT 1 (Alapok) ─────────────────────────────────
  G1: Spec Freeze ──── G2: Phoenix Protocol
  [1-4]                [5-11]
  ~2h                  ~4h
                       
SPRINT 2 (Intelligencia) ──────────────────────────
  G3: Model Router ─── G4: Memória
  [12-14]              [15-20]
  ~2h                  ~4h
                       
SPRINT 3 (Observability) ──────────────────────────
  G5: Glass Box ────── G6: Audit
  [21-27]              [28-31]
  ~4h                  ~2h

SPRINT 4 (Dashboard & CLI) ────────────────────────
  G7.1-7.3: Spec + Phoenix + Router panels & CLI
  [32-41]
  ~3.5h

  G7.4-7.6: Memory + Trace + Audit panels & CLI
  [42-48]
  ~2.5h

  G7.7-7.11: Settings + Socket + Navigation + Tests
  [49-54]
  ~1.5h
```

**Megjegyzés:** Sprint 4 párhuzamosítható a Sprint 1-3-mal: a backend API-k (routes) Sprint 1-3-ban is készülhetnek, 
a dashboard panel-ek Sprint 4-ben épülnek rá. A Socket.IO event-ek (G7.8) prioritással készüljenek, mert minden panel épít rájuk.

---

## ⚠️ KIEGÉSZÍTŐ KOCKÁZATOK (G7)

| Kockázat | Valószínűség | Hatás | Mitigáció |
|----------|-------------|-------|-----------|
| Socket.IO event túlterhelés sok panel-lel | Közepes | Közepes | Namespacing, throttled updates (max 2/s per event) |
| Dashboard rendering lassulás trace viewer-nél | Közepes | Közepes | Virtualized list (react-window), pagination |
| CLI parancs túlzsúfoltság | Alacsony | Alacsony | Logikus csoportosítás (spec/phoenix/router/memory/trace/audit) |
| Recharts bundle méret növekedés | Alacsony | Alacsony | Lazy import, code splitting |

---
*Gold Protocol Implementation Roadmap v2.0 - Brunella Agent System*
*Frissítve: 2026-02-09 - Dashboard & CLI Teljes Integráció*
