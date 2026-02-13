# Monitoring: Prometheus + Grafana (BAS)

Ez a dokumentum a BAS Prometheus metrika-export használatát írja le.

## Elérhető endpoint

- `GET /metrics` – Prometheus scrape endpoint (text format)

## Jelenlegi metrikák

### HTTP

- `http_requests_total{method,path,status_code}`
- `http_request_duration_seconds_bucket{method,path,status_code,le}`

### Agent futás

- `agent_executions_total{agent_name,status}`
- `agent_execution_seconds_bucket{agent_name,status,le}`

### LLM usage/cost

- `llm_tokens_total{provider,model,direction}`
- `llm_cost_usd_total{provider,model}`

### Node default metrics (prefix: `bas_`)

- process, memory, event-loop és GC metrikák (`collectDefaultMetrics`)

## Instrumentációs pontok

- HTTP: `src/server/web.ts`
- Agent execution: `src/agents/AgentManager.ts`
- LLM usage/cost: `src/core/llm_client.ts`
- Metrika registry: `src/utils/metrics.ts`

## Prometheus scrape példa

```yaml
scrape_configs:
  - job_name: bas-core
    metrics_path: /metrics
    static_configs:
      - targets: ["localhost:3000"]
```

## Javasolt Grafana panelek

1. Agent latency p50/p95/p99 (`agent_execution_seconds`)
2. Agent success ratio (`agent_executions_total`)
3. HTTP error rate (`http_requests_total`, `status_code=~"5.."`)
4. LLM token trend (`llm_tokens_total`)
5. Becsült napi LLM költség (`llm_cost_usd_total`)

## Verifikáció

- Célteszt: `test/prometheus_metrics.test.ts`
- Full suite: `npm test`
