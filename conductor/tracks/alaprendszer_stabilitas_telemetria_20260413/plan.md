# Megvalósítási Terv: Alaprendszer Stabilitás és Telemetria Bővítése

## Fázis 1: Tervezés és Rendszeraudit
- [ ] Task: A jelenlegi naplózási (`utils/logger.ts`) és telemetriai (pl. LLM kliens) hívások auditálása.
- [ ] Task: Részletes terv elkészítése az új egészségügyi (`/api/health`) végpontokra vonatkozóan.
- [ ] Task: Tesztesetek specifikálása az EPP v2 protokoll alapján.

## Fázis 2: API és Backend Fejlesztés
- [ ] Task: Csonk-tesztek megírása az új telemetriai szolgáltatásokhoz.
- [ ] Task: A `logger.ts` kiterjesztése az események (events) kontextus-alapú naplózására.
- [ ] Task: Az Express.js backend (`server/routes/health.ts` vagy megfelelője) frissítése a kibővített telemetriával (pl. szolgáltatások és ágensek állapota).

## Fázis 3: UI és CLI Integráció (EPP v2 Compliance)
- [ ] Task: Tesztek írása a CLI és Dashboard komponensekhez.
- [ ] Task: A CLI kód (`cli.ts` / parancsok) módosítása a `brunella health` parancs vizuális megjelenítésének javítására (`chalk`, `boxen` használatával).
- [ ] Task: A React Dashboard (`SystemHealth` panel) kibővítése az új telemetriai adatok valós idejű (Socket.IO / API polling) megjelenítésére.

## Fázis 4: Validáció és Lezárás
- [ ] Task: A teljes rendszer futásának tesztelése (`npm test` futtatása 0 hibával).
- [ ] Task: Integrációs Build teszt (`npm run build`).
- [ ] Task: A Phoenix Protocol öngyógyító folyamatainak manuális tesztelése.
- [ ] Task: Dokumentáció frissítése (pl. `TEST_RESULTS.md`, naplók: `FOSZAL.md` és `gemini.md`).