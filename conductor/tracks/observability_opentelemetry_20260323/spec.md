# Specifikáció: Observability & OpenTelemetry
**Track ID:** `observability_opentelemetry_20260323`
**Státusz:** active | **Prioritás:** HIGH
**Assignee:** Copilot + Pohánka Péter

---

## 1. Jelenlegi Helyzet

| Komponens | Státusz | Megjegyzés |
|---|---|---|
| `src/utils/logger.ts` | ✅ Strukturált logging | info/warn/error + EventEmitter |
| `src/core/prometheus.ts` | ✅ Fleet metrikák | workers, requests, errors, latency |
| `src/utils/metrics.ts` | ✅ Agent + LLM metrikák | execution time, token cost estimation |
| `src/core/auditLog.ts` | ✅ Permission audit | SQLite WAL, 30 nap retention |
| **Distributed tracing** | ❌ HIÁNYZIK | Nincs trace ID-k, span-ek, waterfall view |
| **Provider-szintű cost** | ❌ HIÁNYZIK | Becsült költség van, de nem pontos |
| **Telemetry export** | ❌ HIÁNYZIK | Nincs OTLP, csak in-memory Prometheus |

## 2. Cél Architektúra

```
Agent.execute(task)
    │ ← Root Span: "agent.execute" { agent, task }
    ├── RAG Query ← Child Span: "rag.query" { query, results }
    ├── LLM Call ← Child Span: "llm.call" { provider, model, tokens, cost }
    │   └── Bifrost Fallback ← Child Span: "bifrost.fallback" { from, to }
    ├── Tool Call ← Child Span: "tool.call" { tool, params, duration }
    └── Evaluation ← Child Span: "evaluate" { confidence, approved }
         │
         ▼
    OTLP Exporter → Grafana / Jaeger / lokális collector
```

## 3. OpenTelemetry Setup

```typescript
// src/core/telemetry.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { trace, SpanStatusCode } from '@opentelemetry/api';

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
  }),
  serviceName: 'brunella-agent-system',
});

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export async function wrapWithSpan<T>(
  tracerName: string, spanName: string, attributes: Record<string, string | number>,
  fn: () => Promise<T>
): Promise<T> {
  const tracer = getTracer(tracerName);
  return tracer.startActiveSpan(spanName, { attributes }, async (span) => {
    try {
      const result = await fn();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
```

## 4. Token & Cost Tracking

```typescript
// Provider árazás (2026 Q1 árak)
const PROVIDER_COSTS: Record<string, { input: number; output: number }> = {
  'gemini-2.0-flash': { input: 0.075 / 1_000_000, output: 0.30 / 1_000_000 },
  'gemini-2.5-pro': { input: 1.25 / 1_000_000, output: 10.00 / 1_000_000 },
  'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
  'ollama-local': { input: 0, output: 0 },  // lokális = ingyenes
};
```

## 5. Dashboard Integráció

- **Panel:** `src/dashboard/components/dashboard/TelemetryPanel.tsx`
- **Nézetek:**
  - Agent Execution Timeline (waterfall)
  - Provider Cost Breakdown (pie chart: Gemini vs Ollama vs GitHub)
  - Token Usage Trend (daily line chart)
  - Error Rate per Agent (bar chart)

## 6. CLI Integráció

```bash
brunella telemetry                   # Interaktív menü
brunella telemetry traces            # Legutóbbi 20 trace
brunella telemetry costs             # Provider költségek összesítő
brunella telemetry agents            # Per-agent statisztikák
```

## 7. Sikerességi Kritériumok

- [ ] OpenTelemetry SDK inicializálva szerver induláskor
- [ ] Minden agent.execute() hívás = trace span
- [ ] LLM hívások: provider, model, tokens, cost attribútumok
- [ ] Dashboard TelemetryPanel: timeline + cost breakdown
- [ ] CLI: `brunella telemetry` elérhető
- [ ] OTLP export működik (lokális collector-ra vagy /dev/null)
- [ ] `npm run build && npm test` → 0 hiba
