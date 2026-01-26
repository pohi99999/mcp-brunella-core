# Specification: CLI Rendszer Tesztelése és Validációja

## 1. Overview
A projekt tartalmaz egy parancssori interfészt (`src/cli.ts` -> `build/cli.js`), amelyet `brunella` parancsként lehet használni. Ez a track a CLI működésének ellenőrzését, esetleges hibáinak javítását és az alapvető parancsok (pl. help, status) tesztelését célozza.

## 2. Goals
- Annak ellenőrzése, hogy a `build/cli.js` futtatható-e Node.js környezetben.
- Tesztelni a főbb parancsokat:
    - `--help`: Súgó megjelenítése.
    - `agent list`: Ágensek listázása (ha implementálva van).
    - `status`: Rendszerállapot lekérdezése (ha implementálva van).
- Hibajavítás, ha a CLI nem működik.

## 3. Requirements
- **Execution:** A CLI-t a `node build/cli.js` paranccsal kell tudni futtatni.
- **Dependencies:** A CLI-nek megfelelően kell kezelnie a `commander` és egyéb függőségeket.
- **Environment:** A teszteknek Windows környezetben (PowerShell/CMD) is működniük kell.

## 4. Out of Scope
- Új CLI parancsok fejlesztése (csak a meglévők tesztelése és javítása).
- A CLI teljes újraírása.
