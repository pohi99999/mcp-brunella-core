# CEAN Operations Center UI - Implementációs Terv

**Track ID:** `cean_operations_center_ui_20260215`
**Created:** 2026-02-15
**Duration:** ~14 munkanapok (2.5-3 hét)
**Team:** Claude Code (Developer), Orchestrator Agent (integration)

---

## 📅 Fázisok & Mérföldkövek

### **FÁZIS 1: Frontend Layout & Navigation** (2 nap)
**Cél:** Tab-based interface, komponens scaffold

**Feladatok:**
- [ ] `CEANLayout.tsx` core component (main tab container)
- [ ] `CEANNavBar.tsx` (top navbar w/ logo + user info + logout)
- [ ] Tab router: Dashboard | Workers | Tasks | D1/R1 | Settings
- [ ] Radix Tabs integrációa
- [ ] Dark mode toggle (CSS variable seed)
- [ ] Mobile responsivity baseline
- [ ] Commit: `feat(cean): phase1 - layout & tabs`

**Acceptance Criteria:**
- `npm run build` ✅
- `npm test` tests pass
- UI vizually matches spec diagram
- Tab switching smooth (no reload)
- Responsive on mobile (768px+)

**Resources:**
- Radix UI Tabs docs
- React Router v6 (hash-based routing)
- Tailwind v4 classnames

---

### **FÁZIS 2: Chat Interface** (2-3 nap)
**Cél:** Real-time Socket.IO chat dengan Orchestrator

**Feladatok:**
- [ ] `OrchestratorChat.tsx` (main chat container, Portal)
- [ ] `ChatMessage.tsx` (user + bot message bubble)
- [ ] `ChatInput.tsx` (textarea + send button)
- [ ] Socket.IO client setup (`socket.on('cean:orchestrator:response')`)
- [ ] Message streaming animation (char by char)
- [ ] Task template suggestions (dropdown)
- [ ] Message persistence (localStorage draft)
- [ ] Scroll-to-bottom auto behavior
- [ ] Typing indicator from bot
- [ ] Error toast on send fail
- [ ] Commit: `feat(cean): phase2 - orchestrator chat`

**Acceptance Criteria:**
- User message appear immediately (optimistic)
- Bot response streams char-by-char
- Socket.IO events log in browser console
- 200+ messages test (virtualization perf OK)
- no ref memory leaks (DevTools)

**Resources:**
- Socket.IO client lib (meglévő)
- Radix Popover (templates dropdown)
- react-markdown (bot response formatting)

---

### **FÁZIS 3: Worker Management & Task Queue** (2-3 nap)
**Cél:** Worker list, task queue, live logs

**Feladatok:**
- [ ] `WorkersTab.tsx` (table view)
- [ ] `WorkerStatusCard.tsx` (mini status card for dashboard)
- [ ] `WorkerDetailModal.tsx` (config editor + logs)
- [ ] `TasksTab.tsx` (queue table, sortable)
- [ ] `TaskDetailPanel.tsx` (execution view + result)
- [ ] Live log tailing (WebSocket event listener)
- [ ] Manual trigger button (POST /api/cean/workers/:id/trigger)
- [ ] Cancel task button (DELETE /api/cean/tasks/:id)
- [ ] Config YAML editor (Monaco or textarea)
- [ ] Schedule cron builder (friendly UI)
- [ ] Commit: `feat(cean): phase3 - workers & tasks`

**Acceptance Criteria:**
- All worker status colors match spec (🟢 🟡 🔴)
- Task queue sorts by priority/ETA
- Log tail realizes < 500ms delay (live)
- Modal closes on ESC key
- Config validation before save
- CSS prevents layout shift

**Resources:**
- TanStack React Table v8 (sorting + pagination)
- Radix Dialog (modal)
- diff-match-patch (YAML syntax highlight)

---

### **FÁZIS 4: D1 & R1 Explorer** (1-2 nap)
**Cél:** Database browser & vector search demo

**Feladatok:**
- [ ] `DataTab.tsx` (tab container)
- [ ] `D1Explorer.tsx` (table list + schema view + query builder)
- [ ] `R1SearchPanel.tsx` (embedding search demo)
- [ ] POST /api/cean/d1/query (safe SELECT handler)
- [ ] GET /api/cean/r1/indexes (list indexes)
- [ ] Table preview (first 100 rows)
- [ ] Data export (CSV button)
- [ ] Query history (localStorage)
- [ ] Commit: `feat(cean): phase4 - d1 r1 explorer`

**Acceptance Criteria:**
- All 6 D1 tables appear in list
- Query result paginated (50 rows/page)
- R1 index count accurate
- Export CSV opens in Excel/Sheets
- Query errors shown as toast
- No SQL injection possible (whitelisted tables)

**Resources:**
- SQL.js (browser SQL parser)
- Papaparse (CSV export)
- TanStack React Table

---

### **FÁZIS 5: Backend Routes & Socket.IO** (2-3 nap)
**Cél:** Express API endpoints + real-time event handlers

**Feladatok:**
- [ ] `src/server/routes/cean.ts` (new route file)
- [ ] Worker endpoints: GET /api/cean/workers, POST /:id/trigger
- [ ] Task endpoints: GET /api/cean/tasks, DELETE /:id
- [ ] D1 endpoints: GET /tables, POST /query
- [ ] R1 endpoints: GET /indexes, POST /search
- [ ] Metrics endpoints: GET /metrics, /:workerIdMetrics
- [ ] Socket.IO handlers: `on('cean:orchestrator:prompt')`
- [ ] Task decomposer integration
- [ ] Cloudflare API calls (trigger worker)
- [ ] D1 query executor (safe mode)
- [ ] Cost accumulator (real-time tracking)
- [ ] Auth middleware (JWT check)
- [ ] Commit: `feat(cean): phase5 - backend api`

**Acceptance Criteria:**
- All endpoints documented in Swagger
- 40+ API tests (vitest)
- Socket.IO message lag < 200ms
- Error responses follow standard format
- Rate limiting active (100 req/min)
- Cloudflare API errors handled gracefully

**Resources:**
- Express router patterns (meglévő)
- Socket.IO namespaces
- Cloudflare API docs
- Logger.ts for audit trails

---

### **FÁZIS 6: Orchestrator Integration** (1-2 nap)
**Cél:** Task decomposition + prompt intelligent processing

**Feladatok:**
- [ ] Orchestrator.executeTask() method
- [ ] Intent parser (user message → task intent)
- [ ] Task decomposer call (break into subtasks)
- [ ] Worker selection logic (which worker for task X?)
- [ ] D1 task creation (edge_tasks insert)
- [ ] Cloudflare manual trigger (worker script URL)
- [ ] Task monitor (poll status)
- [ ] Response formatter (chat-friendly message)
- [ ] Error recovery (retry, fallback)
- [ ] Commit: `feat(cean): phase6 - orchestrator`

**Acceptance Criteria:**
- Intent parsing works for 10+ task types
- Decomposer splits complex tasks correctly
- D1 task record created + ID returned
- Worker task execution confirmed
- Response message in Dutch (Magyar)
- All 20+ Orchestrator tests PASS

**Resources:**
- OrchestratorAgent class (meglévő)
- TaskDecomposerAgent (meglévő)
- D1 SQL insert patterns
- Cloudflare Workers REST API

---

### **FÁZIS 7: Metrics & Monitoring** (1-2 nap)
**Cél:** Performance charts, cost tracking, uptime dashboard

**Feladatok:**
- [ ] `MetricsChart.tsx` (recharts line/bar chart)
- [ ] `ActivityTimeline.tsx` (6-hour activity view)
- [ ] Dashboard stat cards (total cost, avg response time, etc)
- [ ] Worker metrics aggregation (CPU, memory, requests)
- [ ] Cost accumulator ($/hour trend)
- [ ] Uptime calculator (99.9% SLA target)
- [ ] Commit: `feat(cean): phase7 - metrics`

**Acceptance Criteria:**
- Charts load < 1s
- Metrics update every 30 sec (Socket.IO)
- Cost values match Cloudflare API
- Responsive on mobile
- darkmode chart colors OK

**Resources:**
- recharts library (npm install)
- date-fns (time formatting)
- numeral.js (number formatting)

---

### **FÁZIS 8: Testing & Polish** (1-2 nap)
**Cél:** Unit + E2E tests, dark mode, i18n

**Feladatok:**
- [ ] Component unit tests (vitest, React Testing Library)
- [ ] E2E tests (Playwright: create task, check D1)
- [ ] Dark mode theme (Tailwind dark: prefix)
- [ ] i18n setup (hu.json, en.json)
- [ ] Accessibility audit (axe-core)
- [ ] Performance profiling (Lighthouse)
- [ ] SEO meta tags
- [ ] Error boundary component
- [ ] Loading skeleton screens
- [ ] Commit: `feat(cean): phase8 - testing & polish`

**Acceptance Criteria:**
- 100+ component tests, 90%+ coverage
- 5+ E2E scenarios (Playwright)
- Dark mode toggle works perfectly
- i18n switching language OK
- Accessibility score: A (no errors)
- Lighthouse: 90+ performance, 95+ accessibility
- Build size < 500KB (bundle analyzer)
- `npm test` ALL PASS 🟢

**Resources:**
- Vitest / React Testing Library (meglévő)
- Playwright (meglévő)
- next-intl library (or i18next)
- axe-core package

---

## 📊 Timeline Gantt

```
Fázis 1 (Layout)          [===] (2 nap)        2/15-2/16
Fázis 2 (Chat)            [=====] (2-3 nap)    2/17-2/19
Fázis 3 (Workers)         [=====] (2-3 nap)    2/20-2/22
Fázis 4 (D1/R1)           [===] (1-2 nap)      2/23-2/24
Fázis 5 (Backend APIs)    [=====] (2-3 nap)    2/25-2/27
Fázis 6 (Orchestrator)    [===] (1-2 nap)      2/28 - 3/1
Fázis 7 (Metrics)         [===] (1-2 nap)      3/2-3/3
Fázis 8 (Testing)         [===] (1-2 nap)      3/4-3/5
─────────────────────────────────────────────────────────────
TOTAL: 14-16 munkanap (~3 hét)
TARGET COMPLETION: 2026-03-06
```

---

## 🎯 Critical Path

**Kritikus sorrendek (blocker relationships):**

```
Layout (Fázis 1) ──→ Chat (Fázis 2)
                 └──→ Workers (Fázis 3) ──→ D1/R1 (Fázis 4)

Backend APIs (Fázis 5) ──→ Orchestrator (Fázis 6) ──→ Metrics (Fázis 7)

Testing (Fázis 8) (depends on ALL)
```

**parallelizálható:** Fázisok 2-4 részben párhuzam futhatnak (layout done)

---

## 💰 Erőforrások & Költségvetés

| Item | Becsült | Notes |
|------|---------|-------|
| Frontend dev | 6-8 nap | Layout + Chat + UI components |
| Backend dev | 4-5 nap | API routes + Socket.IO handlers |
| Integration | 2-3 nap | Orchestrator + error handling |
| Testing | 2-3 nap | Unit + E2E + accessibility |
| **Total** | **14-18 nap** | ~3.5-4 hét (1 dev full-time) |
| UI mockup | 4 óra | (already in spec, ASCII art) |

**Cloudflare cost:** < $5/month (free tier + overage)

---

## 🔧 Szükséges Tools & Setup

```bash
# Friss npm packages
npm install recharts@^2.10
npm install next-intl@^3.0        # vagy i18next
npm install monaco-editor@^0.45    # opcionális JSON editor

# Cloudflare Wrangler (meglévő, de ellenőrizz)
npm list wrangler

# dev server already running on port 3000
# UI dev server on port 5173
npm run dev:ui

# Playwright (testing)
npx playwright install
```

---

## ✅ Definition of Done (per phase)

For alle fázisok:
- [ ] `npm run build` = 0 errors, 0 warnings
- [ ] `npm test` = ALL tests PASS (>90% coverage)
- [ ] Git commit dengan spec conformance
- [ ] Code review approved (if team)
- [ ] Docs updated (JSDoc comments)
- [ ] Live demo works on localhost:5173
- [ ] No console.error / console.log in prod code
- [ ] Uses logger.ts for all logging
- [ ] `.js` extensions on all imports

---

## 📝 Commit Messages Konvención

```
feat(cean-ui): phase1 - layout & navigation tabs
feat(cean-ui): phase2 - orchestrator chat interface
feat(cean-ui): phase3 - worker management & task queue
feat(cean-ui): phase4 - D1 & R1 database explorer
feat(cean-ui): phase5 - backend API routes & Socket.IO
feat(cean-ui): phase6 - orchestrator integration & task decompos
feat(cean-ui): phase7 - metrics dashboard & performance charts
feat(cean-ui): phase8 - testing, dark mode, i18n, accessibility
```

---

## 🚀 Go-Live Checklist

- [ ] All specs reviewed + approved
- [ ] Phase 1-8 completed
- [ ] `npm test` GREEN
- [ ] E2E tests running
- [ ] Accessibility audit passed
- [ ] Dark mode working
- [ ] i18n functional (hu + en)
- [ ] Performance baseline set
- [ ] Security reviewed (SQL injection, XSS, CSRF)
- [ ] Deployment script ready
- [ ] Monitoring/alerting configured
- [ ] User docs written
- [ ] Demo video recorded
- [ ] GitHub PR ready for merge

---

**Status:** `pending_approval` → Implementation can start immediately after approval.

**Next Step:** Phase 1 code scaffold → Start development.

---
