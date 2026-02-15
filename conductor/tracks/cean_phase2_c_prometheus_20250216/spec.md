# CEAN Phase 2 Sprint 2 - Phase C: Prometheus Integration & Monitoring
**Status:** `pending_approval` → `approved` → `in_progress`

**Target:** Prometheus metrics collection, Grafana visualization, real-time WebSocket monitoring

---

## 🎯 Objectives

### 1. **Prometheus Metrics Collection**
- Collect worker fleet metrics (requests/sec, error rate, latency)
- Collect scaling events (scale up/down decisions)
- Collect health checks (worker availability, heartbeat)
- Expose `/metrics` endpoint (Prometheus scrape target)
- Store metrics in SQLite for archival + replay

### 2. **Grafana Dashboard**
- Pre-built dashboard JSON for Brunella Agents monitoring
- Fleet health overview (worker count, error rate, latency distribution)
- Scaling events timeline (triggers, auto-scaling decisions)
- Worker status heatmap (geo-location, response times)
- Alerts: high error rate, latency spike, scale failures

### 3. **Real-Time Monitoring (WebSocket)**
- Push Prometheus metrics to dashboard via Socket.IO
- Live worker status updates
- Metric refresh rate: 5-10 seconds (configurable)
- Dashboard auto-updates without polling

---

## 📐 Architecture

```
Worker Fleet (Cloudflare)
    ↓
Wrangler metric export (D1 table)
    ↓
Backend API: /metrics (Prometheus format)
    ↓
Prometheus Server (scrapes every 15s)
    ↓
Grafana Dashboard + Alerts
    ↓
WebSocket: metrics_snapshot event
    ↓
Frontend: Real-time chart updates
```

---

## 📋 Implementation Plan

### Phase C.1: Backend Prometheus Integration
- **prom-client** library for Node.js metrics
- Metrics types: Counter, Gauge, Histogram
- Endpoint: `GET /metrics` (Prometheus text format)
- Custom metrics:
  - `fleet_workers_total` (gauge)
  - `fleet_requests_total` (counter)
  - `fleet_errors_total` (counter)
  - `worker_latency_ms` (histogram)
  - `scaling_events_total` (counter)

### Phase C.2: D1 Schema Updates
- `metrics_archive` table (time-series data)
  - timestamp, fleet_id, metric_name, metric_value, labels (JSON)
- Index on (fleet_id, timestamp) for fast queries
- Retention: 30 days (auto-delete via cron)

### Phase C.3: Grafana Dashboard
- Pre-built JSON dashboard
- Panels:
  - Fleet Overview (stat cards)
  - Request Rate (time-series)
  - Error Rate (% + trend)
  - Latency Distribution (heatmap)
  - Scaling Events (timeline)
  - Worker Status Grid (geo-heatmap)

### Phase C.4: WebSocket Real-Time
- New event: `metrics_snapshot`
- Data: current fleet metrics aggregated
- Trigger: every 10 seconds (configurable)
- Frontend listens + updates charts

### Phase C.5: Frontend Monitoring Dashboard
- React component: `PrometheusMonitor.tsx`
- Sub-components:
  - MetricsOverview (stat cards)
  - RequestRateChart (time-series)
  - ErrorRateChart (% + alerts)
  - LatencyHeatmap (p50, p95, p99)
  - ScalingTimeline (events)
  - LiveWorkerStatus (grid with health)

---

## 🔌 API Contracts

### `/metrics` Endpoint (Prometheus format)
```text
# HELP fleet_workers_total Total workers in fleet
# TYPE fleet_workers_total gauge
fleet_workers_total{fleet_id="prod"} 24
fleet_workers_total{fleet_id="staging"} 8

# HELP fleet_requests_total Total requests processed
# TYPE fleet_requests_total counter
fleet_requests_total{fleet_id="prod"} 1250000

# HELP worker_latency_ms Worker response latency
# TYPE worker_latency_ms histogram
worker_latency_ms_bucket{fleet_id="prod",le="50"} 450000
worker_latency_ms_bucket{fleet_id="prod",le="100"} 890000
worker_latency_ms_bucket{fleet_id="prod",le="500"} 1200000
worker_latency_ms_bucket{fleet_id="prod",le="+Inf"} 1250000
worker_latency_ms_sum{fleet_id="prod"} 75000000
worker_latency_ms_count{fleet_id="prod"} 1250000
```

### WebSocket Event: `metrics_snapshot`
```typescript
{
  event: 'metrics_snapshot',
  timestamp: '2025-02-16T10:30:00Z',
  fleets: [
    {
      fleet_id: 'prod',
      worker_count: 24,
      healthy_workers: 22,
      error_rate: 0.15,
      rps: 1250,
      latency_p50: 45,
      latency_p95: 120,
      latency_p99: 250,
      scaling_status: 'stable',
      last_scaling_event: '2025-02-16T09:45:00Z'
    }
  ]
}
```

---

## 🛠️ Dependencies

- `prom-client` (v15+) - Prometheus metrics library
- Existing: Socket.IO, SQLite (D1), better-sqlite3

---

## ✅ Acceptance Criteria

1. **Prometheus**
   - ✅ `/metrics` endpoint returns valid Prometheus text format
   - ✅ Metrics update every 10 seconds
   - ✅ Can scrape with `curl http://localhost:3000/metrics`

2. **Grafana**
   - ✅ Dashboard JSON deployable to Grafana
   - ✅ All panels show real data from Prometheus
   - ✅ Supports multiple fleet filtering

3. **WebSocket**
   - ✅ `metrics_snapshot` event emitted every 10 seconds
   - ✅ Frontend receives + logs metrics in console
   - ✅ Latency < 100ms from backend to frontend

4. **D1 Storage**
   - ✅ Metrics archived to `metrics_archive` table
   - ✅ Query time-series: `SELECT * FROM metrics_archive WHERE fleet_id=? AND timestamp BETWEEN ? AND ?`
   - ✅ 30-day retention working

5. **Tests**
   - ✅ Prometheus endpoint returns 200 + valid format
   - ✅ WebSocket event includes all required fields
   - ✅ Metrics calculation accurate (realtime vs stored)

---

## 📅 Timeline

| Phase | Task | Duration |
|-------|------|----------|
| C.1 | Backend Prometheus + `/metrics` endpoint | 2-3h |
| C.2 | D1 schema + metric archival | 1-2h |
| C.3 | Grafana dashboard template JSON | 2-3h |
| C.4 | WebSocket `metrics_snapshot` event | 1-2h |
| C.5 | Frontend monitoring component | 3-4h |
| Testing | Integration tests + Prometheus scraping | 1-2h |
| **Total** | | **10-16h** |

---

## 🚀 Success Metrics

- ✅ Prometheus `/metrics` responds in < 50ms
- ✅ Grafana dashboard loads all panels < 2 seconds
- ✅ WebSocket metrics push latency < 100ms
- ✅ 100% test coverage for metrics collection
- ✅ Docs: Prometheus setup guide + Grafana import guide
