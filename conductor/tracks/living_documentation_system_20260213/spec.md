# Living Documentation System

**Track ID:** `living_documentation_system_20260213`
**Típus:** Documentation + Observability Enablement
**Prioritás:** HIGH
**Létrehozva:** 2026-02-13
**Státusz:** `pending_approval`

---

## 1. Célkitűzés

Az API és agent dokumentáció egységesítése, a döntések visszakereshetővé tétele (ADR), valamint interaktív példák és monitoring dashboard-ek bevezetése az onboarding és üzemeltetés gyorsításához.

---

## 2. Scope

### P1 — API Documentation Consolidation

- Swagger/OpenAPI dokumentáció kiterjesztése route szinten.
- Egységes API használati útmutató publikálása (belépési pont + példák).

### P2 — Agent Documentation Lifecycle

- Agentenként külön dokumentáció (`docs/agents/*.md`) fenntartása.
- Living-doc coverage és auto-refresh folyamat használata a drift csökkentésére.

### P3 — Architecture Decision Records

- `ADR/` mappa létrehozása, számozott döntésnaplókkal.
- Minden jelentős platformdöntéshez kötelező ADR bejegyzés.

### P4 — Interactive Examples

- `myai/examples/` alatt Jupyter notebook példák létrehozása.
- Notebookok fókusza: RAG pipeline, golden dataset flow, query példák.

### P5 — Monitoring Visibility

- Prometheus metrikákhoz Grafana dashboard baseline publikálása.
- p50/p95/p99 agent latency, success rate, token és költség trend panelek.

---

## 3. Acceptance Criteria

- [ ] Van dedikált track spec a Living Documentation rendszerhez.
- [ ] `ADR/` mappa legalább 2 döntéssel elérhető.
- [ ] `myai/examples/` tartalmaz legalább 1 futtatható `.ipynb` példát.
- [ ] Grafana dashboard JSON elérhető és importálható.
- [ ] A változások naplózva vannak `conductor/CHANGELOG.md` és `.ai/copilot.md` fájlokban.

---

## 4. Kockázatok és mitigáció

- **Dokumentációs drift:** automated coverage + refresh használata.
- **Dashboard adósság:** baseline dashboard + iteratív bővítés.
- **Notebook elavulás:** példák mellé rövid frissítési protokoll.

---

## 5. Várható üzleti hatás

- Onboarding idő csökkenése.
- Kevesebb ismétlődő "hol találom?" kérdés.
- Gyorsabb hibakeresés a metrika-alapú láthatóság miatt.
