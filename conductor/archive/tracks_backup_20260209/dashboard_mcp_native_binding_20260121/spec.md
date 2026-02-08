# Specifikáció: Dashboard MCP Natív Összekapcsolás

## Áttekintés
Ez a fejlesztési ág (track) a Dashboard frontend (React/Vite) és a Brunella Core backend közötti kommunikáció teljes megújítását célozza. A korábbi szimulált (mock) adatokat és statikus megoldásokat egy natív, Model Context Protocol (MCP) alapú WebSocket kapcsolatra cseréljük. Ez lehetővé teszi a valós idejű interakciót, az eszközök közvetlen futtatását és a rendszer folyamatos felügyeletét.

## Funkcionális követelmények
- **Natív MCP kommunikáció:** A Dashboard-nak képesnek kell lennie WebSocket-en keresztül MCP-kompatibilis JSON-RPC üzenetek küldésére és fogadására.
- **useMCP() React Hook:** Egy központi hook létrehozása, amely kezeli a WebSocket életciklusát (csatlakozás, bontás, újrakapcsolódás), és egyszerű interfészt biztosít a többi komponens számára.
- **Eszközfelfedezés és futtatás (Tool Discovery & Execution):**
    - Az összes elérhető MCP eszköz automatikus lekérése a szervertől.
    - Dinamikus felhasználói felület generálása az eszközök paramétereinek megadásához.
    - A futtatási eredmények (szöveg, kép, strukturált adatok) strukturált megjelenítése.
- **Erőforrás streamelés:** A `system_get_logs` (naplók) és `monitor_get_metrics` (metrikák) típusú adatok folyamatos, aszinkron továbbítása a felületre.
- **Valós idejű értesítések:** A szerver által küldött állapotváltozások és rendszerszintű üzenetek azonnali kijelzése.
- **Kezdeti hitelesítés:** API kulcs (API Key / Bearer Token) alapú azonosítás implementálása a WebSocket kézfogás (handshake) során.

## Nem-funkcionális követelmények
- **Állapotkezelés:** Az MCP-vel kapcsolatos állapotokat (kapcsolat állapota, eszközök listája, futtatási előzmények) **Zustand** segítségével tároljuk a globális elérhetőség és a gyors frissülés érdekében.
- **Késleltetés:** A WebSocket használatával az eszközhívások többletterhelésének (overhead) minimálisnak kell lennie (<100ms).
- **Skálázhatóság:** A rendszert úgy kell kialakítani, hogy később könnyen átállítható legyen a teljes OAuth 2.1 alapú jogosultságkezelésre.

## Elfogadási kritériumok
- [ ] A Dashboard sikeresen felépíti a WebSocket kapcsolatot a Core szerverrel.
- [ ] A `useMCP()` hook hiba nélkül lekéri és listázza a szerver összes elérhető eszközét.
- [ ] Legalább egy konkrét eszköz (pl. `monitor_get_metrics`) sikeresen indítható a UI-ról, és az eredménye helyesen megjelenik.
- [ ] A rendszernaplók (logs) valós időben, külső szimuláció nélkül frissülnek a Dashboard-on.
- [ ] Érvénytelen API kulcs megadása esetén a szerver elutasítja a kapcsolatot, és a Dashboard erről tájékoztatja a felhasználót.

## Hatókörön kívül (Out of Scope)
- Az OAuth 2.1 teljes körű implementációja (ez egy későbbi fázis feladata).
- A CLI (myai) leváltása saját CLI-re (külön track).
- Az egykattintásos telepítőrendszer kiépítése (külön track).
