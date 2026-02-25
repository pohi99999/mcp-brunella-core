# Spec: Dashboard Teljes Stabilizálása

**Cél:** A Dashboardban tapasztalható instabilitás, a 'süket' gombok és a láthatóan nem működő funkciók okának teljes körű feltárása és javítása, hogy a felület egy megbízható, mérnöki pontosságú vezérlőpulttá váljon.

## Követelmények:
1.  **E2E Audit:** Egy automatizált teszt (`Playwright`) segítségével minden egyes menüpontot és aloldalt (27+ db) végig kell járni.
2.  **Funkcionális Teszt:** A tesztnek nem csak a vizuális megjelenést, hanem a gombok mögötti funkciók tényleges lefutását is ellenőriznie kell (pl. API hívás, státuszváltozás).
3.  **Hibafeltárás:** A tesztnek pontosan azonosítania kell a hibák forrását (pl. konzol hibaüzenetek, hálózati 4xx/5xx hibák, végtelen ciklusok).
4.  **Javítás:** A feltárt hibákat (pl. Rate Limit, hibás JSX, végtelen `useEffect` hurok) javítani kell a forráskódban.
5.  **Verifikáció:** A javítások után a teljes audit tesztnek sikeresen (PASS) le kell futnia.
