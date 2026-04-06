# Implementációs Terv: Dashboard conductor monitor láthatósági javítás

## 📋 Fázisok

### 1. Fázis: Root cause megerősítés
- [x] Ellenőrizni, hogy a `ConductorTracksMonitor` komponens és a kapcsolódó API endpointok léteznek-e.
- [x] Azonosítani, hogy a sidebar navigációból miért hiányzik a menüpont.

### 2. Fázis: UI és navigáció javítás
- [x] A `conductor-monitor` elemet a projektmenedzsment sidebar csoportba felvenni.
- [x] A track-generáló és track-monitorozó menüpontok elnevezését egyértelműsíteni.
- [x] A monitor oldal fejlécét magyar nyelven megjeleníteni.

### 3. Fázis: Regresszióvédelem és validáció
- [x] Konfigurációs regressziós teszt hozzáadása a navigation registryhez.
- [x] `npm run build`
- [x] `npm run build:ui`
- [x] `npx vitest run --config vitest.dashboard.config.ts src/dashboard/lib/navigation.contract.test.ts`
- [x] `node build/cli.js conductor rescan`

## Notes
- A funkció nem hiányzott a kódbázisból; a sidebar group-konfigurációból maradt ki.
- A javítás célzott, a meglévő `ConductorTracksMonitor` komponens és a `/api/v1/tracks/monitor` backend megtartásával.