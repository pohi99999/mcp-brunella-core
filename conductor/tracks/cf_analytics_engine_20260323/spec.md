# Specifikáció: Cloudflare Analytics Engine Egyedi Metrikák

**Track ID:** `cf_analytics_engine_20260323`
**Prioritás:** LOW
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Áttekintés

A Cloudflare Analytics Engine bevezetése a BAS rendszer egyedi teljesítmény metrikáinak gyűjtésére és elemzésére. Az Analytics Engine kiegészíti a meglévő OpenTelemetry/Prometheus-alapú megfigyelhetőségi infrastruktúrát egy edge-natív metrika rendszerrel.

### Jelenlegi observability állapot

| Rendszer | Típus | Helyszín | Státusz |
|----------|-------|----------|---------|
| Prometheus | Metrikák | Lokális szerver | ✅ Aktív (`src/core/prometheus.ts`) |
| OpenTelemetry | Nyomkövetés (tracing) | Lokális szerver | 🔧 Fejlesztés alatt |
| Winston Logger | Logok | Lokális szerver | ✅ Aktív (`src/utils/logger.ts`) |
| **Analytics Engine** | **Edge metrikák** | **Cloudflare Edge** | **❌ Nincs konfigurálva** |

### Miért Analytics Engine a Prometheus mellé?

- **Edge-natív:** A Workers-ben közvetlenül íródnak a metrikák, nincs hálózati késleltetés
- **SQL lekérdezés:** GraphQL helyett SQL-alapú lekérdezés (ismerősebb, könnyebb)
- **Automatikus aggregáció:** Beépített időalapú összesítés (perc, óra, nap)
- **Free tier:** 25 adatpont/kérés, 100K írás/nap (bőven elég)
- **Prometheus nem éri el az edge-t:** A lokális Prometheus nem lát bele a Workers teljesítményébe

---

## 2. Mérni kívánt adatpontok

### 2.1 Agent teljesítmény metrikák

```typescript
// Adatpont séma
interface AgentPerformanceDatapoint {
  // Indexek (blob-ok) — szűréshez
  blobs: [
    string,  // blob1: agent_id (pl. "CoderAgent")
    string,  // blob2: task_type (pl. "code-generation")
    string,  // blob3: status ("success" | "failure" | "timeout")
    string,  // blob4: model_used (pl. "@cf/deepseek/deepseek-r1-distill-qwen-32b")
    string,  // blob5: track_id (pl. "cf_token_permissions_fix_20260323")
  ];
  // Numerikus értékek — aggregáláshoz
  doubles: [
    number,  // double1: execution_time_ms (futási idő milliszekundumban)
    number,  // double2: token_input (felhasznált input tokenek)
    number,  // double3: token_output (generált output tokenek)
    number,  // double4: cost_estimate (becsült költség USD-ben)
  ];
}
```

### 2.2 Rendszer metrikák

| Metrika | Típus | Leírás |
|---------|-------|--------|
| `worker_request_count` | counter | Worker kérések száma |
| `worker_request_duration_ms` | histogram | Kérés feldolgozási idő |
| `d1_query_duration_ms` | histogram | D1 query végrehajtási idő |
| `kv_operation_duration_ms` | histogram | KV műveletek ideje |
| `r2_upload_size_bytes` | gauge | R2 feltöltési méret |
| `queue_message_count` | counter | Queue üzenetek száma |
| `workflow_step_duration_ms` | histogram | Workflow lépés ideje |

### 2.3 Üzleti metrikák

| Metrika | Típus | Leírás |
|---------|-------|--------|
| `leads_found_count` | counter | Talált lead-ek száma |
| `grants_relevant_count` | counter | Releváns pályázatok |
| `task_success_rate` | gauge | Feladat sikerességi arány |
| `daily_token_usage` | counter | Napi token felhasználás |

---

## 3. Instrumentálás

### 3.1 writeDataPoint() használata Workers-ben

```typescript
// cloudflare/src/analytics.ts
export class BASAnalytics {
  private dataset: AnalyticsEngineDataset;

  constructor(dataset: AnalyticsEngineDataset) {
    this.dataset = dataset;
  }

  /**
   * Agent futás metrika rögzítése
   */
  recordAgentRun(params: {
    agentId: string;
    taskType: string;
    status: 'success' | 'failure' | 'timeout';
    modelUsed: string;
    trackId: string;
    executionTimeMs: number;
    tokenInput: number;
    tokenOutput: number;
    costEstimate: number;
  }): void {
    this.dataset.writeDataPoint({
      blobs: [
        params.agentId,
        params.taskType,
        params.status,
        params.modelUsed,
        params.trackId,
      ],
      doubles: [
        params.executionTimeMs,
        params.tokenInput,
        params.tokenOutput,
        params.costEstimate,
      ],
      indexes: [params.agentId], // Elsődleges index a gyors lekérdezéshez
    });
  }

  /**
   * Worker kérés metrika rögzítése
   */
  recordWorkerRequest(params: {
    path: string;
    method: string;
    statusCode: number;
    durationMs: number;
  }): void {
    this.dataset.writeDataPoint({
      blobs: [params.path, params.method, String(params.statusCode)],
      doubles: [params.durationMs],
      indexes: [params.path],
    });
  }
}
```

### 3.2 Worker middleware integráció

```typescript
// cloudflare/src/index.ts — analytics middleware
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const start = performance.now();
    const analytics = new BASAnalytics(env.BAS_ANALYTICS);

    try {
      const response = await handleRequest(request, env);
      const duration = performance.now() - start;

      analytics.recordWorkerRequest({
        path: new URL(request.url).pathname,
        method: request.method,
        statusCode: response.status,
        durationMs: duration,
      });

      return response;
    } catch (error) {
      analytics.recordWorkerRequest({
        path: new URL(request.url).pathname,
        method: request.method,
        statusCode: 500,
        durationMs: performance.now() - start,
      });
      throw error;
    }
  },
};
```

---

## 4. Wrangler konfiguráció

```jsonc
{
  "analytics_engine_datasets": [
    {
      "binding": "BAS_ANALYTICS",
      "dataset": "bas_metrics"
    }
  ]
}
```

---

## 5. SQL lekérdezések

Az Analytics Engine SQL-alapú lekérdezéssel érhető el a Cloudflare API-n keresztül.

### 5.1 Agent teljesítmény összesítés

```sql
-- Átlagos futási idő agent-enként (utolsó 24 óra)
SELECT
  blob1 AS agent_id,
  COUNT() AS run_count,
  AVG(double1) AS avg_execution_ms,
  SUM(double2) AS total_input_tokens,
  SUM(double3) AS total_output_tokens,
  SUM(double4) AS total_cost_usd
FROM bas_metrics
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY blob1
ORDER BY run_count DESC
```

### 5.2 Hiba arány agent-enként

```sql
-- Sikerességi arány (utolsó 7 nap)
SELECT
  blob1 AS agent_id,
  COUNT() AS total_runs,
  SUM(CASE WHEN blob3 = 'success' THEN 1 ELSE 0 END) AS success_count,
  ROUND(SUM(CASE WHEN blob3 = 'success' THEN 1 ELSE 0 END) * 100.0 / COUNT(), 2) AS success_rate
FROM bas_metrics
WHERE timestamp > NOW() - INTERVAL '7' DAY
GROUP BY blob1
ORDER BY success_rate ASC
```

### 5.3 Modell használat eloszlás

```sql
-- Melyik modellt mennyit használtuk (utolsó 30 nap)
SELECT
  blob4 AS model,
  COUNT() AS usage_count,
  AVG(double1) AS avg_latency_ms,
  SUM(double2 + double3) AS total_tokens
FROM bas_metrics
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY blob4
ORDER BY usage_count DESC
```

---

## 6. Dashboard vizualizáció

### 6.1 Tervezett dashboard panelek

| Panel | Típus | Tartalom |
|-------|-------|----------|
| Agent teljesítmény | Táblázat | Agent-ek futási statisztikái |
| Hiba arány | Vonaldiagram | Sikerességi arány időben |
| Token használat | Oszlopdiagram | Napi token felhasználás |
| Modell eloszlás | Kördiagram | Modell használat megoszlása |
| Response time | Hisztogram | Válaszidő eloszlás |
| Riasztások | Lista | Küszöbérték túllépések |

### 6.2 API endpoint

```typescript
// Worker API az Analytics Engine lekérdezéshez
GET /api/analytics/agents?timeRange=24h
GET /api/analytics/models?timeRange=7d
GET /api/analytics/errors?timeRange=7d
GET /api/analytics/tokens?timeRange=30d
```

---

## 7. Riasztási küszöbértékek

| Metrika | Figyelmeztetés | Kritikus | Művelet |
|---------|---------------|----------|---------|
| Agent sikerességi arány | < 80% | < 50% | Discord értesítés |
| Átlagos futási idő | > 30 sec | > 60 sec | Modell váltás vizsgálat |
| Napi token használat | > 80% limit | > 95% limit | Rate limiting |
| Worker hiba arány | > 5% | > 15% | Rollback vizsgálat |

---

## 8. Integráció a meglévő Prometheus-szal

Az Analytics Engine **nem helyettesíti** a Prometheus-t, hanem kiegészíti:

| Szempont | Prometheus | Analytics Engine |
|----------|-----------|-----------------|
| Helyszín | Lokális szerver metrikái | Edge/Workers metrikái |
| Típus | Pull-alapú | Push-alapú (writeDataPoint) |
| Lekérdezés | PromQL | SQL |
| Tárhelye | Lokális disk | Cloudflare felhő |
| Vizualizáció | Grafana | BAS Dashboard + CF Dashboard |

---

## 9. Kockázatok

- **Adatvesztés:** Az Analytics Engine nem garantálja a 100%-os adatmegőrzést (best-effort)
- **SQL korlátozások:** Nem teljes SQL — egyes funkciók hiányozhatnak
- **Free tier limit:** 100K írás/nap — nagy forgalomnál korlát lehet
- **Latency a lekérdezésnél:** Az Analytics Engine lekérdezés lassabb lehet mint a Prometheus

---

## 10. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — Analytics Engine binding
- `cloudflare/src/index.ts` — Worker middleware (instrumentálás)
- `src/core/prometheus.ts` — Meglévő Prometheus metrikák (referencia)
- `src/utils/logger.ts` — Winston logger (log metrikák)
- `src/dashboard/` — Dashboard vizualizáció
