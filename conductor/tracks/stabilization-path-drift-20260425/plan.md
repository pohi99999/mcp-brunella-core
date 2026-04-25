# Monorepo Path Drift Stabilizáció - végrehajtási terv

## Cél
A monorepo átrendezés utáni path drift megszüntetése úgy, hogy a `dashboard.bat`, a Node core, a Python backend, az MCP manifest, a dashboard és a gyors tesztkör újra konzisztensen működjön.

## Elvégzett munkacsomagok

### 1. Docs és ops script útvonalak
- `sync:docs`, doc stats, MCP sync/validate, health check és FOSZAL sync script root-feloldásának javítása az `ops/scripts` helyhez.
- Docs SOT útvonalak monorepo-kompatibilissé tétele.

### 2. MCP és dynamic agent path drift
- `mcp_servers.json` futtatható és platformfüggő pathjainak javítása.
- DynamicAgent TOML pathok `packages/myai/agents` alá igazítása.
- Agent registry build-kompatibilitási copy biztosítása `build/agents` irányba.

### 3. Dashboard browser-safe működés
- Node-only logger importok kiváltása dashboard-safe loggerrel.
- UI, Vite, Cypress és Vitest konfigurációk `apps/dashboard` struktúrához igazítása.
- `import.meta.env` használata browser runtime-ban a `process.env` helyett.

### 4. Runtime és teszt regressziók
- CLI circular import javítása `pythonShell.ts`-ben.
- TRIZ adatbetöltés és InnovationBridge delegáció javítása.
- Prometheus metrika duplikációk és teszt reset helper javítása.
- Memory context lookup workspace-határok közé szorítása.
- Conductor CLI `status` duplikált regisztrációjának megszüntetése.

### 5. Validáció
- `npm run build` zöld.
- `npm run build:ui` zöld.
- `npm run sync:docs` zöld.
- `npm run mcp:validate` zöld.
- CLI help smoke zöld.
- `npm run test:fast:raw` zöld: 426 passed / 1 skipped.
