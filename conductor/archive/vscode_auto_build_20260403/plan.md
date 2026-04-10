# VSCode Auto-Build Task Track

## Cél

`.vscode/tasks.json` létrehozása/frissítése automatikus TypeScript build trigger-rel, hogy fájlmentéskor vagy terminál megnyitáskor a build automatikusan elinduljon.

## Probléma

- Jelenleg manuálisan kell `npm run build` futtatni minden TypeScript változtatás után
- VSCode nem jelzi automatikusan a build hibákat a Problems panelben
- `npm run dev` (ts-node watch) van, de a build artefakt (`build/`) nem frissül automatikusan
- Copilot/Claude a `build/` mappát olvassa MCP tool-okon keresztül → elavult kód futhat

## Megoldási Terv

### 1. Fázis: tasks.json konfiguráció (1 óra)

- [x] Ellenőrizni van-e már `.vscode/tasks.json`
- [x] Build task hozzáadása:

  ```json
  {
    "label": "TypeScript Build Watch",
    "type": "npm",
    "script": "build",
    "group": "build",
    "isBackground": true,
    "problemMatcher": "$tsc-watch",
    "runOptions": { "runOn": "folderOpen" }
  }
  ```

- [x] `npm run build` task (egyszeri, manuális trigger)
- [x] `npm run test:fast` task (pre-commit gyors check)

### 2. Fázis: Launch konfiguráció (30 perc)

- [x] `.vscode/launch.json` — debug konfigurációk a fő szerverhez
- [x] Attach konfiguráció a fő Node szerverhez (`9229` inspector port)

### 3. Fázis: Problem Matcher (30 perc)

- [x] TypeScript hibák automatikus megjelenése Problems panelben
- [x] ESLint hibák integrálása

## Elfogadási Kritérium

- VSCode megnyitáskor automatikusan elindul a TypeScript build watch
- Build hibák megjelennek a Problems panelben
- `Ctrl+Shift+B` → manual build trigger
- `test:fast` külön taskként elérhető
- A fő Brunella Core szerverhez van dedikált debug-start és attach konfiguráció

## Érintett Fájlok

- `.vscode/tasks.json` (létrehozás vagy módosítás)
- `.vscode/launch.json` (opcionális, debug)
