# CEAN Phase 2: Worker Fleet Management - SPEC
**Status:** pending_approval  
**Date:** 2026-02-15  
**Owner:** Brunella Agent System

---

## 🎯 CÉLOK

### **1. Worker Fleet Management (Erőforrás-Készlet Kezelés)**
A Cloudflare Workers-ből egy **logikai fleet-et** hozunk létre, ahol:
- 🔷 Worker készleteket lehet definiálni (dev, staging, production)
- 🔄 Redundancia kezelés (multiple workers per fleet)
- 📊 Fleet health status monitoring
- 🛠️ Individual worker lifecycle management (deploy/stop/restart)

### **2. Real-time Monitoring (Prometheus Metrics)**
Prometheus metrikák a munkavégzéshez:
- ⏱️ Worker response time (latency)
- 🔢 Request count per worker
- ❌ Error rate (4xx, 5xx)
- 💾 Worker memory usage
- 🌍 Geographic location tracking (Cloudflare edge locations)
- 🚨 Alert conditions (threshold breaches)

### **3. Auto-scaling (Dinamikus Deployment)**
Intelligens autoscaling logika:
- 📈 Horizontal scaling - több worker instance
- ⚡ Load balancing - request distribution
- 🔻 Auto-deprovision - kiadatlan workers törlése
- 📐 Scale-up trigger: avg latency > 500ms VAGY error rate > 5%
- 📉 Scale-down trigger: avg latency < 100ms AND error rate < 1% (5 min avg)

---

## 📐 ARCHITEKTÚRA

```
┌─────────────────────────────────────────────────────────────┐
│                   BRUNELLA DASHBOARD                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ 🔷 CEAN Fleet Manager                                 │  │
│  │  ├─ Fleet Overview                                    │  │
│  │  │  └─ List fleets (dev/staging/prod)               │  │
│  │  │     ├─ Health indicators                          │  │
│  │  │     └─ Quick actions (scale/pause)               │  │
│  │  ├─ Real-time Metrics [Prometheus]                  │  │
│  │  │  ├─ Latency chart (p50, p95, p99)               │  │
│  │  │  ├─ Error rate gauge                             │  │
│  │  │  ├─ Request volume (RPS)                         │  │
│  │  │  └─ Geographic heat map                          │  │
│  │  ├─ Worker Details                                   │  │
│  │  │  ├─ Individual worker logs                       │  │
│  │  │  ├─ Performance breakdown                        │  │
│  │  │  └─ Actions (restart/drain/remove)              │  │
│  │  └─ Auto-scaling Configuration                      │  │
│  │     ├─ Policy editor                                │  │
│  │     ├─ Threshold settings                           │  │
│  │     └─ Scaling history log                          │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
    ┌────▼──────┐      ┌─────▼──────┐      ┌────▼──────────┐
    │  BACKEND   │      │ PROMETHEUS │      │  CLOUDFLARE   │
    │  API       │      │  SERVER    │      │  API          │
    │            │      │            │      │               │
    │ /api/fleet/│      │ :9090      │      │ /api/workers/ │
    │ /api/      │      │            │      │               │
    │  metrics/  │      │ Scrape:    │      │ init          │
    │ /api/      │      │ Worker     │      │ list          │
    │  scaling/  │      │ metrics    │      │ logs          │
    │            │      │ endpoint   │      │ delete        │
    └────────────┘      └────────────┘      └───────────────┘
         │                    │                    │
         │                    │                    │
    ┌────▼──────────────────────────────────────────────┐
    │          SQLite Database (D1)                      │
    │  ┌──────────────────────────────────────────────┐ │
    │  │ Tables:                                       │ │
    │  │  - fleets (id, name, env, status)            │ │
    │  │  - workers (id, fleet_id, url, status)       │ │
    │  │  - scaling_events (timestamp, fleet, action) │ │
    │  │  - metrics_cache (worker_id, timestamp, json)│ │
    │  └──────────────────────────────────────────────┘ │
    └─────────────────────────────────────────────────────┘
```

---

## 🗄️ ADATMODELL

### **Fleets (Alkalmazott flották)**
```sql
CREATE TABLE fleets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  environment TEXT DEFAULT 'production',  -- dev, staging, production
  status TEXT DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **Workers (Egyéni worker instanciák)**
```sql
CREATE TABLE workers (
  id TEXT PRIMARY KEY,
  fleet_id TEXT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  cloudflare_id TEXT,
  status TEXT DEFAULT 'active',  -- active, paused, draining, removing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fleet_id) REFERENCES fleets(id)
);
```

### **Scaling Events (Autoscaling előzmények)**
```sql
CREATE TABLE scaling_events (
  id TEXT PRIMARY KEY,
  fleet_id TEXT,
  event_type TEXT,  -- scale_up, scale_down, failed
  reason TEXT,
  instance_count_before INT,
  instance_count_after INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (fleet_id) REFERENCES fleets(id)
);
```

### **Metrics Cache (Prometheus adatok gyorsítótár)**
```sql
CREATE TABLE metrics_cache (
  id TEXT PRIMARY KEY,
  worker_id TEXT,
  timestamp DATETIME,
  latency_p50 REAL,
  latency_p95 REAL,
  latency_p99 REAL,
  error_rate REAL,
  request_count INT,
  FOREIGN KEY (worker_id) REFERENCES workers(id)
);
```

---

## 🔌 API ESZKÖZÖK

### **Backend Routes** (`/api/fleet/`, `/api/metrics/`, `/api/scaling/`)

1. **Fleet Management**
   - `POST /api/fleet/create` - Új fleet létrehozása
   - `GET /api/fleet/list` - Fletek listázása
   - `GET /api/fleet/:id` - Fleet részletei
   - `PUT /api/fleet/:id` - Fleet módosítása
   - `DELETE /api/fleet/:id` - Fleet törlése

2. **Worker Management**
   - `POST /api/fleet/:id/workers/add` - Worker hozzáadása fleethez
   - `GET /api/fleet/:id/workers` - Fleet worker-ei
   - `PUT /api/fleet/:id/workers/:workerId/status` - Worker status (pause/resume)
   - `DELETE /api/fleet/:id/workers/:workerId` - Worker eltávolítása

3. **Metrics & Monitoring**
   - `GET /api/metrics/:workerId/latest` - Legutolsó metrikák
   - `GET /api/metrics/:workerId/range?from=X&to=Y` - Metrika tartomány
   - `GET /api/metrics/fleet/:fleetId/summary` - Fleet-szintű összefoglaló
   - `POST /api/metrics/prometheus/scrape` - Prometheus scrape endpoint

4. **Auto-scaling**
   - `GET /api/scaling/policies` - Jelenlegi skálázási politikák
   - `PUT /api/scaling/policies` - Politikák módosítása
   - `GET /api/scaling/history/:fleetId` - Skálázási előzmények
   - `POST /api/scaling/trigger` - Manuális trigger (dev)

---

## 📡 PROMETHEUS METRIKA FORMAT

Worker metrics endpoint (Worker kódban):

```
# HELP worker_request_duration Kérés időtartama milliszekundumban
# TYPE worker_request_duration histogram
worker_request_duration{worker_id="...",env="prod"} duration_ms

# HELP worker_error_total Összes hiba
# TYPE worker_error_total counter
worker_error_total{worker_id="...",status="500"} count

# HELP worker_requests_total Összes kérés
# TYPE worker_requests_total counter
worker_requests_total{worker_id="..."} count

# HELP cloudflare_edge_location Szerver helye
# TYPE cloudflare_edge_location gauge
cloudflare_edge_location{worker_id="...",colo="LAX"} 1
```

---

## 🎬 FLOW DIAGRAMMOK

### **Auto-scaling Flow**
```
Prometheus Scrape (5m interval)
    ↓
Metrics aggregated (avg latency, error rate)
    ↓
Check scaling policies
    ├─ IF latency > 500ms OR error > 5% → SCALE UP
    │  └─ Deploy N új worker instances
    │     ↓
    │     Update D1 workers table
    │     ↓
    │     Emit Socket.IO event: "fleet_scaled"
    │
    └─ IF latency < 100ms AND error < 1% → SCALE DOWN
       └─ Mark M workers for drain
          ↓
          Graceful shutdown (max 30s)
          ↓
          Delete from D1
          ↓
          Emit Socket.IO event: "fleet_scaled"
```

### **Real-time Dashboard Update Flow**
```
Worker publishes metrics to Prometheus
    ↓
Prometheus pulls metrics (5 min or custom interval)
    ↓
/api/metrics/prometheus/scrape reads Prometheus
    ↓
Cache to D1 metrics_cache
    ↓
WebSocket broadcast (Socket.IO)
    ↓
React Dashboard re-renders charts [Recharts]
```

---

## 🧪 ACCEPTANCE CRITERIA

- ✅ Backend API eszközök létrehozása (/api/fleet, /api/metrics, /api/scaling)
- ✅ D1 táblák inicializálása (fleets, workers, scaling_events, metrics_cache)
- ✅ React Dashboard: Fleet Overview komponens (grid view)
- ✅ React Dashboard: Real-time Metrics Dashboard (Recharts charts)
- ✅ React Dashboard: Worker Details panel
- ✅ Prometheus integráció: /api/metrics/prometheus/scrape endpoint
- ✅ Auto-scaling logic: Scale-up/down trigger logika
- ✅ WebSocket broadcasts: Real-time updates Socket.IO-val
- ✅ E2E Test: Create fleet → Add workers → Generate metrics → Check scaling
- ✅ Documentation: Fleet management runbook

---

## 📚 RESOURCES

- **Prometheus Docs:** https://prometheus.io/docs/
- **Cloudflare Workers:** https://developers.cloudflare.com/workers/
- **Recharts (Dashboard Charts):** https://recharts.org/
- **D1 SQL:** https://developers.cloudflare.com/d1/
