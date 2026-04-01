# Végrehajtási Terv: n8n és Langflow Indítás Automatizálása

**Track ID:** `service_launcher_20260401`
**Leírás:** n8n és Langflow szolgáltatások indítása a Dashboardról.

---

## Phase 1 — Backend Infrastruktúra (API végpontok)

- [ ] Task: n8n indító szerviz létrehozása
    - [ ] `src/server/routes/services.ts` (vagy hasonló) létrehozása/bővítése.
    - [ ] Express POST végpont az n8n indításához: parancs futtatása `f:\mcp-brunella-core\n8nv2` mappában.
    - [ ] Háttérben futó folyamat (spawn) kezelése, logok rögzítése.
- [ ] Task: Langflow indító szerviz létrehozása
    - [ ] Express POST végpont a Langflow indításához (Docker parancs).
    - [ ] Konténer állapot ellenőrzés indítás előtt.
- [ ] Task: Conductor - User Manual Verification 'Phase 1 — Backend Infrastruktúra' (Protocol in workflow.md)

---

## Phase 2 — Dashboard Integráció (Frontend)

- [ ] Task: Indító komponens fejlesztése
    - [ ] Meglévő n8n/Langflow megosztott nézet (`src/dashboard/components/...`) megkeresése.
    - [ ] "Start Services" gomb és állapotjelző (spinner, toast) hozzáadása.
- [ ] Task: API bekötés
    - [ ] A gomb összekapcsolása a Phase 1-ben létrehozott végpontokkal.
    - [ ] Hibakezelés (pl. ha a Docker nem fut).
- [ ] Task: Conductor - User Manual Verification 'Phase 2 — Dashboard Integráció' (Protocol in workflow.md)

---

## Phase 3 — Első Indítás és Finomhangolás

- [ ] Task: Kulcsrakész setup implementálása
    - [ ] `npm install` futtatása az n8n mappában az első indítás előtt, ha szükséges.
    - [ ] Konfigurációs állományok (.env) meglétének ellenőrzése.
- [ ] Task: End-to-End Tesztelés
    - [ ] Gomb megnyomása a Dashboardon -> n8n és Langflow elindulásának verifikálása.
    - [ ] UI visszajelzések ellenőrzése.
- [ ] Task: Conductor - User Manual Verification 'Phase 3 — Első Indítás és Finomhangolás' (Protocol in workflow.md)
