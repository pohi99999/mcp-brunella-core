# Végrehajtási Terv: Hyperdrive Connection Pooling D1 Teljesítményhez

**Track ID:** `cf_hyperdrive_d1_20260323`
**Prioritás:** LOW
**Becsült idő:** 2-4 nap (feltételes végrehajtás)

---

## Fázis 1: Baseline D1 latency mérés

- [ ] Teljesítmény mérő script létrehozása: `scripts/measure-d1-latency.ts`
- [ ] Mérési pontok implementálása:
  - [ ] Egyszerű SELECT (P95 latency)
  - [ ] INSERT egyedi és batch (P95 latency)
  - [ ] Aggregáció GROUP BY (P95 latency)
  - [ ] Full table scan (P95 latency)
- [ ] 100 mérés futtatása minden típusból
- [ ] Eredmények dokumentálása
- [ ] **DÖNTÉSI PONT:** Ha P95 < 200ms → Track lezárás, nincs szükség beavatkozásra

## Fázis 2: Hyperdrive alkalmazhatóság vizsgálat

- [ ] Cloudflare dokumentáció ellenőrzése: Hyperdrive + D1 kompatibilitás
- [ ] Hyperdrive pricing ellenőrzése (Free tier limit)
- [ ] **DÖNTÉSI PONT:** Ha nem kompatibilis D1-gyel → Fázis 3 alternatívák

### Ha Hyperdrive alkalmazható:
- [ ] Hyperdrive konfiguráció létrehozása:
  ```bash
  wrangler hyperdrive create bas-d1-pool --connection-string="..."
  ```
- [ ] `wrangler.jsonc` frissítése Hyperdrive binding-gal
- [ ] Worker kód módosítása Hyperdrive használatra

## Fázis 3: Alternatív optimalizálás (ha Hyperdrive nem alkalmazható)

- [ ] D1 indexek optimalizálása:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_created ON agent_runs(created_at);
  CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_id, created_at);
  ```
- [ ] D1 query batching implementálása a Workers kódban
- [ ] KV cache réteg a gyakori olvasási query-khez:
  - [ ] `getCachedQuery()` utility implementálása
  - [ ] Cache TTL konfigurálás (60 másodperc alapértelmezett)

## Fázis 4: Teljesítmény összehasonlítás

- [ ] Újra futtatni a Fázis 1 méréseket az optimalizálás után
- [ ] Eredmények összehasonlítása (előtte/utána táblázat)
- [ ] Dokumentálás: melyik megközelítés mennyit javított
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- A D1 query latency mérve és dokumentálva van (baseline)
- Ha szükséges: az optimalizálás legalább 30%-os javulást hoz
- Ha nem szükséges: a track "not-needed" státusszal zárva
- A döntési folyamat dokumentálva

---

## ✅ CLOSURE NOTE (2026-03-23)

**TRACK ARCHIVED AS NOT-NEEDED**

**Conclusion:** Cloudflare Hyperdrive is not applicable to D1. Hyperdrive is specifically designed for connection pooling and query caching for external PostgreSQL/MySQL databases over TCP/TLS connections. D1 is a native Cloudflare database that is already optimized for Workers environments and does not expose a TCP endpoint for Hyperdrive to pool connections to.

**Decision:** No runtime code changes required. D1 performance can be optimized through standard database techniques (indexing, query batching, KV caching) if needed in the future.
