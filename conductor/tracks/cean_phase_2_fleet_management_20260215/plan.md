# CEAN Phase 2: Worker Fleet Management - PLAN
**Status:** pending_approval  
**Date:** 2026-02-15

---

## 📋 IMPLEMENTÁCIÓS LÉPÉSEK

### **SPRINT 1: Database & Backend API (3-4 nap)**

#### **1.1 Database Schema Update** (0.5 nap)
- [ ] Update `myai/agents/workers/schema/d1_schema.sql`
  - [ ] CREATE TABLE fleets
  - [ ] CREATE TABLE workers
  - [ ] CREATE TABLE scaling_events
  - [ ] CREATE TABLE metrics_cache
  - [ ] Indexek a performance-hez (fleet_id, worker_id, timestamp)
- [ ] Test: `npm test` - schema validation
- [ ] Commit: `feat(cean): D1 schema - Fleet management tables`

#### **1.2 Backend API Routes** (2 napok)
- [ ] Create `src/server/routes/fleet.ts`
  - [ ] POST /api/fleet/create
  - [ ] GET /api/fleet/list
  - [ ] GET /api/fleet/:id
  - [ ] PUT /api/fleet/:id
  - [ ] DELETE /api/fleet/:id
- [ ] Create `src/server/routes/workers.ts`
  - [ ] POST /api/fleet/:fleetId/workers/add
  - [ ] GET /api/fleet/:fleetId/workers
  - [ ] PUT /api/fleet/:fleetId/workers/:workerId/status
  - [ ] DELETE /api/fleet/:fleetId/workers/:workerId
- [ ] Create `src/server/routes/metrics.ts`
  - [ ] GET /api/metrics/:workerId/latest
  - [ ] GET /api/metrics/:workerId/range
  - [ ] GET /api/metrics/fleet/:fleetId/summary
  - [ ] POST /api/metrics/prometheus/scrape (metrics collection)
- [ ] Create `src/server/routes/scaling.ts`
  - [ ] GET /api/scaling/policies
  - [ ] PUT /api/scaling/policies
  - [ ] GET /api/scaling/history/:fleetId
  - [ ] POST /api/scaling/trigger

#### **1.3 Router Registration** (0.5 nap)
- [ ] Update `src/server/web.ts`
  - [ ] Import fleetRouter, workersRouter, metricsRouter, scalingRouter
  - [ ] Register all routers
- [ ] Test: `npm run build`
- [ ] Commit: `feat(cean): Backend API routes - Fleet management (CRUD)`

#### **1.4 Backend Service Logic** (1 nap)
- [ ] Create `src/services/fleetService.ts`
  - [ ] Fleet CRUD operations
  - [ ] Worker CRUD operations
  - [ ] Fleet health status calculation
- [ ] Create `src/services/metricsService.ts`
  - [ ] Fetch metrics from Cloudflare API
  - [ ] Cache metrics to D1
  - [ ] Aggregate fleet-level metrics
- [ ] Create `src/services/scalingService.ts`
  - [ ] Check scaling policies
  - [ ] Calculate auto-scale decisions
  - [ ] Execute scale-up/scale-down

#### **1.5 Testing** (0.5 nap)
- [ ] Create `test/fleet.test.ts` - API route tests
- [ ] Create `test/metricsService.test.ts` - Service logic tests
- [ ] Create `test/scaling.test.ts` - Auto-scaling logic tests
- [ ] All tests pass: `npm test`

---

### **SPRINT 2: Frontend Dashboard (2-3 nap)**

#### **2.1 React Components Structure** (1 nap)
- [ ] Create `src/dashboard/pages/FleetManager.tsx` (main page)
- [ ] Create `src/dashboard/components/fleet/FleetOverview.tsx`
  - [ ] Grid list of fleets
  - [ ] Health status indicators
  - [ ] Quick actions (scale, pause)
- [ ] Create `src/dashboard/components/fleet/MetricsDashboard.tsx`
  - [ ] Latency p50/p95/p99 chart (Recharts)
  - [ ] Error rate gauge
  - [ ] Request volume (RPS) line chart
  - [ ] Geographic heat map
- [ ] Create `src/dashboard/components/fleet/WorkerDetails.tsx`
  - [ ] Worker list with status
  - [ ] Individual worker actions
  - [ ] Worker logs viewer
- [ ] Create `src/dashboard/components/fleet/ScalingConfig.tsx`
  - [ ] Policy editor form
  - [ ] Threshold sliders
  - [ ] Scaling history timeline

#### **2.2 Hooks & Context** (0.5 nap)
- [ ] Create `src/dashboard/components/fleet/hooks/useFleet.ts`
  - [ ] Fetch fleet data
  - [ ] Real-time updates via Socket.IO
- [ ] Create `src/dashboard/components/fleet/hooks/useMetrics.ts`
  - [ ] Fetch metrics from `/api/metrics/...`
  - [ ] Auto-refresh (5s interval)
- [ ] Create `src/dashboard/components/fleet/hooks/useScaling.ts`
  - [ ] Fetch scaling policies
  - [ ] Handle scale triggers

#### **2.3 Integration to Dashboard** (0.5 nap)
- [ ] Update `src/dashboard/components/dashboard/MissionControlLayout.tsx`
  - [ ] Add "Fleet Manager" to SIDEBAR_ITEMS
  - [ ] Add render logic: `{activeTab === "fleet" && <FleetManager />}`
- [ ] Vite alias check: @/utils, @/components, @/lib
- [ ] Test: `npm run build && npm run dev:ui`

#### **2.4 Socket.IO Integration** (0.5 nap)
- [ ] Update `src/server/websocket.ts`
  - [ ] Event: "fleet_scaled" (when auto-scaling happens)
  - [ ] Event: "worker_status_changed"
  - [ ] Event: "metrics_updated"
- [ ] Update `src/dashboard/components/fleet/hooks/useFleet.ts`
  - [ ] Listen for WebSocket updates
  - [ ] Re-render on changes

---

### **SPRINT 3: Prometheus & Monitoring (2 nap)**

#### **3.1 Prometheus Server Setup** (0.5 nap)
- [ ] Docker image: `prom/prometheus`
- [ ] Config file: `prometheus.yml`
  - [ ] Scrape config: target = `localhost:3000/api/metrics/prometheus/scrape`
  - [ ] Interval: 5 minutes
- [ ] docker-compose.yml update

#### **3.2 Metrics Collection** (1 nap)
- [ ] Implement `src/services/metricsService.ts`
  - [ ] Query Prometheus HTTP API
  - [ ] Parse response
  - [ ] Cache to D1
- [ ] Create `/api/metrics/prometheus/scrape` handler
  - [ ] Return Prometheus format
- [ ] Create test data generator (dev mode)
  - [ ] Simulate worker metrics
  - [ ] Inject into Prometheus

#### **3.3 Dashboard Metrics Visualization** (0.5 nap)
- [ ] Install Recharts: `npm install recharts`
- [ ] MetricsDashboard.tsx components:
  - [ ] AreaChart - Latency trend
  - [ ] BarChart - Error rate
  - [ ] LineChart - RPS
  - [ ] ComposedChart - Combined view

---

### **SPRINT 4: Auto-scaling Engine** (1.5 nap)

#### **4.1 Scaling Logic** (1 nap)
- [ ] Implement `src/services/scalingService.ts`
  - [ ] Check policies every 5 minutes
  - [ ] Calculate metrics averages
  - [ ] Determine scale-up/down decision
  - [ ] Record scaling event to D1
- [ ] Auto-scaling rules:
  - [ ] Scale-up: (latency_p95 > 500ms OR error_rate > 5%) AND inactive_count < max
  - [ ] Scale-down: (latency_p95 < 100ms AND error_rate < 1%) for 5+ min avg
  - [ ] Cooldown: 5 min between scaling events

#### **4.2 Integration to Orchestrator** (0.5 nap)
- [ ] Add to `src/agents/orchestratorAgent.ts`
  - [ ] Regular task: "check fleet scaling" (every 5 min)
  - [ ] Task: "scale up fleet X" (manual trigger)
  - [ ] Task: "scale down fleet X" (manual trigger)
- [ ] Emit Socket.IO events for UI updates

---

### **SPRINT 5: Testing & Documentation** (1.5 nap)

#### **5.1 End-to-End Tests** (1 nap)
- [ ] Create `test/fleet.e2e.test.ts`
  - [ ] Create fleet
  - [ ] Add workers
  - [ ] Generate metrics
  - [ ] Check auto-scaling
  - [ ] Verify D1 records
- [ ] Create `test/metrics.e2e.test.ts`
  - [ ] Fetch metrics
  - [ ] Cache to D1
  - [ ] Verify Prometheus format

#### **5.2 Documentation** (0.5 nap)
- [ ] Create `docs/FLEET_MANAGER_GUIDE.md`
  - [ ] Quick start
  - [ ] Fleet creation workflow
  - [ ] Monitoring dashboard usage
  - [ ] Auto-scaling configuration
  - [ ] Troubleshooting
- [ ] Create `docs/PROMETHEUS_SETUP.md`
  - [ ] Installation
  - [ ] Configuration
  - [ ] Query examples
- [ ] Update conductor/tracks.md with completion status

---

## 🎯 MILESTONES

| Milestone | Target Date | Owner |
|-----------|-------------|-------|
| Database Schema | Feb 16 | DeveloperAgent |
| Backend API | Feb 17-18 | DeveloperAgent |
| Frontend Components | Feb 19-20 | DeveloperAgent |
| Prometheus Integration | Feb 21 | DeveloperAgent |
| Auto-scaling Engine | Feb 21-22 | DeveloperAgent |
| Testing & Docs | Feb 22-23 | DeveloperAgent |
| **PHASE 2 COMPLETE** | **Feb 23** | ✅ |

---

## 🚀 QUICK START FOR DEVELOPERS

```bash
# 1. Database
npm run build
# Update D1 schema via Cloudflare CLI

# 2. Backend API (run parallel)
npm run dev

# 3. Frontend Dev Server (run parallel)
npm run dev:ui

# 4. Prometheus (Docker)
docker-compose up prometheus

# 5. Testing
npm test -- test/fleet.test.ts
npm test -- test/metrics.test.ts
npm test -- test/fleet.e2e.test.ts
```

---

## 💡 NOTES

- **Reuse:** Chatty, websocket.ts, és wranglerHelper.ts kódok már léteznek
- **Prometheus query:** PromQL támogatást ajánlott hozzáadni a jövőben
- **Load Testing:** Artillery vagy k6 ajánlott a skálázás validation-hez
- **Monitoring:** Grafana dashboard is ajánlott a Phase 3-ban
