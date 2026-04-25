
### 2026-04-25 15:15 - Monorepo path drift stabilization
**Feladat:** Egy stabilizációs körben javítottam a monorepo path drift fő blokkolóit: ops/scripts docs sync, DynamicAgent TOML útvonalak, MCP manifest pathok, dashboard browser-safe importok, build registry copy, TRIZ adatbetöltés, CRM follow-up route és fast-suite resolver kompatibilitás.
**Érintett fájlok:** `package.json`, `dashboard.bat`, `mcp_servers.json`, `ops/scripts/*`, `apps/dashboard/*`, `apps/mcp-core/conductorCommands.ts`, `apps/mcp-core/server/routes/crm.ts`, `src/agents/registry.json`, `src/agents/AgentArchitect.ts`, `packages/agents/InnovationBridgeAgent.ts`, `packages/utils/*`, `vitest.config.ts`, `tests/test/*`, `README.md`
**Státusz:** ✅ Befejezve
**Megjegyzés:** Validáció: `npm run build`, `npm run build:ui`, `npm run sync:docs`, `npm run mcp:validate`, CLI help smoke és teljes `npm run test:fast:raw` zöld (427 passed / 1 skipped). A CLI duplikált conductor status regresszió célteszttel és CLI smoke-kal javítva lett. A `src/` mappa git integritása helyreállítva (korábbi törlés visszavonva). (Gemini)
