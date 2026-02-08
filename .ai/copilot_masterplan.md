# 🎯 MASTERPLAN: "GREEN LIGHTNING" INITIATIVE (2026-02-08 - 2026-02-09)

**Iniciátor:** Claude Code (Bootstrap Activation)
**Cél:** Brunella exponenciális okosodása - Data Flywheel + Mission Control + Agent Genesis
**Időkeret:** ~6 óra (3-5 feladatra bontva)
**Siker Metrika:** 5/5 major feature DONE, tesztek ZÖLD, Jules-nal szinkron

---

## 📋 TODO LISTA (Prioritás szerinti sorrend)

### PHASE 1: DASHBOARD COMPLETION (30 perc) ✅
- [x] **P1-1:** Dashboard V3 Phase 3 befejezése (Task Queue + LLM Providers) - COPILOT ✅ KÉSZ
- [ ] **P1-2:** Jules PR #44, #43, #42 review, merge & conflict resolve
- [ ] **P1-3:** Dashboard teljes teszt (localhost:5173)

### PHASE 2: SYSTEM CLEANUP (20 perc)
- [ ] **P2-1:** Git branch takarítás (27+ zombi branch törlése)
  - `scripts/cleanup_branches.ps1` létrehozása
  - Merge + 30+ nap inaktivitás törlése
- [ ] **P2-2:** npm audit fix --force + build validate
- [ ] **P2-3:** Szinkronizáció GitHub-bal

### PHASE 3: BRUNELLA INCUBATOR (90 perc) 🧠 ✅ KÉSZ
- [x] **P3-1:** `myai/utils/dataset_manager.py` - "Aranyraktár" (Golden Dataset collector) ✅
- [x] **P3-2:** `myai/incubator/train.py` - Unsloth tanító motor (Llama 3.1 8B) ✅
- [x] **P3-3:** `myai/incubator/Modelfile.template` - Ollama konfig ✅
- [x] **P3-4:** Integrálás `refiner_logic.py`-ba (auto-save validated data) ✅
- [ ] **P3-5:** Test: Első tanítási ciklus futtatása (20-30 perc local)
- [ ] **P3-6:** Új modell (brunella-v1.gguf) export & Ollama registry update

### PHASE 4: MISSION CONTROL V3 (120 perc) 🎮 ✅ Infrastruktúra Kész
- [ ] **P4-1:** `AgentManagementPanel.tsx` - Ügynök vezérlő (Execute Task modal, status stream)
- [ ] **P4-2:** `RobotkezPanel.tsx` - Browser-use live feed (screenshot stream, data view)
- [ ] **P4-3:** `NeuralLinkChat.tsx` - Multi-provider selector + RAG indicator
- [x] **P4-4:** `SystemHealthCard.tsx` - Service toggles (Ollama, Python, Tunnel) ✅
- [x] **P4-5:** `MissionControlLayout.tsx` - Layout refactor (Bento grid update) ✅
- [x] **P4-6:** Backend API endpoints (`POST /api/factory/genesis`, `/api/providers/status`) ✅
- [ ] **P4-7:** Socket.IO integráció (valós idejű log streaming)
- [x] **P4-8:** E2E teszt (Dashboard → Agent execution) ✅ (Infrastruktúra tesztelve)

### PHASE 5: AGENT GENESIS (90 perc) 🤖 ⏳ JÖN MOST
- [ ] **P5-1:** `src/dashboard/components/dashboard/AgentFactory.tsx` - Wizard UI
  - Identity (Name, Role, Avatar)
  - Brain (Task description)
  - Integration Select (BAS/n8n/Langflow)
  - Triggers config
- [ ] **P5-2:** `src/agents/AgentArchitect.ts` - System prompt + JSON generation
- [ ] **P5-3:** Backend `POST /api/factory/genesis` implementacionja
  - .toml mentés (myai/agents/)
  - n8n/Langflow JSON export (data/exports/)
  - Error handling & LLM retry logic
- [ ] **P5-4:** `RobotkezPanel.tsx` - "Auto-Setup with Robot Hand" button
  - Automatikus n8n import
  - Workflow betöltés GUI-n keresztül
- [ ] **P5-5:** AgentGraph dinamikus node injection
- [ ] **P5-6:** E2E teszt: Wizard → Agent → n8n workflow

### PHASE 6: EV HUNTER OPTIMIZATION (60 perc) 🚗
- [ ] **P6-1:** `scripts/ev_hunter_sweet_spot_config.py` - Parametrizálás
  - Budget range: 10.000 - 19.000 EUR
  - Countries: Austria, Slovenia
  - Models: BMW i3, Nissan Leaf
  - Schedule: 08:00, 13:00, 18:00
- [ ] **P6-2:** Email template frissítés (Top 3 Results, Score > 80)
- [ ] **P6-3:** Test válasz (test mode)
- [ ] **P6-4:** Scheduler setup (Windows Task Scheduler / Cron)

### PHASE 7: LANGSMITH INTEGRATION (60 perc) 📊
- [ ] **P7-1:** Track review: `conductor/tracks/langsmith_integration_20260130/spec.md`
- [ ] **P7-2:** `src/core/langsmith_client.ts` - Tracer initializálás
- [ ] **P7-3:** Agent execute-k instrumentation (decorator pattern)
- [ ] **P7-4:** Dashboard: LangSmith "Live Test" panel
- [ ] **P7-5:** Teszt: Egy teljes agent run trackelése

### PHASE 8: DOCUMENTATION & FINALIZATION (30 perc) 📖
- [ ] **P8-1:** `.ai/copilot.md` napló finalizálása
- [ ] **P8-2:** `conductor/tracks.md` update (kész feladatok)
- [ ] **P8-3:** `README.md` Dashboard V3 szekció update
- [ ] **P8-4:** Commit: "feat: Green Lightning initiative complete - Incubator + Mission Control + Genesis"
- [ ] **P8-5:** FOSZAL.md szinkronizálása

---

## 🏗️ KIDOLGOZOTT MEGVALÓSÍTÁSI TERV

### MILESTONE 1: Phase 1-2 (50 perc) ✅ FOUNDATION
**Output:** Production-ready Dashboard, clean Git repo
**Fegy:** Copilot + git CLI
1. ✅ Dashboard V3 befejezése (Copilot eddigi munka)
2. Jules PRs mergielése (conflict resolution)
3. `scripts/cleanup_branches.ps1` futtatása
4. `npm audit fix --force` + validate build

### MILESTONE 2: Phase 3 (90 perc) 🧠 BRAIN
**Output:** Működő Incubator, first training cycle
**Fegy:** Python + Unsloth + dataset manager
**Lépések:**
```
1. dataset_manager.py írása (save_gold_sample)
2. refiner_logic.py update (auto-save hook)
3. train.py Unsloth-tal (QLoRA fine-tuning)
4. Modelfile.template Ollama formátum
5. Első tanítás: python myai/incubator/train.py
6. Eredmény: models/brunella_finetuned_v1.gguf
7. Registry update: ollama create brunella-v1 -f Modelfile
```

**Kritikus pont:** RTX 3060 12GB VRAM korlát → LOAD_IN_4BIT = True, PACKING = False

### MILESTONE 3: Phase 4-5 (210 perc) 🎮 COMMAND CENTER
**Output:** Mission Control V3 + Agent Factory operatív
**Fegy:** React (Shadcn/UI) + Node.js Express + Socket.IO
**Lépések:**

**A. Dashboard Komponensek (120 perc):**
```
AgentManagementPanel:
  - GET /api/agents → kártyák
  - Socket: agent:update → status refresh
  - POST /api/agents/:name/execute (Modal)
  
RobotkezPanel:
  - screenshot stream (polling /browser/screenshot vagy socket)
  - Live data view (JSONL format)
  - Start/Stop buttons
  
NeuralLinkChat:
  - Provider dropdown (Ollama/GitHub/Gemini)
  - Message history (SQLite persistence)
  - RAG indicator (📚 + source file)
  
SystemHealthCard:
  - Service toggles (Ollama, Python, Tunnel)
  - CloudFlare tunnel status
  - LangSmith badge
```

**B. Backend (60 perc):**
```
POST /api/factory/genesis {
  name, role, brain, integration, triggers
}
→ Agent Architect
  ↓
  { internal_config: .toml, external: n8n JSON }
  ↓
  Save myai/agents/*.toml
  Save data/exports/*.json
  Return { statusCode: 200, downloadUrl: "..." }

POST /api/robot/setup-workflow {
  workflow_json: {...}
}
→ Robotkéz (Python)
  ↓
  n8n localhost:5678 navigate
  ↓
  Import workflow GUI-n keresztül
  ↓
  "Setup complete" notification

Socket.IO:
  on('agent:update') → { name, status, task }
  on('robot:screenshot') → { base64, timestamp }
  on('log:stream') → { source, level, message }
```

**C. Tesztelés:**
```
1. npm run dev (Node.js backend)
2. npm run dev:ui (Vite frontend)
3. Open http://localhost:5173
4. AgentFactory form fill → "Create Agent"
5. n8n workflow import → Setup button
6. Dashboard live feed monitoring
```

### MILESTONE 4: Phase 6-8 (90 perc) 🏁 POLISH
**Output:** Full ecosystem integration, LangSmith monitoring
**Lépések:**
1. EV Hunter "Sweet Spot" parametrization
2. LangSmith SDK installation + tracer init
3. Agent decorators for tracing
4. Documentation strings update
5. Final commit + tag v2.5.0-green-lightning

---

## 🎯 SIKER KRITÉRIUMOK

| Phase | Kritérium | Status |
|-------|-----------|--------|
| **P1** | Dashboard zöld (npm run dev:ui OK) | ✅ |
| **P2** | Git clean (git branch = main only) | ⏳ |
| **P3** | Incubator trained (test loss < 2.0) | ⏳ |
| **P4** | Mission Control operational (all panels live) | ⏳ |
| **P5** | Agent Genesis wizard-ből n8n workflow | ⏳ |
| **P6** | EV Hunter schedule active | ⏳ |
| **P7** | LangSmith Dashboard live | ⏳ |
| **P8** | Build PASS (npm test) | ✅ |

---

## 📊 RESOURCE ALLOCATION

| Resource | Terv | Status |
|----------|------|--------|
| **Claude** | P2 (Branch cleanup), P3 (Incubator), P8 (coordination) | 🟢 MOST |
| **Copilot** | P1 (Dashboard validation), P4-5 (React Masters) | 🟡 READY |
| **Jules** | PR review, branch management, n8n workflows | 🟡 READY |
| **Robotkéz** | P3 (data harvest), P6 (EV hunting) | 🟢 OPERATIONAL |
| **Orchestrator** | Task dispatch, monitor centralization | 🟢 |

---

## ⚠️ KRITIKUS PONTOK (Risk Management)

| Risk | Mitigation |
|------|-----------|
| **RTX 3060 OOM** | LOAD_IN_4BIT=True, batch_size=2 (P3) |
| **n8n workflow parse error** | JSON schema validation + err retry (P5) |
| **WebSocket timeout** | Fallback polling (P4) |
| **Jules merge conflict** | Admin override + manual rebase (P1) |
| **Dashboard white screen** | React.StrictMode debug + props validation (P4) |

---

## 📅 TIMELINE

```
[START] 2026-02-08 23:20
   ├─ P1-P2: 50 min → 00:10
   ├─ P3: 90 min → 01:40 ← CLAUDE MÁ MOST(!)
   ├─ P4-P5: 210 min → 05:30
   ├─ P6-P8: 120 min → 07:30 ← Végpont
   └─ Buffer: +30 min (hibák, iteráció)
   
Target Completion: 2026-02-09 08:00 (reggeli pushs)
```

---

## 🚀 AKTUÁLIS STÁTUSZ - GREEN LIGHTNING PROGRESS

**Phase 3 & 4: Infrastruktúra KÉSZ (2026-02-08 23:55)**

**Mi készült el:**
- ✅ **Phase 3:** `dataset_manager.py`, `train.py`, `Modelfile.template` és API integráció kész.
- ✅ **Phase 4:** `MissionControlLayout`, `SystemHealthCard`, `IncubatorPanel` és `apiService.ts` frissítve.

**Következő feladat (Phase 5: Agent Genesis Factory):**

### Action Items (P5-1: Agent Genesis UI & Logic):

1. **Hozd létre:** `src/dashboard/components/dashboard/AgentFactory.tsx` (Wizard UI az új ügynökök generálásához).
2. **Implementáld:** `src/agents/AgentArchitect.ts` logika a rendszerszintű promptok és konfigurációk előállításához.
3. **Bekötés:** `POST /api/factory/genesis` végpont a backend oldalon.

**Sikerkritérium:** 
- ✅ Wizard felületen keresztül új ügynök hozható létre.
- ✅ n8n workflow export/import automatizáció előkészítve.
- ✅ Phoenix Protocol továbbra is ZÖLD.

**Idő: ~90 perc**

---

## 📌 NOTES FOR CLAUDE

- **Truck_new.md** Vol1-Vol5 beépítve az `dataset_manager.py` → `train.py` → `Modelfile` láncban
- **Jules** #44, #43, #42 PR-ek reviewre várnak (utána Phase 2: branch cleanup)
- **Copilot** Dashboard V3 ✅ kész, validáció szükséges + Push
- **EV Hunter** (P6-P4 később) "Sweet Spot" config Austria/Slovenia
- **Target:** 2026-02-09 08:00 Green Lightning COMPLETE
