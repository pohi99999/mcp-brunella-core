# Specifikáció: Monorepo stabilizáció és path drift javítás

## Cél
A Brunella Agent System monorepo átrendezése után visszamaradt útvonal-elcsúszások megszüntetése, a `dashboard.bat` teljes indítási láncának stabilizálása, valamint a dashboard/CLI/build/fast tesztkör zöld állapotának helyreállítása.

## Érintett területek
- **Indítás:** `dashboard.bat`, `package.json` dev/build scriptjei.
- **Ops/docs:** `ops/scripts/*`, docs config SOT, FOSZAL sync.
- **MCP:** `mcp_servers.json`, MCP sync/validate script root-feloldás.
- **Agensek:** DynamicAgent TOML pathok, build registry kompatibilitás.
- **Dashboard:** browser-safe logger, Vite/Vitest/Cypress configok, UI importok.
- **Runtime:** CLI importciklus, TRIZ adatbetöltés, metrika reset, memory context lookup.
- **Teszt:** monorepo resolver kompatibilitás és regressziós tesztek.

## Elvárt viselkedés
1. `dashboard.bat` nem áll meg hiányzó opcionális komponensen, és a fő háttérfolyamatokat elindítja.
2. A dashboard nem importál Node-only modult böngésző runtime-ban.
3. A docs/MCP/agent útvonalak a monorepo aktuális struktúrájára mutatnak.
4. A CLI help és Conductor parancsok nem omlanak össze duplikált regisztráció vagy importciklus miatt.
5. A gyors regressziós tesztkör zöld.

## Validációs bizonyíték
- `npm run build`
- `npm run build:ui`
- `npm run sync:docs`
- `npm run mcp:validate`
- `node build\\apps\\mcp-core\\cli.js --help`
- `npx vitest run tests/test/conductorCommands.test.ts`
- `npm run test:fast:raw` -> 426 passed / 1 skipped
