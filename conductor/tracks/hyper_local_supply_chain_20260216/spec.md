# Technical Specification: Hyper-Local Supply Chain

**Track ID:** `hyper_local_supply_chain_20260216`  
**Status:** `pending_approval`  
**Last Updated:** 2026-02-16  

---

## 📖 Context

Geo-fenced logisztikai kapacitások feltérképezése (pl. Zalaegerszeg + 50 km). A rendszer match-elés után human-in-the-loop jóváhagyással teaser emailt készít.

---

## 🎯 Goals

- Geo-fenced freight exchange adatgyűjtés.
- Matchmaking belső igényekkel.
- Autonóm teaser email draft (jóváhagyás előtt).

---

## 🧱 Components

- `src/agents/ResearcherAgent.ts` – geo-fenced scraping
- `src/agents/DataScientistAgent.ts` – matching logic
- `myai/refiner_logic.py` – internal_needs vs external_capacity
- `src/tools/googleWorkspace.ts` – Gmail draft

---

## 📦 Data Structures

```typescript
interface FreightCapacity {
  origin: string;
  destination: string;
  vehicle_type: string;
  available_pallets: number;
  date: Date;
  contact: string;
}

interface GeoFence {
  center: { lat: number; lng: number };
  radius_km: number;
}
```

---

## 🔄 Workflow

1. Geo-fenced harvest a freight exchange oldalakról.
2. Matchmaker összeveti internal_needs.json-nal.
3. Ha találat: teaser email draft Gmailbe.
4. Human approval után küldés.

---

## 🛡️ Critical Constraints

- **Real-time accuracy:** magas gyakoriságú worker loop.
- **GDPR:** kontakt adatok kezelése audit loggal.
- **Human-in-the-loop:** küldés előtt kötelező jóváhagyás.

---

## ✅ Acceptance Criteria

- Geo-fenced scrape működik 2 platformon.
- Matchmaker 1 PoC találatot generál.
- Email draft Gmailbe mentve.

---

*Spec v1.0 | 2026-02-16*