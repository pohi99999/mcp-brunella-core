# Conductor Change Log

A cél: minden jelentős rendszer- és fejlesztési módosítás rövid, visszakereshető naplózása.

## 2026-02-13 - Copilot session: Golden + Monitoring + Swagger + Doc Sync

### Összefoglaló

Ebben a körben a rendszer stabilizáció és observability fókuszú módosítások kerültek be, továbbá a repository-ban felhalmozott változások dokumentálása megtörtént.

### Implementált technikai változások

- Golden Dataset flow normalizálás (legacy és új payload kompatibilitás):
  - `src/server/memoryRoutes.ts`
  - `myai/server.py`
  - `myai/utils/dataset_manager.py`
- Golden Dataset canonical path konszolidálás (`data/training/golden_dataset.jsonl`):
  - `myai/tools/knowledge_integrator.py`
  - `myai/config/sources.json`

- Prometheus-alapú monitoring réteg és metrika instrumentáció:
  - `src/utils/metrics.ts` (új)
  - `src/server/web.ts` (`/metrics` endpoint + HTTP metrika hook)
  - `src/agents/AgentManager.ts` (agent execution metrikák)
  - `src/core/llm_client.ts` (LLM token/cost metrikák)
  - `package.json`, `package-lock.json` (`prom-client` dependency)

- Swagger dokumentációs lefedettség bővítés route modulokra:
  - `src/server/swagger.ts`
  - `src/server/web.ts` (`/metrics` Swagger blokk)

- Új/kapcsolódó tesztek:
  - `test/memoryRoutes.golden.test.ts` (új)
  - `test/prometheus_metrics.test.ts` (új)
  - `test/swagger_spec.test.ts` (új)

- Monitoring dokumentáció:
  - `docs/MONITORING_PROMETHEUS.md` (új)
  - `README.md` link frissítés

### Conductor- és projekt állapotváltozások (repo szint)

A repository-ban egyidejűleg több track/meta frissítés, archiválás és új track könyvtár is megjelent, továbbá dashboard/route/parser/test bővítések történtek. Ezek a változások git commit+push során együtt kerülnek rögzítésre.

### Verifikáció

- Céltesztek zöldek (Golden + Monitoring + Swagger)
- Teljes futtatás zöld: `npm test`

