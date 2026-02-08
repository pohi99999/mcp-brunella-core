# Dashboard V2 Implementation Plan

**Dátum:** 2026-02-08
**Agent:** Claude Code
**Projekt:** Brunella Agent System - Dashboard V2 Phase 1-3 Completion

---

## 🎯 Cél

Teljes funkcionális Dashboard V2 felépítése 3 fázisban:
1. **Phase 1:** Robotkéz Control Panel (böngésző, tesztek, screenshot, n8n)
2. **Phase 2:** Agent Management (agent list, execute, logs)
3. **Phase 3:** Task Queue + LLM Providers (task operations)

---

## 📊 Jelenlegi Állapot (2026-02-08)

### ✅ Kész Komponensek
| Komponens | Implementáció | Status |
|-----------|--------------|--------|
| **RobotkezPanel.tsx** | startBrowser, stopBrowser, runTest, screenshot | 95% ✅ |
| **LLMProvidersPanel.tsx** | getProvidersStatus, model list, latency display | 90% ✅ |
| **TaskQueueMonitor.tsx** | getTasks, pagination, status filter | 85% ✅ |
| **MissionControlLayout.tsx** | Tab-based layout, navigation | 95% ✅ |
| **FastAPI Endpoints** | /browser/*, /test/*, all Robotkéz endpoints | 100% ✅ |
| **API Service** | All functions defined (apiService.ts) | 100% ✅ |

### ⏳ Hiányos Komponensek
| Komponens | Hiányosság | Prioritás |
|-----------|-----------|----------|
| **AgentManager Panel** | Agent execution button, logs stream | Phase 2 |
| **Task Actions** | Execute/Cancel/Retry buttons | Phase 3 |
| **n8n Integration** | Workflow status query | Phase 1 |

---

## 🚀 Phase 1: Robotkéz Control Panel - TELJESÍTÉSI LISTA

### Alkomponensek
1. **Browser Session Control**
   - ✅ Start/Stop gomb
   - ✅ Status indikátor (running/stopped)
   - ⏳ Current URL display (API-ban kell)

2. **Test Execution**
   - ✅ Run Level 1 button
   - ✅ Run Level 2 button
   - ✅ Run Level 3 button
   - ⏳ Real-time log streaming (SSE)

3. **Screenshot Preview**
   - ✅ Display latest screenshot
   - ✅ Auto-refresh 5s
   - ⚠️ ESLint warning: prop fallthrough

4. **n8n Integration Status**
   - ❌ Workflow count
   - ❌ Last 5 workflows display
   - **ACTION:** Hozzáadni a n8n API queryt a RobotkezPanel-hez

### Validation Checklist
```
✅ npm run build - TypeScript OK
✅ npm test - 76+ tests running
✅ runRobotkezTest(1) - Level 1 test execution
✅ startBrowser() - Playwright session
✅ Screenshot auto-refresh - 5s polling
✅ Log streaming - SSE /test/logs/{sessionId}
```

---

## 🔧 Implementation Tasks (PRIORITÁS SORREND)

### 1. Phase 1 Completion (TODAY)
```
[ ] n8n workflow API integration
    - Hozzáadni RobotkezPanel.tsx-hez
    - Query: https://n8n-ui-server/api/v1/workflows
    - Display workflow count + last 5

[ ] Test log streaming validation
    - SSE stream /test/logs/{sessionId}
    - Real-time log display

[ ] Phase 1 End-to-End test
    - Browser start/stop
    - Run all 3 test levels
    - Screenshot updates
    - n8n status display
```

### 2. Phase 2: Agent Management (NEXT)
```
[ ] AgentManager panel completion
    - Agent list from registry.json
    - Task input field
    - Execute button (POST /api/agents/:name/execute)
    - Real-time log SSE

[ ] Agent status indicator
    - Color-coded (idle/working/error)
    - Success/error counts
    - Last task time
```

### 3. Phase 3: Task Queue + LLM (AFTER)
```
[ ] Task action buttons
    - Execute pending
    - Cancel running
    - Retry failed
    - View details

[ ] Task stats dashboard
    - Total count
    - Success rate
    - Avg execution time
    - Failed breakdown
```

---

## 📁 Érintett Fájlok

### A) Frontend (Módosítandó)
- `src/dashboard/components/dashboard/RobotkezPanel.tsx` - n8n integration
- `src/dashboard/components/dashboard/AgentManagementPanel.tsx` - NEW (Phase 2)
- `src/dashboard/lib/apiService.ts` - NEW (n8n functions)

### B) Backend (Validálás)
- `src/server/web.ts` - /api/agents/:name/execute (Phase 2)
- `myai/server.py` - /browser/*, /test/* (OK ✅)

### C) Resources (Documentation)
- `_DASHBOARD_IMPLEMENTATION_PLAN.md` - THIS FILE
- `docs/DASHBOARD_API_REFERENCE.md` - TODO

---

## 🧪 Tesztelésre Váró Items

1. **npm test** - szükséges PASS (76+ tests)
2. **Browser session** - valóban indul-e?
3. **Screenshot update** - 5s polling működik?
4. **n8n API** - elérhető-e a Render.com URL? igen
5. **Agent execute** - Phase 2 kritikus

---

## 📝 Notes

**Architektúra:**
```
React (port 5173) 
   ↓
FastAPI (port 8000) 
   ↓
Playwright + n8n
```

**CORS:** Frontend direkt kommunikál `http://localhost:8000`, szükséges CORS header?

**Deployment:** Production-ben proxy szükséges (Node.js backend → FastAPI)

---

## ✅ Sign-off Checklist

- [ ] Phase 1: 100% functional Robotkéz panel
- [ ] Phase 2: 100% functional Agent manager
- [ ] Phase 3: 100% functional Task queue Operations
- [ ] All npm tests: 76+/76 PASS
- [ ] Dashboard V2 fully deployed

---

**Készült:** Claude Code (2026-02-08 20:30)
**Status:** ⏳ Phase 1 Implementation Started
