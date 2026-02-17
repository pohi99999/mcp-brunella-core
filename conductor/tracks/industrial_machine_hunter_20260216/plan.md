# Implementation Plan: Industrial Machine Hunter

**Track ID:** `industrial_machine_hunter_20260216`  
**Priority:** `HIGH`  
**Status:** `ACTIVE` (Phase 1 ✅ + Phase 2 ✅ Complete, Phase 3 pending)  
**Progress:** 65%

---

## Phase 1: Harvesting (Week 1) ✅

- [x] **Task 1.1:** `myai/workers/machine_hunter.py` – MachineListing Pydantic modell, 3 forrás (Machineseeker, Maschinensucher, BidSpotter), mock + live stubs
- [x] **Task 1.2:** Anti-bot: configurable delay + user-agent rotáció

**Acceptance Criteria:** ✅
- 3 aukciós oldalról listák (mock + stub structure)
- for_parts / zajszűrés (noise words: 'parts only', 'defective', 'ersatzteile')
- CLI: `--query`, `--sources`, `--limit`, `--mock`, markdown output

---

## Phase 2: Valuation (Week 2) ✅

- [x] **Task 2.1:** `machine_hunter.py::valuate_listing()` – évjárat + üzemóra leárazási modell (8%/év, 0.003%/óra, min 15% roncsérték)
- [x] **Task 2.2:** EUR normalizáció – 9 valuta (EUR, HUF, USD, GBP, PLN, CZK, CHF, RON, SEK)
- [x] **Tesztek:** `myai/tests/test_machine_hunter.py` – 70 teszt, 70/70 PASS

**Acceptance Criteria:** ✅
- `ValuationResult`: arbitrage_score, confidence, BUY/WATCH/IGNORE, discount_pct
- Zajszűrés (for_parts, 'defective', 'parts only', stb.)
- BUY ajánlások score szerint rendezve

---

## Phase 3: Alerting (Week 3) ⏳

- [ ] **Task 3.1:** Alert pipeline – `hunt_machines()` BUY eredmények → Socket.IO broadcast
- [ ] **Task 3.2:** Dashboard widget – masina vadász eredmény tábla (BUY/WATCH/IGNORE)

**Acceptance Criteria:**
- BUY ajánlás megjelenik a dashboardon
- Socket.IO `machine_alert` event
- Emberi jóváhagyás (human-in-the-loop) küldés előtt

---

---

## Fájlak

| Fájl | Státusz | Leírás |
|------|---------|--------|
| `myai/workers/machine_hunter.py` | ✅ DONE | Multi-source aukciós scraper + értékelő motor |
| `myai/tests/test_machine_hunter.py` | ✅ DONE | 70 unit teszt, 70/70 PASS |
| Supply chain alert dispatcher | ⏳ TODO | Socket.IO broadcast |
| Dashboard widget | ⏳ TODO | Masina vadász eredménytábla |

*Plan v1.1 | 2026-02-16 – Phase 1+2 Complete*