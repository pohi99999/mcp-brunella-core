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
- [ ] Ellenőrizni van-e már `.vscode/tasks.json`
- [ ] Build task hozzáadása:
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
- [ ] `npm run build` task (egyszeri, manuális trigger)
- [ ] `npm run test:fast` task (pre-commit gyors check)

### 2. Fázis: Launch konfiguráció (30 perc)
- [ ] `.vscode/launch.json` — debug konfigurációk a fő szerverhez
- [ ] Attach to running process (port 3000)

### 3. Fázis: Problem Matcher (30 perc)
- [ ] TypeScript hibák automatikus megjelenése Problems panelben
- [ ] ESLint hibák integrálása

## Elfogadási Kritérium
- VSCode megnyitáskor automatikusan elindul a TypeScript build watch
- Build hibák megjelennek a Problems panelben
- `Ctrl+Shift+B` → manual build trigger

## Érintett Fájlok
- `.vscode/tasks.json` (létrehozás vagy módosítás)
- `.vscode/launch.json` (opcionális, debug)
