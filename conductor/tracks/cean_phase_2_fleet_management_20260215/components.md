# CEAN Phase 2: React Components Catalog
**Date:** 2026-02-15  
**Structure:** TypeScript + Tailwind CSS v4 + Radix UI v2

---

## 📁 DIRECTORY STRUCTURE

```
src/dashboard/
├── pages/
│   ├── FleetManager.tsx                    [Main page entry]
│   └── (routes handled in MissionControlLayout)
│
├── components/
│   └── fleet/
│       ├── FleetOverview.tsx               [Fleet grid + status]
│       ├── MetricsDashboard.tsx            [Charts: latency, errors, RPS]
│       ├── WorkerDetails.tsx               [Worker list + actions]
│       ├── ScalingConfig.tsx               [Policy editor]
│       ├── types.ts                        [Shared types]
│       ├── utils/
│       │   └── constants.ts                [Labels, colors, thresholds]
│       └── hooks/
│           ├── useFleet.ts                 [Fleet CRUD + WebSocket]
│           ├── useMetrics.ts               [Metrics fetch + polling]
│           └── useScaling.ts               [Scaling policies]
│
└── lib/
    └── apiService.ts                       [API client functions]
```

---

## 🧩 COMPONENT SPECIFICATIONS

### **1. FleetManager.tsx (Main Page)**

**Props:** None (top-level)

**State:**
```typescript
- selectedFleetId: string | null
- activeTab: "overview" | "metrics" | "workers" | "scaling"
- isLoading: boolean
```

**Structure:**
```tsx
<div className="min-h-screen bg-white dark:bg-slate-950">
  {/* Header */}
  <header className="border-b p-6">
    <h1>🔷 Fleet Manager</h1>
    <p className="text-sm text-gray-600">Worker fleet orchestration & monitoring</p>
  </header>

  {/* Main Content */}
  <main className="p-6">
    {/* Tab Navigation */}
    <div className="flex gap-2 mb-6">
      <TabButton active={activeTab === "overview"}>Overview</TabButton>
      <TabButton active={activeTab === "metrics"}>Metrics</TabButton>
      <TabButton active={activeTab === "workers"}>Workers</TabButton>
      <TabButton active={activeTab === "scaling"}>Auto-scaling</TabButton>
    </div>

    {/* Tab Content */}
    {activeTab === "overview" && <FleetOverview />}
    {activeTab === "metrics" && <MetricsDashboard fleetId={selectedFleetId} />}
    {activeTab === "workers" && <WorkerDetails fleetId={selectedFleetId} />}
    {activeTab === "scaling" && <ScalingConfig fleetId={selectedFleetId} />}
  </main>
</div>
```

**Interactions:**
- Tab selection → update activeTab state
- Fleet selection → update selectedFleetId
- Button clicks → delegate to child components

---

### **2. FleetOverview.tsx (Fleet Grid)**

**Props:**
```typescript
interface FleetOverviewProps {
  onSelectFleet?: (fleetId: string) => void;
  onScaleClicked?: (fleetId: string) => void;
}
```

**State:**
```typescript
- fleets: Fleet[]
- isLoading: boolean
- error: string | null
```

**Hook Usage:**
```typescript
const { fleets, isLoading, error, createFleet, deleteFleet } = useFleet();
```

**Component Structure:**
```tsx
<div className="space-y-6">
  {/* Create Fleet Button */}
  <div className="flex gap-2">
    <button onClick={() => setShowCreateDialog(true)}>
      + Create Fleet
    </button>
  </div>

  {/* Fleet Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {fleets.map(fleet => (
      <Card key={fleet.id} onClick={() => onSelectFleet(fleet.id)}>
        <CardHeader>
          <div className="flex justify-between items-start">
            <h3 className="font-semibold">{fleet.name}</h3>
            <Badge>{fleet.environment}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Health Indicator */}
          <div className="space-y-2">
            <div>Status: <StatusDot status={fleet.status} /> {fleet.status}</div>
            <div>Workers: {fleet.workerCount}</div>
            <div>Avg Latency: {fleet.avgLatency}ms</div>
            <div>Error Rate: {fleet.errorRate}%</div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2 mt-4">
            <button onClick={() => handleScaleUp(fleet.id)}>Scale Up</button>
            <button onClick={() => handlePause(fleet.id)}>Pause</button>
            <button onClick={() => handleDelete(fleet.id)}>Delete</button>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>

  {/* Create Fleet Dialog */}
  {showCreateDialog && <CreateFleetDialog onClose={...} />}
</div>
```

**Key Features:**
- ✅ Real-time health status indicators (green/yellow/red dots)
- ✅ Quick action buttons (scale, pause, delete)
- ✅ Fleet card with environment badge
- ✅ Responsive grid layout

---

### **3. MetricsDashboard.tsx (Charts)**

**Props:**
```typescript
interface MetricsDashboardProps {
  fleetId?: string;  // If null, show all fleets
}
```

**Dependencies:**
```typescript
import { LineChart, AreaChart, BarChart, ComposedChart } from 'recharts';
import { useMetrics } from './hooks/useMetrics';
```

**Component Structure:**
```tsx
<div className="space-y-6">
  {/* Time Range Selector */}
  <div className="flex gap-2">
    <button onClick={() => setRange("1h")}>1H</button>
    <button onClick={() => setRange("6h")}>6H</button>
    <button onClick={() => setRange("24h")}>24H</button>
  </div>

  {/* Metrics Grid */}
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
    {/* 1. Latency Trends */}
    <Card>
      <CardHeader>Latency (ms)</CardHeader>
      <CardContent>
        <ComposedChart data={latencyData}>
          <CartesianGrid />
          <XAxis />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="p50" stroke="#3b82f6" />
          <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={2} />
          <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={2} />
        </ComposedChart>
      </CardContent>
    </Card>

    {/* 2. Error Rate & RPS */}
    <Card>
      <CardHeader>Request Metrics</CardHeader>
      <CardContent>
        <ComposedChart data={requestData}>
          <CartesianGrid />
          <XAxis />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip />
          <Legend />
          <Area yAxisId="left" type="monotone" dataKey="rps" fill="#dbeafe" stroke="#3b82f6" />
          <Bar yAxisId="right" dataKey="errorRate" fill="#fee2e2" />
        </ComposedChart>
      </CardContent>
    </Card>

    {/* 3. Geographic Distribution */}
    <Card className="lg:col-span-2">
      <CardHeader>Edge Location Distribution</CardHeader>
      <CardContent>
        <BarChart data={geoData} layout="vertical">
          <CartesianGrid />
          <XAxis type="number" />
          <YAxis type="category" dataKey="location" />
          <Tooltip />
          <Bar dataKey="requestCount" fill="#8b5cf6" />
        </BarChart>
      </CardContent>
    </Card>

    {/* 4. Key Metrics Summary */}
    <Card className="lg:col-span-2">
      <CardHeader>Summary</CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Metric label="Avg Latency" value={avg95Latency + "ms"} trend="↓ 3%" />
          <Metric label="Error Rate" value={errorRate + "%"} trend="↓ 1.2%" />
          <Metric label="Total RPS" value={totalRps} trend="↑ 12%" />
          <Metric label="Active Workers" value={activeWorkerCount} status="healthy" />
        </div>
      </CardContent>
    </Card>
  </div>
</div>
```

**Hook Usage:**
```typescript
const { metrics, isLoading, error, refetch } = useMetrics(fleetId, timeRange);
```

**Key Charts:**
- ✅ Line chart: p50, p95, p99 latency trends
- ✅ Composed chart: RPS vs error rate
- ✅ Bar chart: Geographic distribution
- ✅ Summary cards: Key metrics at a glance

---

### **4. WorkerDetails.tsx (Worker List)**

**Props:**
```typescript
interface WorkerDetailsProps {
  fleetId: string;
}
```

**Component Structure:**
```tsx
<div className="space-y-6">
  {/* Add Worker Button */}
  <button onClick={() => setShowAddDialog(true)}>
    + Add Worker to Fleet
  </button>

  {/* Workers Table */}
  <table className="w-full border-collapse">
    <thead>
      <tr className="border-b">
        <th>Worker ID</th>
        <th>URL</th>
        <th>Status</th>
        <th>Latency</th>
        <th>Error Rate</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody>
      {workers.map(worker => (
        <tr key={worker.id} className="border-b hover:bg-gray-50">
          <td className="font-mono text-sm">{worker.id}</td>
          <td className="text-blue-600 hover:underline cursor-pointer">{worker.url}</td>
          <td>
            <StatusDot status={worker.status} />
            {worker.status}
          </td>
          <td>{worker.latency}ms</td>
          <td>{worker.errorRate}%</td>
          <td className="flex gap-2">
            <button onClick={() => handleRestart(worker.id)}>Restart</button>
            <button onClick={() => handleDrain(worker.id)}>Drain</button>
            <button onClick={() => handleDelete(worker.id)}>Remove</button>
            <button onClick={() => setSelectedWorker(worker)}>Details</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  {/* Worker Logs Modal */}
  {selectedWorker && (
    <WorkerLogsModal worker={selectedWorker} onClose={() => setSelectedWorker(null)} />
  )}

  {/* Add Worker Dialog */}
  {showAddDialog && <AddWorkerDialog onClose={...} />}
</div>
```

**Key Features:**
- ✅ Worker list with real-time status
- ✅ Action buttons: restart, drain, delete
- ✅ Worker logs viewer (click "Details")
- ✅ Add worker dialog

---

### **5. ScalingConfig.tsx (Auto-scaling Policy)**

**Props:**
```typescript
interface ScalingConfigProps {
  fleetId: string;
}
```

**Component Structure:**
```tsx
<div className="space-y-6 max-w-2xl">
  {/* Current Policy */}
  <Card>
    <CardHeader>Auto-scaling Policy</CardHeader>
    <CardContent className="space-y-4">
      <div>
        <label>Scale-up Trigger</label>
        <div className="space-y-2">
          <Slider
            label="Latency Threshold (ms)"
            value={policy.scaleUpLatency}
            onChange={(v) => handlePolicyUpdate("scaleUpLatency", v)}
            min={100}
            max={2000}
          />
          <p className="text-xs text-gray-600">
            Scale up when p95 latency exceeds {policy.scaleUpLatency}ms
          </p>
        </div>

        <div className="space-y-2 mt-4">
          <Slider
            label="Error Rate Threshold (%)"
            value={policy.scaleUpErrorRate}
            onChange={(v) => handlePolicyUpdate("scaleUpErrorRate", v)}
            min={1}
            max={20}
          />
          <p className="text-xs text-gray-600">
            Scale up when error rate exceeds {policy.scaleUpErrorRate}%
          </p>
        </div>

        <div className="space-y-2 mt-4">
          <input
            type="number"
            min="1"
            max="10"
            value={policy.scaleUpInstances}
            onChange={(e) => handlePolicyUpdate("scaleUpInstances", parseInt(e.target.value))}
            placeholder="How many instances to add"
          />
          <p className="text-xs text-gray-600">
            Add {policy.scaleUpInstances} worker instance(s) on scale-up
          </p>
        </div>
      </div>

      <Divider />

      <div>
        <label>Scale-down Trigger</label>
        <div className="space-y-2">
          <Slider
            label="Latency Threshold (ms)"
            value={policy.scaleDownLatency}
            onChange={(v) => handlePolicyUpdate("scaleDownLatency", v)}
            min={50}
            max={500}
          />
        </div>

        <div className="space-y-2 mt-4">
          <Slider
            label="Error Rate Threshold (%)"
            value={policy.scaleDownErrorRate}
            onChange={(v) => handlePolicyUpdate("scaleDownErrorRate", v)}
            min={0.1}
            max={5}
          />
        </div>

        <div className="space-y-2 mt-4">
          <Slider
            label="Duration (minutes)"
            value={policy.scaleDownDuration}
            onChange={(v) => handlePolicyUpdate("scaleDownDuration", v)}
            min={1}
            max={30}
          />
          <p className="text-xs text-gray-600">
            Scale down if good metrics for {policy.scaleDownDuration} minutes
          </p>
        </div>
      </div>

      <Divider />

      {/* Save Button */}
      <div className="flex gap-2">
        <button onClick={handleSavePolicy} className="bg-green-600 text-white px-4 py-2 rounded">
          💾 Save Policy
        </button>
        <button onClick={handleResetPolicy} className="bg-gray-300 px-4 py-2 rounded">
          ↩️ Reset
        </button>
      </div>
    </CardContent>
  </Card>

  {/* Scaling History */}
  <Card>
    <CardHeader>Scaling History</CardHeader>
    <CardContent>
      <div className="space-y-2">
        {scalingEvents.map(event => (
          <div key={event.id} className="flex justify-between text-sm border-b pb-2">
            <span>
              <strong>{event.eventType}</strong> - {event.reason}
            </span>
            <span className="text-gray-600">{formatTime(event.createdAt)}</span>
            <span>
              {event.instanceCountBefore} → {event.instanceCountAfter}
            </span>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
</div>
```

**Key Features:**
- ✅ Threshold sliders for scale-up/down
- ✅ Instance count configuration
- ✅ Duration setting for scale-down
- ✅ Save & reset policy
- ✅ Scaling history timeline

---

## 🎣 HOOKS SPECIFICATIONS

### **useFleet.ts**
```typescript
interface UseFleetReturn {
  fleets: Fleet[];
  selectedFleet: Fleet | null;
  isLoading: boolean;
  error: string | null;
  createFleet: (name: string, env: string) => Promise<void>;
  updateFleet: (id: string, data: Partial<Fleet>) => Promise<void>;
  deleteFleet: (id: string) => Promise<void>;
  selectFleet: (id: string) => void;
}
```

### **useMetrics.ts**
```typescript
interface UseMetricsReturn {
  metrics: Metrics[];
  isLoading: boolean;
  error: string | null;
  timeRange: "1h" | "6h" | "24h";
  setTimeRange: (range: TimeRange) => void;
  refetch: () => Promise<void>;
}
```

### **useScaling.ts**
```typescript
interface UseScalingReturn {
  policy: ScalingPolicy;
  events: ScalingEvent[];
  isLoading: boolean;
  updatePolicy: (policy: ScalingPolicy) => Promise<void>;
  manualTrigger: (action: "scale-up" | "scale-down") => Promise<void>;
}
```

---

## 🎨 STYLING GUIDELINES

- **Colors:**
  - Primary: `text-blue-600`, `bg-blue-50`
  - Success: `text-green-600`, `bg-green-50`
  - Error: `text-red-600`, `bg-red-50`
  - Warning: `text-amber-600`, `bg-amber-50`

- **Cards & Containers:**
  - `rounded-lg border border-gray-200 dark:border-gray-800`
  - `p-4 space-y-4`

- **Dark Mode:**
  - All components support `dark:` variants
  - Use `dark:bg-slate-900`, `dark:text-gray-100`

---

## 📦 TYPES DEFINITION (types.ts)

```typescript
interface Fleet {
  id: string;
  name: string;
  environment: "dev" | "staging" | "production";
  status: "active" | "paused" | "unhealthy";
  workerCount: number;
  avgLatency: number;
  errorRate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Worker {
  id: string;
  fleetId: string;
  name: string;
  url: string;
  cloudfareId: string;
  status: "active" | "paused" | "draining" | "removing";
  latency: number;
  errorRate: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Metrics {
  workerId: string;
  timestamp: Date;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  requestCount: number;
}

interface ScalingPolicy {
  fleetId: string;
  scaleUpLatency: number;    // ms threshold
  scaleUpErrorRate: number;  // % threshold
  scaleUpInstances: number;  // how many to add
  scaleDownLatency: number;
  scaleDownErrorRate: number;
  scaleDownDuration: number; // minutes to maintain good metrics
}

interface ScalingEvent {
  id: string;
  fleetId: string;
  eventType: "scale_up" | "scale_down" | "failed";
  reason: string;
  instanceCountBefore: number;
  instanceCountAfter: number;
  createdAt: Date;
}
```

---

## ✅ DEPENDENCIES

```json
{
  "recharts": "^2.10.0",
  "@radix-ui/react-slider": "^1.1.0",
  "@radix-ui/react-dialog": "^1.1.0",
  "socket.io-client": "^4.6.0"
}
```

All already or can be installed with `npm install`.

---

## 🚀 IMPLEMENTATION ORDER

1. **types.ts** - Type definitions first
2. **hooks/** - Hooks for data fetching
3. **FleetOverview.tsx** - Simplest grid component
4. **WorkerDetails.tsx** - Table component
5. **MetricsDashboard.tsx** - Charts (most complex)
6. **ScalingConfig.tsx** - Form component
7. **FleetManager.tsx** - Main page integration
8. **MissionControlLayout.tsx** - Dashboard integration
