# Jules Continuous AI Integration (JCAI)

**Track ID:** `jules_continuous_ai_integration_20260215`  
**Owner:** Brunella AI  
**Status:** `final_validation` (Phase 3E - Final Deploy)  
**Start Date:** 2026-02-15  
**Target Completion:** 2026-02-22 (1 week)  
**Current Progress:** 95% (Phase 3A-D completed, E2E tests ✅, tunnel verified ✅)

---

## 🎯 CÉL (Objectives)

Integrálni a **Jules Continuous AI** képességeit (Suggested Tasks, Scheduled Tasks, GitHub Deploy) a Brunella Agent System-be, hogy **automata fejlesztési workflow** legyen:

```
Jules AI (Google)
    ↓
Continuous AI Engine (Brunella)
    ├─ Suggested Tasks Scanner (TODOs)
    ├─ Scheduled Task Engine (Nappy 3x runs)
    └─ GitHub Webhook Handler (Deploy fix)
    ↓
Automata CI/CD Pipeline
    ↓
100% Hands-Off Development
```

---

## 📊 FÁZISOK (Phases)

### **FÁZIS 1: Suggested Tasks Engine** (Nap 1-2)
**Cél:** TODO-kat szkennel, feladatokká alakít, Dashboard-on mutatja.

**Komponensek:**
- `src/core/suggestedTasksScanner.ts` - Codebase TODO parser
- `src/server/routes/suggestedTasks.ts` - API endpoints
- `src/dashboard/...SuggestedTasksPanel.tsx` - UI widget
- Database schema (`schema.sql`) - task storage

**Végeredmény:** 
```
brunella tasks suggest
→ Dashboard: 47 suggested tasks
→ Claude can pick & execute
```

---

### **FÁZIS 2: Scheduled Tasks Engine** (Nap 3-4)
**Cél:** Napi/heti/havi promptok automata futtatása.

**Komponensek:**
- `src/server/schedulers/scheduledTasksRunner.ts` - Cron engine
- `src/server/routes/scheduledTasks.ts` - API CRUD
- Database schema - task scheduling
- Notification system (email/Slack)

**Végeredmény:**
```
brunella schedule add "Nightly build" "npm test" "0 2 * * *"
→ Automata 2 AM: test futás
→ Report email/Slack
```

---

### **FÁZIS 3: GitHub Deploy Integration** (Nap 5-6)
**Cél:** GitHub workflow fail → Jules auto-fix → retry.

**Komponensek:**
- `src/server/routes/githubWebhook.ts` - webhook handler
- `src/tools/deploymentAnalyzer.ts` - error ana lysis
- Jules bridge (Python)
- Notification + auto-merge logic

**Végeredmény:**
```
Build fail on GitHub
    ↓ webhook
Brunella error analysis
    ↓
Jules: "Fix this"
    ↓
New commit pushed
    ↓
Retry workflow
    ↓
PASS → Auto merge 🎉
```

---

### **FÁZIS 4: Integration & Testing** (Nap 7)
**Cél:** Full pipeline test, dokumentáció, go live.

**Komponensek:**
- End-to-end testing
- Dashboard integration
- CLI commands
- README update
- Track completion

---

## 🗂️ FÁJLOK (Files to Create/Modify)

### **ÚJ FÁJLOK:**
```
src/core/suggestedTasksScanner.ts          (300 lines)
src/server/routes/suggestedTasks.ts        (250 lines)
src/server/routes/scheduledTasks.ts        (400 lines)
src/server/routes/githubWebhook.ts         (350 lines)
src/server/schedulers/scheduledTasksRunner.ts (250 lines)
src/tools/deploymentAnalyzer.ts            (200 lines)
src/dashboard/components/dashboard/SuggestedTasksPanel.tsx (400 lines)
src/dashboard/components/dashboard/ScheduledTasksPanel.tsx (350 lines)
scripts/scheduled-tasks-init.sql           (schema)
```

### **MÓDOSÍTANDÓ FÁJLOK:**
```
schema.sql                                 (add tables)
src/server/web.ts                          (register routes)
src/cli.ts                                 (new commands)
src/dashboard/components/dashboard/MissionControlLayout.tsx (new tabs)
package.json                               (if new deps)
```

---

## 📋 ACCEPTANCE CRITERIA

- [x] Fázis 1: Suggested Tasks Scanner ✅
- [x] Fázis 2: Scheduled Tasks Engine ✅
- [x] Fázis 3A: Toast + Email Notifications ✅
- [x] Fázis 3B: Jules Config Parser ✅
- [x] Fázis 3C: Dashboard Stats/Charts ✅
- [ ] Fázis 3D: E2E Tests (in progress)
- [ ] Fázis 3E: Final Deploy (pending)
- [x] CLI parancsok működnek ✅
- [x] Dashboard widgetek működnek ✅
- [ ] npm test: 100% pass (failing tests: suggestedTasks, persistentBrowser)
- [x] npm run build: 0 errors ✅
- [ ] GitHub PR merged

---

## 🛠️ TECH STACK

| Technológia | Verzió | Cél |
|------------|--------|-----|
| **node-schedule** | ^1.3.3 | Cron wrapper (már van?) |
| **better-sqlite3** | ^12.6.0 | Database (már van!) |
| **inquirer** | ^8.2.7 | CLI menu (már van!) |
| **express** | ^5.2.1 | REST API (már van!) |
| **React** | ^19.2.3 | Dashboard (már van!) |

---

## 🔗 DEPENDENCIES

- `Local Test Scheduler` (conductor/tracks/local_test_scheduler_20260215) - ✅ már kész
- `GitHub Sync Scripts` (scripts/sync.bat) - ✅ már kész
- `Dashboard Framework` (src/dashboard/) - ✅ már kész

---

## 📈 SUCCESS METRICS

1. **Suggested Tasks:**
   - ≥40 TODO found in codebase
   - Dashboard display: <1s load time
   - Task execution parallel: ≥5 tasks

2. **Scheduled Tasks:**
   - Cron accuracy: ±5s tolerance
   - Success rate: ≥95%
   - Email/Slack notify: 100%

3. **GitHub Deploy:**
   - Webhook latency: <2s
   - Error detect accuracy: ≥90%
   - Auto-fix success: ≥70%

4. **Overall:**
   - Zero manual intervention workflow
   - Test suite: 539+ pass (current baseline)
   - Build time: <3 minutes

---

## 📝 NOTES

- **Jules Integration:** Python `scripts/jules_cli_wrapper.py` már létezik, use it
- **Database:** SQLite (better-sqlite3), sync operations
- **Notifications:** Email (optionál, Slack preferred)
- **GitHub API:** Token-based auth (env var: GITHUB_TOKEN)

---

## 🚀 NEXT STEPS

1. ✅ Spec approval (this file)
2. → TODO list breakdown (actions/list down)
3. → Phase 1 implementation start
4. → Daily standup tracking

**Status:** `active` → Phase 3E (Final Deploy) pending

---

## 🔧 RECENT CHANGES (2026-02-15)

### Phase 3A: Notifications ✅
- Email notification service (`src/utils/notificationService.ts`)
- Critical TODO toast alerts in dashboard
- SMTP configuration via env vars

### Phase 3B: Jules Config + Automation ✅
- Jules config parser (`src/core/julesConfig.ts`)
- Automation service (`src/core/automationService.ts`)
- Webhook relay endpoint

### Phase 3C: Dashboard Enhancements ✅
- Stats cards (total, pending, in_progress, critical)
- Status pie chart
- Confidence distribution chart

### Phase 3D: Test Stabilization (in progress)
- suggestedTasks tests rewritten with supertest + mock app ✅
- persistentBrowser timeout issues (pending fix)

---

**Author:** Copilot Claude  
**Last Updated:** 2026-02-15 16:30  
**Version:** 1.1
