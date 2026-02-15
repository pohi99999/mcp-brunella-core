# Phase C Components Catalog

## Backend Components

### 1. `src/core/prometheus.ts`
**Purpose:** Initialize and manage Prometheus metrics client

**Key Exports:**
```typescript
// Gauge metrics
export const fleetWorkersTotal: Gauge<{ fleet_id: string }>;
export const fleetWorkersHealthy: Gauge<{ fleet_id: string }>;

// Counter metrics
export const fleetRequestsTotal: Counter<{ fleet_id: string }>;
export const fleetErrorsTotal: Counter<{ fleet_id: string }>;
export const scalingEventsTotal: Counter<{ fleet_id: string; event_type: string }>;

// Histogram metric
export const workerLatencyMs: Histogram<{ fleet_id: string; percentile: string }>;

// Functions
export function recordMetric(
  fleetId: string, 
  metricName: string, 
  value: number, 
  labels?: Record<string, string>
): void;

export function getMetricsText(): string; // Prometheus text format
export function resetMetrics(): void;      // For testing
```

**Dependencies:** `prom-client`

**Examples:**
```typescript
// Record a request
fleetRequestsTotal.labels({fleet_id: 'prod'}).inc();

// Record error
fleetErrorsTotal.labels({fleet_id: 'prod'}).inc();

// Record latency
workerLatencyMs.labels({fleet_id: 'prod'}).observe(45);

// Record scaling event
scalingEventsTotal.labels({
  fleet_id: 'prod',
  event_type: 'scale_up'
}).inc();
```

---

### 2. `src/server/routes/prometheus.ts`
**Purpose:** HTTP endpoint for Prometheus scraping

**Endpoint:** `GET /metrics`

**Response:**
- Content-Type: `text/plain; version=0.0.4; charset=utf-8`
- Body: Prometheus text format (see spec)
- Status: 200 OK
- Response time: < 50ms

**Implementation:**
```typescript
import { Router, Response } from 'express';
import { getMetricsText } from '../../core/prometheus.js';

const router = Router();

router.get('/metrics', (req, res: Response) => {
  try {
    const metrics = getMetricsText();
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(metrics);
  } catch (error) {
    res.status(500).send('Error generating metrics');
  }
});

export default router;
```

---

### 3. `src/services/metricsArchiveService.ts`
**Purpose:** Store metrics in D1 for historical analysis

**Key Functions:**
```typescript
export async function archiveMetric(
  timestamp: string,
  fleetId: string,
  metricName: string,
  metricValue: number,
  labels?: Record<string, unknown>
): Promise<void>;

export async function getMetricsHistory(
  fleetId: string,
  startTime: string,
  endTime: string,
  metricName?: string
): Promise<MetricRecord[]>;

export async function deleteOldMetrics(daysToKeep: number = 30): Promise<number>;
```

**Types:**
```typescript
interface MetricRecord {
  timestamp: string;
  fleet_id: string;
  metric_name: string;
  metric_value: number;
  labels?: Record<string, unknown>;
}
```

**Database Schema:**
```sql
CREATE TABLE metrics_archive (
  id INTEGER PRIMARY KEY,
  timestamp TEXT NOT NULL,
  fleet_id TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  labels TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_metrics_fleet_time 
  ON metrics_archive(fleet_id, timestamp DESC);
```

---

### 4. Updated: `src/services/metricsService.ts`
**New Method:**
```typescript
export async function getMetricsSnapshot(): Promise<MetricsSnapshot> {
  // Aggregate current metrics from Prometheus + D1
  return {
    timestamp: new Date().toISOString(),
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
  };
}

interface MetricsSnapshot {
  timestamp: string;
  fleets: FleetMetricsSnapshot[];
}

interface FleetMetricsSnapshot {
  fleet_id: string;
  worker_count: number;
  healthy_workers: number;
  error_rate: number;
  rps: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
  scaling_status: 'stable' | 'scaling_up' | 'scaling_down';
  last_scaling_event: string | null;
}
```

---

### 5. Updated: `src/server/websocket.ts`
**New Event Handler:**
```typescript
// Emit metrics snapshot every 10 seconds
const metricsInterval = setInterval(async () => {
  try {
    const snapshot = await getMetricsSnapshot();
    io.emit('metrics_snapshot', snapshot);
  } catch (error) {
    logger.error('Failed to emit metrics_snapshot', error);
  }
}, 10000);

io.on('disconnect', () => {
  if (connectedClients === 0) {
    clearInterval(metricsInterval);
  }
});
```

---

## Frontend Components

### 1. `src/dashboard/components/monitoring/PrometheusMonitor.tsx`
**Purpose:** Main monitoring dashboard component

**Props:** None (uses context/hooks)

**State Management:**
- `useMetricsSnapshot()` - WebSocket listener
- Local state for chart data history

**Sub-components rendered:**
- MetricsOverview
- RequestRateChart
- ErrorRateChart
- LatencyDistributionChart
- ScalingEventsTimeline
- WorkerStatusGrid

**Features:**
- Auto-refresh every 10 seconds (WebSocket)
- Fleet filter dropdown
- Time range selector
- Export metrics (CSV)

---

### 2. `src/dashboard/components/monitoring/MetricsOverview.tsx`
**Purpose:** Display key metrics as stat cards

**Props:**
```typescript
interface MetricsOverviewProps {
  metricsSnapshot: MetricsSnapshot;
  fleetId?: string;
}
```

**Displays:**
- Total Workers (number)
- Healthy Workers (number, green if healthy_workers/worker_count > 95%)
- Error Rate (%, red if > 5%, yellow if > 1%)
- Requests/Sec (number, sparkline showing trend)
- Latency p95 (ms)

---

### 3. `src/dashboard/components/monitoring/RequestRateChart.tsx`
**Purpose:** Time-series chart of request rate

**Library:** Recharts

**X-Axis:** Time (5-minute intervals)
**Y-Axis:** Requests/second

**Data Source:** WebSocket `metrics_snapshot` x N points

**Features:**
- Hover tooltip (timestamp, RPS)
- Legend (fleet names)
- Multi-fleet overlay

---

### 4. `src/dashboard/components/monitoring/ErrorRateChart.tsx`
**Purpose:** Error rate over time

**Library:** Recharts

**Y-Axis:** Error rate (%)

**Color Coding:**
- Green: < 1%
- Yellow: 1-5%
- Red: > 5%

**Alert:** Display red banner if error rate > 5% for last 5 points

---

### 5. `src/dashboard/components/monitoring/LatencyDistributionChart.tsx`
**Purpose:** Show p50, p95, p99 latencies

**Chart Type:** Area chart or box plot

**Data:** Latest 20 snapshots

**Lines:**
- p50 latency
- p95 latency
- p99 latency

**Threshold Lines:**
- p95 > 500ms = alert

---

### 6. `src/dashboard/components/monitoring/ScalingEventsTimeline.tsx`
**Purpose:** Timeline of scaling events

**Chart Type:** Bar chart (vertical)

**X-Axis:** Time

**Bars:** Scaling events (color: up=blue, down=orange, failed=red)

**Hover Info:**
- Event type
- Trigger reason (latency threshold, error rate threshold)
- Workers before/after

---

### 7. `src/dashboard/components/monitoring/WorkerStatusGrid.tsx`
**Purpose:** Table of worker health

**Columns:**
- Worker ID
- Fleet
- Status (active/paused/error)
- Latency p95
- Error Rate
- Last Heartbeat

**Features:**
- Sortable columns
- Filter by status
- Color rows by health (green/yellow/red)

---

### 8. `src/dashboard/hooks/useMetricsSnapshot.ts`
**Purpose:** Hook to listen to WebSocket metrics_snapshot events

**Implementation:**
```typescript
export function useMetricsSnapshot() {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socket = useCEANSocket(); // Existing hook

  useEffect(() => {
    if (!socket) return;

    socket.on('metrics_snapshot', (snapshot: MetricsSnapshot) => {
      setMetrics(snapshot);
      setLoading(false);
    });

    socket.on('error', (err) => {
      setError(err.message);
    });

    return () => {
      socket.off('metrics_snapshot');
      socket.off('error');
    };
  }, [socket]);

  return { metrics, loading, error };
}
```

**Returns:**
```typescript
interface UseMetricsSnapshotReturn {
  metrics: MetricsSnapshot | null;
  loading: boolean;
  error: string | null;
}
```

---

## Documentation Files

### `docs/monitoring/prometheus-setup.md`
**Content:**
- How to install + run Prometheus locally
- Config file example
- `prometheus.yml` with Brunella scrape target
- How to verify metrics endpoint

---

### `docs/monitoring/grafana-setup.md`
**Content:**
- How to start Grafana Docker container
- How to add Prometheus data source
- How to import dashboard JSON
- Creating custom panels
- Setting up alerts

---

### `docs/monitoring/grafana/brunella-agents-overview.dashboard.json`
**Content:**
- Pre-built Grafana dashboard
- 6-8 panels configured
- Prometheus queries included
- Alert rules linked
- Supports multi-fleet view

---

## Test Files

### `test/prometheus.test.ts`
**Tests:**
- Metrics endpoint returns 200 + valid Prometheus format
- Each metric type is present (Gauge, Counter, Histogram)
- Response time < 100ms
- Reset metrics works

---

### `test/metricsWebSocket.test.ts`
**Tests:**
- metrics_snapshot event emitted every 10 seconds
- Data structure matches contract
- All fields present
- Emission stops when no clients connected

---

### `test/metricsArchive.test.ts`
**Tests:**
- Archive metric to D1
- Query metrics history
- Delete old metrics
- Index performance (query < 100ms for 30 days)

---

## Configuration

### Environment Variables
```env
# Prometheus
PROMETHEUS_METRICS_INTERVAL_MS=10000    # WebSocket push frequency
PROMETHEUS_SCRAPE_ENABLED=true          # Enable /metrics endpoint

# D1 Retention
METRICS_RETENTION_DAYS=30               # Keep metrics for 30 days
METRICS_CLEANUP_INTERVAL_MS=3600000     # Check every hour
```

### Default Values
- Metrics push interval: 10 seconds
- D1 retention: 30 days
- Prometheus scrape interval (external): 15 seconds
- Retention query frequency: 1 hour
