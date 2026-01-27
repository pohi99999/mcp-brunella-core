# Track: Brunella CLI – Gemini CLI szint (teljes paritás, Google-független)

## Állapot
- **Kész** (2026-01-27) – Paritás elérve, bővítményekkel és stabil MCP klienssel.

## Cél
- A Brunella CLI minden képességét a Gemini CLI szintjére hozni, Google-független módon, kiegészítve Conductor-integrációval, bővítményekkel, MCP watchdoggal és teljes teszteléssel.

## Megvalósított elemek
- Conductor parancsok bővítménybe szervezve; CLI indításkor extension discovery + activate.
- Extension lifecycle: `install`/`update`/`uninstall` után automatikus rediscover + `extension reload`.
- Új bővítmények: `jules` (smoke/scenario), `agents` (registry list/show), `github` (status/prs/checks/open).
- CLI parancsok: `tools`, `config add/update/remove`, `doctor --json`, ideiglenes `mcp:run` / `cli:run`.
- MCP kliens: timeoutos connect, healthCheck, reconnect, watchdog (`MCP_WATCHDOG_MS` env).
- Dashboard Tools: schema-alapú modális űrlap (boolean switch, enum select), badge/szűrő (GitHub/a2a/ADK/MCP/native), prioritás-sorrend.
- AnythingLLM integráció: `.env.local` minta (BASE_URL, WORKSPACE, API_KEY), smoke futás sikeres.
- Tesztelés: `npm test`, `test:unit:cli`, `test:cli`, `test:e2e`, `smoke` mind PASS; `test_prepare.cjs` CJS-re állítja a `test_build`-et.

## Függőségek / Kapcsolódások
- MCP szerver elérhetőség (watchdog).
- GitHub CLI (gh) + `GITHUB_TOKEN` a GitHub bővítményhez.
- AnythingLLM API/key + workspace slug.

## Következő lépések (javaslat)
- Extension lifecycle e2e teszt (install → reload → list).
- Watchdog profilozás nagyobb terhelés mellett; finom időzítés.
- Tools űrlap UX: default értékek, payload preview, jobb hibaüzenetek.

## Kockázatok
- Külső CLI-k (gh) hiánya esetén a GitHub bővítmény korlátozott.
- Hosszú futású MCP hívásoknál watchdog időzítés finomhangolást igényelhet.
