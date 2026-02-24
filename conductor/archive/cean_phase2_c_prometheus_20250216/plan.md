# Phase C Implementation Plan

## 📋 Detailed Tasks

### 🔵 Phase C.1: Backend Prometheus Integration (2-3h)

1. **Install prom-client**
   ```bash
   npm install prom-client
   ```

2. **Create `src/core/prometheus.ts`**
   - Initialize Prometheus client
   - Create metrics:
     - `fleet_workers_total` (Gauge)
     - `fleet_workers_healthy` (Gauge)
     - `fleet_requests_total` (Counter)
     - `fleet_errors_total` (Counter)
     - `worker_latency_ms` (Histogram, buckets: 10, 50, 100, 250, 500, 1000)
     - `scaling_events_total` (Counter)
   - Export function: `recordMetric(fleetId, metricName, value, labels?)`
   - Export function: `getMetricsText()` (Prometheus format)

3. **Create `src/server/routes/prometheus.ts`**
   - Route: `GET /metrics`
   - Return Prometheus text format
   - Cache for 5 seconds (avoid recalculation)

4. **Integrate with web.ts**
   - Register `/metrics` route
   - Add middleware to set Content-Type: text/plain

5. **Update fleet/metrics services**
   - Call `recordMetric()` after each operation
   - Record request count, error count, latency buckets

---

### 🔵 Phase C.2: D1 Schema Updates (1-2h)

1. **Update `myai/agents/workers/schema/d1_schema.sql`**
   ```sql
   CREATE TABLE IF NOT EXISTS metrics_archive (
     id INTEGER PRIMARY KEY,
     timestamp TEXT NOT NULL,
     fleet_id TEXT NOT NULL,
     metric_name TEXT NOT NULL,
     metric_value REAL NOT NULL,
     labels TEXT, -- JSON: {worker_id, region, status}
     created_at TEXT DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE INDEX idx_metrics_fleet_time 
     ON metrics_archive(fleet_id, timestamp DESC);
   ```

2. **Create retention migration**
   - Delete metrics older than 30 days
   - Run on server startup (or scheduled job)

3. **Create `src/services/metricsArchiveService.ts`**
   - Function: `archiveMetric(timestamp, fleetId, metricName, value, labels)`
   - Function: `getMetricsHistory(fleetId, startTime, endTime)`
   - Function: `deleteOldMetrics(daysToKeep)` (call on startup)

---

### 🟡 Phase C.3: Grafana Dashboard (2-3h)

1. **Create dashboard template: `docs/monitoring/grafana/brunella-agents-overview.dashboard.json`**
   - Import from existing dashboard or scaffold
   - Panels:
     1. **Fleet Overview** (Row)
        - Total Workers (Stat)
        - Healthy Workers (Stat)
        - Error Rate % (Stat with thresholds: green < 1%, yellow < 5%, red > 5%)
        - Requests/Sec (Stat, sparkline)
     
     2. **Metrics Over Time** (Row)
        - Request Rate (Graph, time-series)
        - Error Rate (Graph, stacked)
        - Latency Distribution (Graph, p50/p95/p99)
     
     3. **Scaling Events** (Row)
        - Scale Timeline (Bar chart, aggregated by hour)
        - Last Scaling Event (Stat with timestamp)
     
     4. **Worker Status** (Row)
        - Worker Health Grid (Table: worker_id, status, latency_p95, error_rate)
        - Active Workers Heatmap (geo-location map or grid)

2. **Create dashboard variables**
   - `fleet_id` (dropdown, from Prometheus labels)
   - `time_range` (default: last 6 hours)

3. **Create alert rules** (rules.yaml template)
   - High error rate (> 5% for 5 minutes)
   - High latency (p95 > 500ms for 5 minutes)
   - Scaling failures (scale events with status='failed')

---

### 🟡 Phase C.4: WebSocket Real-Time Metrics (1-2h)

1. **Update `src/server/websocket.ts`**
   - Add event handler: `metrics_snapshot`
   - Aggregate current metrics from Prometheus
   - Format response per API contract

2. **Update `src/services/metricsService.ts`**
   - Function: `getMetricsSnapshot()` → returns current fleet metrics
   - Called every 10 seconds (configurable via env var)

3. **Create scheduled job** (in web.ts)
   - Emit `metrics_snapshot` every 10 seconds
   - Use interval timer + Prometheus client
   - Error handling: log + continue

---

### 🟡 Phase C.5: Frontend Monitoring Dashboard (3-4h)

1. **Create `src/dashboard/components/monitoring/PrometheusMonitor.tsx`**
   - Main component for monitoring tab
   - Use hooks: `useMetricsSnapshot()` (WebSocket listener)
   - Render sub-components

2. **Create sub-components**
   - `MetricsOverview.tsx` (stat cards)
   - `RequestRateChart.tsx` (Recharts time-series)
   - `ErrorRateChart.tsx` (area chart)
   - `LatencyDistributionChart.tsx` (heatmap or box plot)
   - `ScalingEventsTimeline.tsx` (timeline/gantt)
   - `WorkerStatusGrid.tsx` (table)

3. **Create hook: `src/dashboard/hooks/useMetricsSnapshot.ts`**
   - Listen to WebSocket `metrics_snapshot` event
   - Store in state
   - Auto-update charts

4. **Integrate into dashboard**
   - Add "Monitoring" tab to MissionControlLayout sidebar
   - Route: `/monitoring` or tab in CEAN Operations Center

5. **Add charts library**
   - Use `recharts` for charts (already likely in deps)
   - OR simple Canvas/SVG for lightweight rendering

---

### 🟢 Testing (1-2h)

1. **Test `/metrics` endpoint**
   - `test/prometheus.test.ts`
   - Verify Prometheus text format
   - Check metrics values are realistic
   - Measure response time

2. **Test WebSocket metrics_snapshot**
   - `test/metricsWebSocket.test.ts`
   - Verify event is emitted
   - Verify data structure
   - Check emission frequency

3. **Test D1 archival**
   - `test/metricsArchive.test.ts`
   - Insert metrics
   - Query history
   - Verify retention

4. **Integration test**
   - Start server
   - Scrape `/metrics` with curl
   - Parse Prometheus format
   - Validate metrics present

---

## 📦 File Structure

```
src/
├── core/
│   └── prometheus.ts           [NEW] Prometheus client + metric defs
├── server/
│   ├── websocket.ts            [UPDATE] Add metrics_snapshot handler
│   ├── web.ts                  [UPDATE] Register /metrics route + scheduled job
│   └── routes/
│       └── prometheus.ts        [NEW] GET /metrics endpoint
├── services/
│   ├── metricsService.ts        [UPDATE] Add getMetricsSnapshot()
│   └── metricsArchiveService.ts [NEW] D1 archival logic
└── dashboard/
    ├── components/monitoring/
    │   ├── PrometheusMonitor.tsx [NEW] Main monitoring component
    │   ├── MetricsOverview.tsx
    │   ├── RequestRateChart.tsx
    │   ├── ErrorRateChart.tsx
    │   ├── LatencyDistributionChart.tsx
    │   ├── ScalingEventsTimeline.tsx
    │   └── WorkerStatusGrid.tsx
    └── hooks/
        └── useMetricsSnapshot.ts [NEW] WebSocket metrics listener

docs/
├── monitoring/
│   ├── prometheus-setup.md      [NEW] Prometheus config guide
│   ├── grafana-setup.md         [NEW] Grafana import guide
│   └── grafana/
│       └── brunella-agents-overview.dashboard.json [NEW]
└── monitoring/
    └── alert-rules.yaml         [NEW] Grafana alert rules

test/
├── prometheus.test.ts           [NEW]
├── metricsWebSocket.test.ts     [NEW]
└── metricsArchive.test.ts       [NEW]

myai/agents/workers/schema/
└── d1_schema.sql                [UPDATE] Add metrics_archive table
```

---

## 🎬 Execution Order

1. **Setup & Deps**
   - `npm install prom-client`
   - Update D1 schema

2. **Backend (C.1 + C.2)**
   - Implement Prometheus client
   - Create `/metrics` endpoint
   - Implement metrics archival

3. **Monitoring (C.4)**
   - Add WebSocket handler
   - Create scheduled metrics push

4. **Grafana (C.3)**
   - Create dashboard JSON
   - Create alert rules

5. **Frontend (C.5)**
   - Create monitoring components
   - Integrate into dashboard

6. **Testing**
   - Write + run all tests
   - Manual validation with curl + browser

---

## 🚀 Quick Start (After Implementation)

```bash
# 1. Build + test
npm run build && npm test

# 2. Start backend
npm run dev

# 3. Test Prometheus endpoint
curl http://localhost:3000/metrics

# 4. (Optional) Start Prometheus locally
# docker run -d --name prometheus -p 9090:9090 \
#   -v YOUR_PROMETHEUS_CONFIG:/etc/prometheus \
#   prom/prometheus

# 5. (Optional) Start Grafana
# docker run -d --name grafana -p 3001:3000 grafana/grafana

# 6. Import dashboard into Grafana
# - Open http://localhost:3001 (Grafana)
# - Menu > Dashboards > Import
# - Paste JSON from docs/monitoring/grafana/brunella-agents-overview.dashboard.json
# - Select Prometheus data source
```
