# Terv: Dashboard Stabilizálás

1.  **Feltárás (Diagnózis)**
    *   [x] `dashboard_full_audit.e2e.test.ts` létrehozása a teljes UI tesztelésére.
    *   [x] Első futtatás: 26/26 hiba azonosítása (UI fagyás, konzol hibák).
    *   [x] Gyökérokok azonosítása: `button-in-button` hiba, `duplicate key` hiba, `dialog-overlay` takarás, `429 Too Many Requests`.

2.  **Javítás (Gyógyítás)**
    *   [x] `JulesPanel.tsx` javítása: beágyazott gomb hiba megszüntetése.
    *   [x] `JulesPanel.tsx` javítása: duplikált kulcsok javítása index-alapú fallbackkel.
    *   [x] Teszt szkript módosítása: `Escape` billentyű lenyomása az overlay bezárásához.
    *   [x] `src/server/middleware.ts`: Rate limit megemelése 120-ról 2000-re.
    *   [x] Backend újraindítása az új limittel.
    *   [x] `DeveloperPanel.tsx` javítása: `useEffect` végtelen ciklusok megszüntetése a függőségi láncok optimalizálásával.
    *   [x] Tesztek frissítése a kódváltozásoknak megfelelően.

3.  **Verifikáció (Ellenőrzés)**
    *   [x] Célzott teszt futtatása a javított komponensekre: SIKER.
    *   [x] Teljes, 27 oldalas audit újrafuttatása: SIKER.
    *   [x] A rendszer stabilitásának megállapítása.
