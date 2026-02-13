# Conductor Change Log

A cél: minden jelentős rendszer- és fejlesztési módosítás rövid, visszakereshető naplózása.

## 2026-02-14 - Copilot session: Living Documentation bootstrap for missing agent docs

### Összefoglaló (Living Docs bootstrap)

A ProjectConductor immár nemcsak riportálja a dokumentációs lefedettséget, hanem automatikusan létre is hozza a hiányzó agent dokumentációs stubokat.

### Implementált technikai változások (Bootstrap)

- **Automatikus docs bootstrap** (`src/agents/ProjectConductorAgent.ts`):
  - új metódus: `bootstrapMissingAgentDocs(...)`
  - hiányzó `docs/agents/<AgentName>.md` fájlok létrehozása sync futáskor
  - alapadatok kinyerése a forrásból (`name`, `role`, `description`, `capabilities`)
  - kiegészítő helper metódusok:
    - `extractAssignedString(...)`
    - `extractCapabilities(...)`

- **Új agent dokumentációs oldalak** (`docs/agents/*.md`):
  - 16 db új stub oldal generálva a teljes `src/agents/*Agent.ts` készlethez.

- **Coverage riport frissítés** (`docs/agents/README_COVERAGE.md`):
  - lefedettség: `0%` → `100%`

### Verifikáció (Bootstrap)

- Teljes futtatás zöld: `npm test` (61 fájl, 479 teszt PASS)

## 2026-02-14 - Copilot session: Living Documentation coverage automation (agents)

### Összefoglaló (Living Docs)

A ProjectConductor dokumentáció-szinkron folyamat bővítve lett automatikus agent dokumentáció-lefedettségi riporttal.

### Implementált technikai változások (Living Docs)

- **ProjectConductor sync bővítés** (`src/agents/ProjectConductorAgent.ts`):
  - új auto-update célfájl: `docs/agents/README_COVERAGE.md`
  - új generátor metódus: `updateAgentDocumentationCoverage()`
  - forrás: `src/agents/*.ts` fájlok (Base/types kizárva)
  - cél: `docs/agents/<AgentName>.md` létezésének ellenőrzése
  - kimenet: összesített coverage % + táblázatos státusz

### Verifikáció (Living Docs)

- Teljes futtatás zöld: `npm test` (61 fájl, 479 teszt PASS)

## 2026-02-14 - Copilot session: LanceDB Dual-Index Embedding Migration (mxbai + legacy fallback)

### Összefoglaló (Dual-index)

A RAG embedding pipeline átállítása megtörtént a `mxbai-embed-large` modellre úgy, hogy közben megmaradjon a visszafelé kompatibilitás a `nomic-embed-text` indexszel.

### Implementált technikai változások (Dual-index)

- **Node RAG dual-index átállás** (`src/utils/rag.ts`):
  - primer index: `memory_v2_mxbai` (alapértelmezett)
  - legacy index: `memory`
  - dual write támogatás (`RAG_DUAL_INDEX_WRITE=true`)
  - keresésnél primer → legacy fallback stratégia
  - embedding dimenzió normalizálás (pad/cut) modell-specifikusan

- **AI Gateway embedding dimenzió-kezelés** (`src/utils/aiGateway.ts`):
  - új `expectedDimension` opció az embedding hívásokban
  - fallback vektorok mérete már hívás-specifikusan kezelhető

- **Python Knowledge Integrator dual-index felkészítés** (`myai/tools/knowledge_integrator.py`):
  - külön summary model és embedding model paraméterek
  - primary (`mxbai`) + legacy (`nomic`) embedding generálás támogatás
  - primary table: `tech_trends_v2_mxbai`
  - legacy table: `tech_trends`
  - CLI opciók bővítése embedding/dual-index konfigurációhoz

- **Konfiguráció dokumentálás** (`.env.example`):
  - `RAG_EMBEDDING_MODEL_PRIMARY`, `RAG_EMBEDDING_DIM_PRIMARY`
  - `RAG_EMBEDDING_MODEL_LEGACY`, `RAG_EMBEDDING_DIM_LEGACY`
  - `RAG_DUAL_INDEX_WRITE`

### Verifikáció (Dual-index)

- Teljes futtatás zöld: `npm test` (61 fájl, 479 teszt PASS)

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
