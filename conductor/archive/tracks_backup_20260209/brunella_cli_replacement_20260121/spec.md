# Specifikáció: Brunella CLI Megvalósítás

## Áttekintés
Ez a fejlesztési ág a Gemini CLI teljes kiváltását célozza egy saját, a Brunella Core-hoz optimalizált parancssori felülettel. A CLI natív MCP kommunikációt használ, és képes automatikusan felfedezni a futó szervert, vagy szükség esetén elindítani azt.

## Funkcionális követelmények
- **Alaptechnológia:** Node.js környezet, a parancsok kezelésére a **Commander.js** könyvtárat használjuk.
- **Hibrid kapcsolódás:** 
    - Elsődlegesen megpróbál csatlakozni a már futó Core szerverhez (WebSocket/SSE).
    - Ha nem érhető el szerver, elindítja a Core-t háttérfolyamatként.
- **Parancskészlet:**
    - `brunella chat`: Interaktív beszélgetés az alapértelmezett ágenssel.
    - `brunella tools`: Az elérhető MCP eszközök listázása (táblázatos és JSON formátumban).
    - `brunella run <tool> [params]`: Egy adott MCP eszköz közvetlen futtatása.
    - `brunella agents`: Az aktív és tervezett ágensek kezelése.
- **Kimeneti formátumok:**
    - Színes, formázott szöveges kimenet az emberi olvashatóságért.
    - Táblázatos nézet a listákhoz.
    - Nyers JSON kimenet `--json` kapcsolóval.
    - Markdown támogatás az LLM válaszok megjelenítéséhez a terminálban.
- **Konfiguráció:** Globális beállítások tárolása a `~/.brunella/settings.json` fájlban.

## Nem-funkcionális követelmények
- **Gyorsaság:** A parancsok indítási ideje és a szerverrel való kapcsolatfelvétel minimális késleltetéssel kell, hogy történjen.
- **Robusztusság:** Világos hibaüzenetek, ha a szerver nem indul el vagy a kapcsolat megszakad.
- **Fejleszthetőség:** Moduláris parancsszerkezet az új funkciók könnyű hozzáadásához.

## Elfogadási kritériumok
- [ ] A `brunella` parancs globálisan elérhető a rendszerben.
- [ ] A CLI sikeresen csatlakozik a futó Core szerverhez és le tudja kérdezni az eszközök listáját.
- [ ] A `brunella chat` parancs során az LLM válaszai helyesen, Markdown formázással jelennek meg.
- [ ] A `--json` kapcsoló minden listázó parancsnál érvényes JSON-t ad vissza.
- [ ] Sikeres eszközfuttatás (pl. `brunella run ping`) a terminálból.

## Hatókörön kívül
- A grafikus Dashboard funkcióinak implementálása (ez marad a webes felületen).
- Az automatikus installer build (következő track).
