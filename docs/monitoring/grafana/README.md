# Grafana Dashboard Baseline

Ez a mappa tartalmazza a Brunella baseline Grafana dashboard exportot:

- `brunella-agents-overview.dashboard.json`

## Import lépések

1. Nyisd meg Grafana felületet.
2. **Dashboards → Import**.
3. Töltsd be a JSON fájlt.
4. Válaszd ki a Prometheus datasource-t.

## Fő panelek

- Agent execution p95 latency
- Agent success rate
- LLM token throughput
- Estimated LLM cost/hour
