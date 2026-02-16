# Technical Specification: Industrial Machine Hunter

**Track ID:** `industrial_machine_hunter_20260216`  
**Status:** `pending_approval`  
**Last Updated:** 2026-02-16  

---

## 📖 Context

Az EV Hunter (Green Lightning) logika kiterjesztése ipari gépek és alkatrészek piacára. Aukciós oldalak, többnyelvű listák és arbitrázs lehetőségek automatikus feltérképezése.

---

## 🎯 Goals

- Aukciós/használtautó/industrial listing gyűjtés.
- Valós piaci érték becslés (évjárat + üzemóra).
- Arbitrázs pontszám + BUY/WATCH/IGNORE ajánlás.

---

## 🧱 Components

- `src/agents/ResearcherAgent.ts` – aukciós scrape capability
- `src/agents/DataScientistAgent.ts` – valuation és scoring
- `myai/refiner_logic.py` – normalizálás, árkonverzió
- `src/servers/automation.py` – browser-use navigáció

---

## 📦 Data Structures

```typescript
interface MachineListing {
  id: string;
  title: string;
  price: number;
  currency: string;
  year: number;
  hours: number;
  location: string;
  url: string;
}

interface ValuationResult {
  estimated_value: number;
  arbitrage_score: number;
  confidence: number;
  recommendation: 'BUY' | 'WATCH' | 'IGNORE';
}
```

---

## 🔄 Workflow

1. Orchestrator kiosztja a keresési feladatot (pl. CNC Germany).
2. ResearcherAgent gyűjt aukciós listákat.
3. DataScientist normalizálja és értékeli.
4. Alert, ha arbitrage_score > 0.8.

---

## 🛡️ Critical Constraints

- Anti-bot védelem: lassított navigáció + user-agent rotáció.
- Valuta konverzió: minden EUR-ra normalizálva.
- Zajszűrés: hibás/alkatrész-only listingek kiszűrése.

---

## ✅ Acceptance Criteria

- Aukciós adatgyűjtés 3 oldalon működik.
- ValuationResult generálása valid.
- Alerting pipeline működik dashboardon.

---

*Spec v1.0 | 2026-02-16*