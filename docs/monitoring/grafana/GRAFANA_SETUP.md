# Grafana Setup Guide - CEAN Fleet Monitoring

## Overview

Ez a dokmentáció a Grafana dashboard-okat leírja, amelyeket a CEAN Fleet Monitoring rendszerhez konfiguráltunk.

## Dashboards

### 1. **Brunella CEAN - Fleet Monitoring** (`brunella-cean-fleet`)
- **Fájl:** `brunella-agents-overview.dashboard.json`
- **Célja:** Valós idejű monitorozás az Edge Worker Fleet-hez
- **Panelok:**
  - **Request Rate**: Kérések/másodperc az egész Fleet-hez
  - **Error Rate %**: Hiba százalékos arány (gauge, piros/sárga/zöld threshold)
  - **Latency Distribution**: p50/p95/p99 percentilisek (milliszekundum)
  - **Total Workers**: Összes worker szám (stat)
  - **Healthy Workers**: OK státuszú workerek (stat)
  - **Scaling Events**: Scale-up/down események (bar chart, 24h)
  - **Worker Status**: Legutóbbi 5 percben aktív worker-ek (table)

### 2. Agent-ek Monitoring (Future)
- Grafana panel template för Agent execution time, success rate, LLM token usage

## Prometheus Data Source

### Konfigurálás Grafana-ban:

1. **URL:** `http://localhost:9090` (local) vagy `http://prometheus:9090` (Docker)
2. **Auth:** None (default)
3. **Scrape Interval:** 15s (default)

### Elérhető Metrics:

```
# Fleet-level
fleet_workers_total{fleet_id="..."}
fleet_workers_healthy{fleet_id="..."}
fleet_requests_total{fleet_id="..."}
fleet_errors_total{fleet_id="..."}

# Worker-level
worker_latency_ms_bucket{fleet_id="...", worker_id="..."}
worker_cpu_usage{fleet_id="..."}
worker_memory_usage{fleet_id="..."}

# Scaling
scaling_events_total{fleet_id="...", event_type="scale_up|scale_down"}

# Archiving
cean_metrics_archive_records{fleet_id="..."}
```

## Import Dashboard JSON

### GUI módszer (Grafana Web):

1. Menj a **Dashboards** → **New** → **Import**
2. Paste az alábbi JSON path-ot vagy direktben a JSON-t:
   ```
   docs/monitoring/grafana/brunella-agents-overview.dashboard.json
   ```
3. Select Prometheus datasource: `prometheus`
4. Click **Import**

### Programmatic módszer (HTTP API):

```bash
curl -X POST http://localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAFANA_API_TOKEN" \
  -d @docs/monitoring/grafana/brunella-agents-overview.dashboard.json
```

## Template Variables (Filters)

### Flash Selector (Dynamic)

Dashboard támogat dinamikus Fleet-selection:
- **Variable name:** `fleet_id`
- **Query:** `label_values(fleet_workers_total, fleet_id)`
- **Refresh:** On dashboard load

### Time Range Selector

- **Default:** Last 6 hours
- **Options:** 6h, 24h, 7d

## Alert Rules (Future)

Javasolt alert-ek:

```
# 1. High error rate (> 5%)
alert: HighErrorRate
expr: (rate(fleet_errors_total[5m]) / rate(fleet_requests_total[5m])) * 100 > 5

# 2. Worker down
alert: WorkerDown
expr: fleet_workers_healthy < fleet_workers_total

# 3. High latency (p95 > 500ms)
alert: HighLatency
expr: histogram_quantile(0.95, rate(worker_latency_ms_bucket[5m])) > 500
```

## Integration with BAS UI

A Dashboard elérhető lesz az alábbi helyeken:

1. **CEAN Operations Center** - Monitoring tab
   - Komponens: `src/dashboard/components/fleet/MonitoringTab.tsx` (Future)
   - iFrame-ben beágyazva: Grafana dashboard URL

2. **Fleet Manager Dashboard** - Integrated metrics
   - Real-time data: WebSocket push-ből (Socket.IO)
   - Grafana: Background analytics & historical trends

## Development

### Metrics push (src/core/prometheus.ts):

```typescript
import prometheus from 'prom-client';

// Register metrics
export const fleetWorkerMetric = new prometheus.Gauge({
  name: 'fleet_workers_total',
  help: 'Total fleet workers',
  labelNames: ['fleet_id']
});

// Update periodically
fleetWorkerMetric.set({ fleet_id: 'fleet-1' }, activeWorkers);
```

### Archive to D1 (src/services/metricsArchiveService.ts):

Háromóránként (default) a hot metrics az **cean_metrics_archive** táblára kerülnek:

```sql
INSERT INTO cean_metrics_archive 
  (fleet_id, metric_name, metric_value, timestamp)
SELECT fleet_id, 'worker_count', fleet_workers_healthy, NOW()
FROM fleet_metrics;
```

## Troubleshooting

| Probléma | Megoldás |
|----------|----------|
| "No data" a panelökben | Prometheus-nak van-e adata? Check `/api/v1/targets` |
| Fleet dropdown üres | Nincsenek `fleet_workers_total` metrics! Hozzáadj egy fleet-et. |
| Latency p95 biboruló | A worker-nek lassú a válasza → Check worker logs |

## References

- [Prometheus Query Language](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Grafana Templating](https://grafana.com/docs/grafana/latest/features/templating/)
- [Histogram Quantiles](https://prometheus.io/docs/prometheus/latest/querying/functions/#histogram_quantile)
