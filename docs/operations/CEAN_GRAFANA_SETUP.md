# CEAN Grafana Dashboard Setup Guide

## Overview
The CEAN Grafana Dashboard provides real-time monitoring of CEAN Orchestrator pipeline metrics.

**Dashboard Metrics:**
- Pipeline Execution Count (24h)
- Success Rate %
- Pipeline Latency (Average & P95)
- Cache Hit Rate %
- Estimated Daily Cost
- Worker Status

---

## Setup Instructions

### Step 1: Install Grafana
```bash
# Docker (Recommended)
docker run -d -p 3000:3000 --name grafana grafana/grafana

# Or download from https://grafana.com/grafana/download
```

### Step 2: Add Prometheus Data Source

1. **Access Grafana UI:**
   - Open: `http://localhost:3000`
   - Default login: `admin` / `admin`

2. **Add Data Source:**
   - Go to: Settings → Data Sources → Add Data Source
   - Select: **Prometheus**
   - Configure:
     - **Name:** `prometheus`
     - **URL:** `http://localhost:9090`
     - **Scrape Interval:** `15s`
   - Click: **Save & Test**

### Step 3: Configure Orchestrator Metrics Export

**Option A: Direct Prometheus Scrape**

Edit `/etc/prometheus/prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'cean-orchestrator'
    metrics_path: '/metrics'
    static_configs:
      - targets: ['https://cean-orchestrator.{account}.workers.dev']
```

**Option B: Cloudflare Analytics Engine (via Lambda/Edge)**

Deploy a Lambda function or Edge Worker that:
1. Fetches `/metrics` every 60 seconds
2. Pushes to Prometheus Pushgateway
3. Prometheus scrapes Pushgateway

Example setup in `myai/agents/workers/metrics-exporter/`:
```typescript
// Fetch metrics from CEAN Orchestrator
const response = await fetch('https://cean-orchestrator.{account}.workers.dev/metrics');
const prometheusText = await response.text();

// Push to Prometheus Pushgateway
await fetch('http://pushgateway:9091/metrics/job/cean/instance/orchestrator', {
  method: 'POST',
  body: prometheusText
});
```

### Step 4: Import Dashboard

1. **Via JSON Upload:**
   - Open Grafana → Dashboards
   - Click: + → Import
   - Paste content from `docs/CEAN_GRAFANA_DASHBOARD.json`
   - Select Data Source: `prometheus`
   - Click: **Import**

2. **Via Grafana Dashboard ID (if published):**
   - Open Grafana → Dashboards
   - Click: + → Import
   - Dashboard ID: [will be published]
   - Click: **Load**

### Step 5: Configure Alerts

Set up alert rules for:

```yaml
# Success Rate < 95%
- alert: CEANLowSuccessRate
  expr: cean_pipeline_success_rate < 95
  for: 5m
  annotations:
    title: "CEAN Pipeline Success Rate Low"
    summary: "Success rate dropped below 95%"

# High Latency
- alert: CEANHighLatency
  expr: cean_latency_ms{quantile="p95"} > 1000
  for: 5m
  annotations:
    title: "CEAN Pipeline Latency High"
    summary: "P95 latency exceeded 1 second"

# Pipeline Failures
- alert: CEANPipelineFailures
  expr: rate(cean_pipelines_failed[5m]) > 0.1
  for: 5m
  annotations:
    title: "CEAN Pipeline Failures Detected"
    summary: "More than 0.1 failures per second"
```

---

## Metrics Reference

### Prometheus Metrics Endpoint
**URL:** `GET https://cean-orchestrator.{account}.workers.dev/metrics`

**Format:** Prometheus text format (v0.0.4)

#### Available Metrics

| Metric | Type | Labels | Description |
|--------|------|--------|-------------|
| `cean_pipelines_total` | counter | `period="24h"` | Total pipelines executed |
| `cean_pipelines_completed` | counter | `period="24h"` | Completed pipelines |
| `cean_pipelines_failed` | counter | `period="24h"` | Failed pipelines |
| `cean_pipeline_success_rate` | gauge | `period="24h"` | Success % (0-100) |
| `cean_latency_ms` | histogram | `quantile={avg,p95,p99}` | Latency in ms |
| `cean_cache_hit_rate` | gauge | `component="agent"` | Cache effectiveness % |
| `cean_cache_hits_total` | counter | `period="24h"` | Total cache hits |
| `cean_d1_queries_total` | counter | `period="24h"` | D1 database queries |
| `cean_cost_usd` | gauge | `period="24h"` | Estimated daily cost |

---

## Querying Examples

### PromQL Queries for Custom Panels

```promql
# Success Rate Trend
cean_pipeline_success_rate{period="24h"}

# Request Latency Percentiles
histogram_quantile(0.95, rate(cean_latency_ms[5m]))

# Hourly Pipeline Count
rate(cean_pipelines_total[1h])

# Cache Effectiveness
cean_cache_hit_rate{component="agent"}

# Cost Projection (monthly from 24h avg)
cean_cost_usd * 30

# Failures per Minute
rate(cean_pipelines_failed[1m])
```

---

## Troubleshooting

### No Data in Dashboard

1. **Check Prometheus scrape:**
   ```bash
   # Verify metrics are accessible
   curl https://cean-orchestrator.{account}.workers.dev/metrics
   ```

2. **Check Prometheus targets:**
   - Open: `http://localhost:9090/targets`
   - Verify CEAN job is `UP` (green)

3. **Check Grafana data source:**
   - Settings → Data Sources → Prometheus → Save & Test

### Metrics Not Updating

- **Default refresh:** 30 seconds
- **Fastest update:** Modify `refresh` in dashboard JSON
- **Note:** Analytics Engine events ingestion is async (5-10s delay)

### Missing Cost Data

- Cost is calculated from `latency_ms` and inferred from Phase 4.2 analysis
- Actual costs may vary; baseline: ~$0.000118 per 100 pipelines
- For accurate costs, integrate Cloudflare Billing API

---

## Production Deployment

### High-Availability Setup

1. **Prometheus with Retention:**
   ```yaml
   # Store 30 days of metrics
   storage.tsdb.retention.time: 30d
   storage.tsdb.retention.size: 50GB
   ```

2. **Grafana Persistence:**
   - Use external PostgreSQL for dashboard storage
   - Configure backup strategy

3. **Alerting Integration:**
   - Grafana Alerting → Notification Channels
   - Configure: Slack, PagerDuty, Email, Webhook

### Cloudflare Analytics Engine Integration

Instead of Prometheus, export metrics directly to CAE:

```typescript
// In metrics.ts
export async function writeMetricsToCAE(
  cae: AnalyticsEngineDataset,
  metrics: MetricsData
): Promise<void> {
  cae.writeDataPoint({
    indexes: [metrics.timestamp, 'metrics'],
    blobs: [JSON.stringify(metrics)],
    doubles: [metrics.success_rate_pct],
  });
}
```

Then query via Cloudflare Dashboard → Analytics Engine.

---

## Next Steps
1. ✅ Setup metrics endpoint (`/metrics`)
2. ✅ Configure Prometheus scraping
3. ⏭️ [Phase 5.3] Setup alerting rules
4. ⏭️ [Phase 5.4] Create runbook documentation
