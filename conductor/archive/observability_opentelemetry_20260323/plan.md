# Implementációs Terv: Observability & OpenTelemetry
**Track ID:** `observability_opentelemetry_20260323`

---

## Phase 1: OpenTelemetry SDK Integráció

* [ ] **Task 1.1** — Függőségek telepítése
  ```bash
  npm install @opentelemetry/sdk-node @opentelemetry/api @opentelemetry/exporter-trace-otlp-http @opentelemetry/semantic-conventions
  ```

* [ ] **Task 1.2** — `src/core/telemetry.ts`
  - `initTelemetry()`: NodeSDK setup + OTLPTraceExporter
  - `getTracer(name)`: tracer factory
  - `wrapWithSpan(tracer, name, attrs, fn)`: span wrapper helper
  - `shutdownTelemetry()`: graceful shutdown

* [ ] **Task 1.3** — `src/index.ts` integráció
  - `initTelemetry()` hívás a szerver indulás elején (import előtt!)
  - Graceful shutdown: `shutdownTelemetry()` SIGTERM-re

* [ ] **Task 1.4** — Env vars
  - `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP collector URL
  - `OTEL_ENABLED`: true/false toggle (default: false)
  - `.env.example` frissítés

---

## Phase 2: Agent Trace Instrumentation

* [ ] **Task 2.1** — AgentManager instrumentation
  - `execute()` hívás = root span (`agent.execute`)
  - Attribútumok: `agent.name`, `agent.task`, `agent.status`, `agent.durationMs`

* [ ] **Task 2.2** — BaseAgent instrumentation
  - `execute()` bridge: child span (`agent.bridge`)
  - RAG query: child span (`rag.query`) { `rag.results`, `rag.latencyMs` }
  - Memory save: child span (`rag.save`)

* [ ] **Task 2.3** — Span attribútumok standardizálás
  - Semantic conventions: `service.name`, `code.function`, `code.filepath`
  - Custom: `bas.agent.name`, `bas.agent.confidence`, `bas.task.type`

* [ ] **Task 2.4** — Tesztek
  - `test/observability/telemetry.test.ts`
  - Mock TracerProvider, span creation ellenőrzés
  - OTEL_ENABLED=false → no-op ellenőrzés

---

## Phase 3: LLM Provider Metrikák

* [ ] **Task 3.1** — `src/core/bifrost_gateway.ts` instrumentation
  - Span per LLM hívás: `llm.call` { provider, model, promptTokens, completionTokens }
  - Fallback event: `llm.fallback` { fromProvider, toProvider, reason }

* [ ] **Task 3.2** — `src/core/llm_client.ts` instrumentation
  - Token counting: `estimateTokens(text)` (tiktoken vagy heurisztika)
  - Cost calculation: `calculateCost(provider, promptTokens, completionTokens)`

* [ ] **Task 3.3** — Cost aggregáció
  - In-memory accumulator: napi/heti/havi összesítés
  - SQLite perzisztencia: `telemetry_costs` tábla
  - API endpoint: `GET /api/telemetry/costs`

---

## Phase 4: Dashboard + CLI + Export

* [ ] **Task 4.1** — Dashboard panel
  - `src/dashboard/components/dashboard/TelemetryPanel.tsx`
  - Agent execution timeline (Radix UI Table + időrendi)
  - Provider cost pie chart (Recharts)
  - Token usage trend (daily line chart)

* [ ] **Task 4.2** — Navigation regisztráció
  - `navigation.tsx`: TelemetryPanel hozzáadás

* [ ] **Task 4.3** — CLI parancsok
  - `src/cli/commands/telemetry-hu.ts`
  - Inquirer menü: traces / costs / agents
  - Színes output: chalk + boxen

* [ ] **Task 4.4** — Prometheus bővítés
  - `src/core/prometheus.ts`: OTel metrikák export
  - `bas_agent_duration_seconds`, `bas_llm_tokens_total`, `bas_llm_cost_usd_total`

* [ ] **Task 4.5** — Végső tesztek
  - `npm run build && npm test` → 0 hiba
  - README.md: Observability szekció

---

## 🎯 Sikerességi Kritériumok

1. OpenTelemetry SDK fut szerver induláskor (OTEL_ENABLED=true)
2. Minden agent hívás = trace span (agent name, task, status, duration)
3. LLM hívások: provider, model, tokens, cost
4. Dashboard TelemetryPanel működik
5. CLI `brunella telemetry` elérhető
6. Prometheus /metrics új metrikákkal bővítve
7. Összes meglévő teszt PASS
