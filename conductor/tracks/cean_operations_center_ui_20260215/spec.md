# CEAN Operations Center UI - Teljeskörű Specifikáció

**Status:** `pending_approval` → **READY FOR IMPLEMENTATION**
**Created:** 2026-02-15
**Owner:** Claude Code AI
**Priority:** 🔥 **CRITICAL** (Cloudflare Edge Agents Network core UI)

---

## 1. Kivonat (Executive Summary)

A **CEAN Operations Center** egy magyar nyelvű, teljes körű irányítópult az edge agent hálózat kezeléséhez, monitorozásához és vezérléséhez. Az Orchestrator Agent-tel valós idejű szöveges csevegés, worker task delegálás, és D1/R1 erőforrás-kezelés főbb funkcionalitásai.

**Célszemély:** Projektvezetők, DevOps mérnökök, kutatók
**Platform:** Web (React 18 + Vite) | Port: 5173
**Biztonság:** JWT auth (meglévő BAS session-ből)
**Integrációs API:** Express backend + Socket.IO + MCP tools

---

## 2. Felhasználói Interfész (UI/UX)

### 2.1 Layout Szerkezet

```
┌─────────────────────────────────────────────────────────────────┐
│  🚀 CEAN Operations Center | Naplózott be: Pohánka Péter      │ ← NavBar
├─────────────────────────────────────────────────────────────────┤
│  [Irányítópult] [Workers] [Feladatok] [D1/R1 Adatok] [Beállít.] │ ← Tabs
├──────────────────────────────┬──────────────────────────────────┤
│                              │                                  │
│   MAIN PANEL                 │    ORCHESTRATOR CHAT             │
│  (változó tartalom)          │  (800px | rögzített jobb oldal)  │
│                              │                                  │
│  Irányítópult ->             │  ┌──────────────────────────┐    │
│  ┌─────────────────────────┐ │  │  Chabot-üzenetek        │    │
│  │ Worker Állapot Grid     │ │  │                          │    │
│  │ (5 x 2 card)            │ │  │ Bot: "Készen állok      │    │
│  │                         │ │  │  feladatokra..."        │    │
│  │ [Status][CPU][RAM]      │ │  │                          │    │
│  │ [Tasks][Errors][Cost]   │ │  └──────────────────────────┘    │
│  │                         │ │  ┌──────────────────────────┐    │
│  │ [Aktivitási Grafikon]   │ │  │ Üzenet beviteli mező    │    │
│  │                         │ │  │ "Kérlek futtass...   [➤]│    │
│  │ [Legutóbbi Feladatok]   │ │  └──────────────────────────┘    │
│  └─────────────────────────┘ │                                  │
│                              │                                  │
└──────────────────────────────┴──────────────────────────────────┘
```

### 2.2 Fül-panelok (Tab Pages)

#### **Irányítópult (Dashboard) - Default**
- **Worker státusz grid** (5 card x 2 sor):
  - `research-agent` | Status: 🟢 RUNNING | CPU: 12% | RAM: 45%
  - `grant-monitor` | Status: 🟡 IDLE | CPU: 0% | RAM: 8%
  - `data-harvester` | Status: 🔴 ERROR | Hiba: API timeout
  - `extractor` | Status: 🟢 RUNNING | Feladatok: 23/50
  - `builder` | Status: 🟢 RUNNING | Utolsó build: 2 perc
- **Aktivitási timeline** (este 6 órás):
  - Chart: Request count/hour
  - Hely: Cost accumulation (USD)
- **Legutóbbi feladatok** (3-5 sor, sortable):
  - Idő | Worker | Task | Status | Duration
  - 14:32 | research-agent | "GitHub AI grantok" | ✅ DONE | 8m 3s
  - 14:25 | grant-monitor | "Napi scan" | ✅ DONE | 1m 15s

#### **Workers - Részletes Kezelés**
- **Worker lista** (táblázat):
  - Név | Status | Last Run | Next Run | Uptime | Actions
  - `[Szerkeszt]` `[Logjegyzék]` `[Manuális trigger]` `[Deaktiv.]`
- **Individuális Worker kártya** (szerkesztési modális):
  - Konfigurációs paraméterek (YAML editor)
  - Schedule szerkesztés (cron formátum)
  - Logjegyzék (live tail)
  - Cost analysis ($/run)

#### **Feladatok (Tasks) - Sor kezelés**
- **Queue view**:
  - Prioritás szintje | Task ID | Worker | Státusz | Enqueue: | ETA
- **Task detail panel**:
  - Payload (JSON editor)
  - Execution log (streaming)
  - Cancellation option
  - Result view (CSV/JSON export)

#### **D1/R1 Adatok - Adatbázis Kezelés**
- **D1 (SQLite)**:
  - Táblák listája: `edge_tasks`, `edge_executions`, `edge_results`, `edge_metrics`, stb.
  - Row count / Storage (MB)
  - Query builder (SELECT szerkeszthető)
  - Data preview (paginated)
- **R1 (Vectorize)**:
  - Index név | Dimension | Entries | Last indexed
  - Embedding search (demo)
  - Hint: "R1 tokenizálás: bejövő task payload → GPT-3.5-tiny embedding"

#### **Beállítások (Settings)**
- Nyelvválasztás: 🇭🇺 Magyar | 🇺🇸 English
- Sötét módváltás
- Notification preferences
- API token regenerálás
- Export config (JSON)

---

## 3. Orchestrator Chat Interface (Jobb oldal panel)

### 3.1 Chat Funkciók

**Kommunikáció:**
- WebSocket-es real-time (Socket.IO)
- Üzenetfolyam: User → Orchestrator → Worker → Result
- Response streaming (jelenjen meg az üzenet szóról szóra)

**Üzenet Típusok:**
1. **Felhasználó → Orchestrator**
   ```
   "Kérlek futtass egy research-agent-et az AI grant-okra"
   "Mi a status az összes worker-nek?"
   "Hány task van várakozásban?"
   "D1-ben mennyi az egybevonto_metrics szumma?"
   ```

2. **Orchestrator Válasza (szöveges)**
   ```
   "Megcsinálom! A research-agent-et most elindítom...
    Task ID: cean-research-2026-0215-14-32-45
    
    Paraméterek:
    - Keresési kifejezés: AI grant 2026
    - Limit: 50 találat
    - Prioritás: HIGH
    
    Becsült futási idő: 8-10 perc
    Status: STARTED ✓"
   ```

3. **Task Delegálás Típusok (predefined templates)**
   ```
   🔹 Research task: "Keressen [téma] a [forrás]-on"
   🔹 Grant monitoring: "Napi scan [kategória]-ra"
   🔹 Data harvesting: "Szedj adatokat [URL]-ról"
   🔹 Extraction: "Bontsd ki [adattípus]-t az [input]-ből"
   🔹 Builder: "Fordítsd [repo]-t, output: [formátum]"
   ```

### 3.2 Chat UX Details

- **Üzenet buborék** (Orchestrator):
  - Avatar: 🤖 ORCHESTRATOR
  - Szín: Kék (#3B82F6)
  - Markdown support (bold, code блок)
  - Idő: 14:32:45

- **Üzenet buborék** (Felhasználó):
  - Avatar: Felhasználó inicjálei (PN)
  - Szín: Szürke (#6B7280)
  - Idő: 14:32:12

- **Input mező**:
  - Placeholder: "Mondd meg, mit csineljen az Orchestrator..."
  - Auto-complete suggestiók (task template-ek)
  - Küldés gomb: [➤] (vagy Enter)
  - File upload lehetőség: drag & drop JSON

- **Scroll perf.:
  - Max 200 üzenet memóriában
  - Virtalizálás nagy chat-ekhez
  - Auto-scroll bottom (új üzenet)

---

## 4. API Backend Specifikáció

### 4.1 REST Endpoints

#### **Worker Management**
```
GET /api/cean/workers
  → Response: [{ id, name, status, uptime, lastRun, config }]

GET /api/cean/workers/:id
  → Response: { id, name, status, logs[], metrics }

PUT /api/cean/workers/:id
  → Request: { config, schedule, enabled }
  → Response: { success, message }

POST /api/cean/workers/:id/trigger
  → Request: { payload }
  → Response: { taskId, status, eta }

GET /api/cean/workers/:id/logs
  → Response: { logs[], lastUpdated }
  → WebSocket: tail mode available
```

#### **Task Queue**
```
GET /api/cean/tasks/queue
  → Response: [{ id, worker, payload, status, priority, eta }]

GET /api/cean/tasks/:id
  → Response: { id, status, log, result, duration, cost }

DELETE /api/cean/tasks/:id
  → Response: { success, cancelled }
```

#### **D1 Database**
```
GET /api/cean/d1/tables
  → Response: [{ name, rowCount, sizeKB }]

POST /api/cean/d1/query
  → Request: { sql, limit: 100 }
  → Response: [{ rows }] (safe SELECT only)

GET /api/cean/d1/table/:name
  → Response: { schema, rows[], count }
```

#### **R1 Vectorize**
```
GET /api/cean/r1/indexes
  → Response: [{ name, dimension, count, lastIndexed }]

POST /api/cean/r1/search
  → Request: { query, topK: 10 }
  → Response: [{ embedding, score, metadata }]
```

#### **Metrics & Monitoring**
```
GET /api/cean/metrics
  → Response: { 
      requestsPerHour: [12, 15, 8, ...],
      costAccumulated: 0.42,
      workerUptime: { research: 99.9, grant: 95.2, ... },
      errorRate: 0.02
    }

GET /api/cean/metrics/worker/:id
  → Response: { cpu, memory, requests, errors, cost/hour }
```

### 4.2 WebSocket Events (Socket.IO)

```typescript
// Client → Server
emit('cean:task:execute', { worker, payload })
emit('cean:orchestrator:prompt', { message })
emit('cean:worker:tail-logs', { workerId })
emit('cean:task:cancel', { taskId })

// Server → Client
on('cean:worker:status', { workerId, status, metrics })
on('cean:orchestrator:response', { message, metadata })
on('cean:task:update', { taskId, status, progress })
on('cean:logs:append', { line, timestamp })
```

---

## 5. Orchestrator Integration

### 5.1 Prompt Processing

**Input:** `"Kérlek futtass egy research-agent-et az AI grant-okra"`

**Orchestrator fejlődése:**
1. **Parse** task intent → `{ worker: 'research-agent', action: 'execute', params: { topic: 'AI grants' } }`
2. **Decompose** → Alfeladatok:
   - GitHub API token check
   - Search param validation
   - Task creation in D1
3. **Delegate** → Worker-hez
4. **Monitor** → Status polling
5. **Report** → Chat response (magyar, user-friendly)

**Output ejemplo:**
```
🚀 Research Agent Elindítva

Task ID: cean-res-2026-0215-14-32-45
Status: RUNNING ⏳

Paraméterek:
├─ Téma: "AI grants 2026"
├─ Forrás: GitHub/Google Scholar
├─ Limit: 50 találat
└─ Prioritás: HIGH

📊 Státusz:
├─ 0% (API lekérdezés)
└─ ETA: 8 perc 30 sec

💾 Cost tracking: $0.02 (10 API call)
```

### 5.2 Task Delegation Flow

```
User Chat Input
    ↓
Orchestrator.parseIntentAsync()
    ↓
TaskDecomposerAgent.decompose()
    ↓
Create task in D1 (edge_tasks table)
    ↓
Trigger worker via Cloudflare API
    ↓
Monitor execution (live polling)
    ↓
Stream results to chat UI
    ↓
User sees: "✅ DONE | Results ready in D1"
```

---

## 6. React Komponensek Listája

### 6.1 Fő Komponensek

```
src/dashboard/components/cean/
├── CEANLayout.tsx                  # Main tab layout
├── CEANNavBar.tsx                  # Top navbar w/ user info
├── 
├── tabs/
│   ├── DashboardTab.tsx            # Grid of workers, metrics
│   ├── WorkersTab.tsx              # Worker list + detail modal
│   ├── TasksTab.tsx                # Task queue + detail panel
│   ├── DataTab.tsx                 # D1 + R1 explorer
│   └── SettingsTab.tsx             # User settings
│
├── components/
│   ├── WorkerStatusCard.tsx        # Single worker mini card
│   ├── WorkerDetailModal.tsx       # Edit config, logs, metrics
│   ├── TaskQueueTable.tsx          # Task list w/ sorting
│   ├── TaskDetailPanel.tsx         # Task execution view
│   ├── D1Explorer.tsx              # DB table browser
│   ├── R1SearchPanel.tsx           # Vector search UI
│   ├── MetricsChart.tsx            # Chart.js graph
│   └── ActivityTimeline.tsx        # 6-hour activity view
│
└── chat/
    ├── OrchestratorChat.tsx        # Chat container
    ├── ChatMessage.tsx             # Single message bubble
    ├── ChatInput.tsx               # Input + suggestions
    ├── TaskTemplates.tsx           # Predefined prompts
    └── StreamingResponse.tsx       # Animated response text
```

### 6.2 Könyvtárak & Dependenciák

- **UI Framework:** Radix UI v1.0 (meglévő)
- **Styling:** Tailwind CSS v4 (meglévő)
- **Charts:** recharts (NPM install szükséges)
- **Real-time:** Socket.IO client (meglévő)
- **State:** TanStack Query v5 (meglévő)
- **Icons:** lucide-react (meglévő)
- **JSON Editor:** Monaco Editor (opcionális)

---

## 7. Adatfolyam (Data Flow)

```
┌──────────────────┐
│  CEAN Dashboard  │
│  (React UI)      │
└────────┬─────────┘
         │ Socket.IO emit('cean:orchestrator:prompt', { message })
         ↓
┌──────────────────────────┐
│  Backend (Express)       │
│  POST /api/orchestrator  │
└────────┬─────────────────┘
         │ call OrchestratorAgent.execute()
         ↓
┌────────────────────┐
│ Orchestrator Agent │  ← TaskDecomposerAgent, ResearcherAgent, etc.
└────────┬───────────┘
         │ task creation → D1
         ↓
┌──────────────────┐
│   Cloudflare API │  ← POST /client/v4/accounts/:id/workers/scripts/:name
│   (trigger task) │
└────────┬─────────┘
         │
         ↓
┌─────────────────────────────┐
│ Edge Worker Script Running  │  ← research-agent.ts, grant-monitor.ts, etc.
│ on Cloudflare Servers       │
└────────┬────────────────────┘
         │ write results to D1
         ↓
┌─────────────┐
│  D1 (SQLite)│
│  (storage)  │
└─────────────┘
         ↑
         │ query → Backend → Socket.IO emit('cean:task:update', {...})
         │
      Dashboard (UI update)
```

---

## 8. Implementációs Ütemezés (Phases)

### Phase 1: Frontend Layout (2 nap)
- [ ] CEANLayout.tsx + navbar + tabs
- [ ] Worker status grid CSS
- [ ] Basic routing (next + hash)

### Phase 2: Chat Interface (2-3 nap)
- [ ] OrchestratorChat.tsx + Socket.IO
- [ ] Message rendering (user + bot)
- [ ] Task templates dropdown

### Phase 3: Worker Management (2-3 nap)
- [ ] WorkerDetailModal + config editor
- [ ] Task queue table + filtering
- [ ] Live log tail (WebSocket)

### Phase 4: D1/R1 Explorer (1-2 nap)
- [ ] D1 table browser
- [ ] R1 search demo
- [ ] Query builder (SELECT safe)

### Phase 5: Integration & Metrics (2-3 nap)
- [ ] Socket.IO event handlers (backend)
- [ ] API endpoints (REST + WS)
- [ ] Metrics dashboard (charts)

### Phase 6: Testing & Polish (1-2 nap)
- [ ] E2E tests (Playwright)
- [ ] Component unit tests
- [ ] Performance optimization
- [ ] Dark mode theme

**Total:** ~12-14 munkanapos fejlesztés

---

## 9. Biztonsági Követelmények

1. **Authentication:** JWT from BAS session (meglévő)
2. **Authorization:** Role-based (admin, operator, viewer)
3. **D1 Query Safety:** Only SELECT; whitelist tables
4. **Logging:** Audit trail (who ran what task, when)
5. **Rate Limiting:** 100 req/min per user
6. **HTTPS:** Production environment required

---

## 10. Elfogadási Kritériumok

- [x] Spec dokumentálva
- [ ] Layout meckup UI mockup ready
- [ ] API endpoints specced
- [ ] Orchestrator integration design done
- [ ] All FE components scaffolded
- [ ] Backend routes implemented
- [ ] Socket.IO events working
- [ ] Chat message streaming OK
- [ ] All 100+ UI tests PASS
- [ ] Build + npm test = ✅ GREEN
- [ ] Live demo on localhost:5173

---

## 11. Megjegyzések & FAQs

**Q: Hogyan integráljuk az Orchestrator-t?**
A: `OrchestratorAgent.execute(userPrompt)` hívás, amely:
   1. Parses intent
   2. Task decomposition
   3. Worker delegation
   4. Returns response stream (Socket.IO)

**Q: D1 query safety?**
A: Parser whitelist: csak `SELECT` és előre definiált táblák

**Q: Cost tracking live?**
A: Cloudflare API-ból (`accounts/:id/workers/scripts/:name/tail`) cost event-ek olvasása

**Q: Multi-language support?**
A: i18n file: `src/dashboard/locales/{hu,en}.json` (csatorna)

**Q: Deployment to production?**
A: GitHub Actions: `deploy-cean.yml` (Phase 2)

---

**Status:** `pending_approval`
**Next Step:** Approval → Phase 1 Planning Document + Component Scaffold

---
