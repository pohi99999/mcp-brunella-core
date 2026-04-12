# Track Spec: BAS Hook Infrastructure Upgrade

## Cél
A BAS meglévő hook rendszerének kiterjesztése az ügynökök életciklusára, a Git folyamatokra és az MCP eszközökre, az L5-ös autonómia szint elérése érdekében.

## Követelmények
1. **AgentHookEngine:** Központi motor az ügynök eseményekhez.
2. **BaseAgent Integration:** Minden ügynök automatikusan tüzeljen eseményeket (before, after, error).
3. **Pre-commit Track Guard:** Kötelező aktív track a fejlesztéshez.
4. **MCP Tool Wrapper:** Automatikus Golden Dataset naplózás minden eszközhívásnál.
5. **n8n & SDLC Hooks:** Eseményvezérelt fázisátmenetek és külső rendszer szinkron.

## Technikai Stack
- TypeScript (Core)
- Husky (Git Hooks)
- SQLite WAL (Event Store)
- Socket.IO (Dashboard updates)
