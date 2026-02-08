# Track: Dashboard Integration & Control Center

## Cél
A \localhost:3000\ címen futó Brunella Dashboard felokosítása, hogy valós idejű vezérlőpultként szolgáljon a BAS (Brunella Agent System) számára.

## Funkcionális Követelmények
1. **Rendszer Monitor:** CPU, Memória, Szerver Uptime valós idejű kijelzése.
2. **Ügynök Vezérlő (Swarm Control):**
   - Aktív ügynökök listázása (Kutató, Adattudós).
   - Feladatok delegálása gombnyomásra (pl. "Start Research").
   - Élő log-stream az ügynököktől.
3. **Eszköz Leltár (Tools Inventory):** A \Toolskeszlet.md\ vizuális megjelenítése és tesztelése a felületről.
4. **Folyamat Vizualizáció:** A \workflow.md\ és a státuszok megjelenítése.

## Technológia
- **Frontend:** React + Vite + Tailwind CSS + Shadcn/UI (ha elérhető).
- **Kommunikáció:** Socket.IO (kétirányú, valós idejű).
- **Backend:** \src/server/web.ts\ bővítése esemény-kibocsátókkal.
