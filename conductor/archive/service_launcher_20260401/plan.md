# Végrehajtási Terv: n8n és Langflow Indítás Automatizálása

**Track ID:** `service_launcher_20260401`
**Leírás:** n8n és Langflow szolgáltatások indítása a Dashboardról.

---

## Phase 1 — Backend Infrastruktúra (API végpontok)

- [x] Task: n8n indító szerviz létrehozása
    - [x] `src/server/routes/services.ts` (vagy hasonló) létrehozása/bővítése.
    - [x] Express POST végpont az n8n indításához: parancs futtatása `f:\mcp-brunella-core\n8nv2` mappában.
    - [x] Háttérben futó folyamat (spawn) kezelése, logok rögzítése.
- [x] Task: Langflow indító szerviz létrehozása
    - [x] Express POST végpont a Langflow indításához (Docker parancs).
    - [x] Konténer állapot ellenőrzés indítás előtt.
- [x] Task: Conductor - User Manual Verification 'Phase 1 — Backend Infrastruktúra' (Protocol in workflow.md)

---

## Phase 2 — Dashboard Integráció (Frontend)

- [x] Task: Indító komponens fejlesztése
    - [x] Meglévő n8n/Langflow megosztott nézet (`src/dashboard/components/...`) megkeresése.
    - [x] "Start Services" gomb és állapotjelző (spinner, toast) hozzáadása.
- [x] Task: API bekötés
    - [x] A gomb összekapcsolása a Phase 1-ben létrehozott végpontokkal.
    - [x] Hibakezelés (pl. ha a Docker nem fut).
- [x] Task: Conductor - User Manual Verification 'Phase 2 — Dashboard Integráció' (Protocol in workflow.md)

---

## Phase 3 — Első Indítás és Finomhangolás

- [x] Task: Kulcsrakész setup implementálása
    - [x] `npm install` futtatása az n8n mappában az első indítás előtt, ha szükséges.
    - [x] Konfigurációs állományok (.env) meglétének ellenőrzése.
- [x] Task: End-to-End Tesztelés
    - [x] Gomb megnyomása a Dashboardon -> n8n és Langflow elindulásának verifikálása.
    - [x] UI visszajelzések ellenőrzése.
- [x] Task: Conductor - User Manual Verification 'Phase 3 — Első Indítás és Finomhangolás' (Protocol in workflow.md)
