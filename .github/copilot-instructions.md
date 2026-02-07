# Brunella Agent System (BAS) - Copilot Instructions

You are an expert AI developer working on the BAS project.
**Core Philosophy:** Glass Box (transparency) & Phoenix Protocol (self-healing).

## Project Structure Awareness
- **Truth Source:** `README.md` is the master doc. `conductor/tracks.md` governs active tasks.
- **Agents:** Located in `src/agents/`. New agents must follow the `BaseAgent` pattern.
- **Hybrid Core:** Node.js (Orchestrator) communicates with Python (`myai/`) via HTTP/Socket.IO.

## Coding Rules
1. **Spec-Driven:** Never write complex code without checking the relevant `conductor/tracks/.../spec.md`.
2. **Type Safety:** Use strict TypeScript. No `any`.
3. **Logs:** Use `src/utils/logger.ts`, NEVER `console.log`.
4. **Tests:** Always suggest a Vitest test case for new logic.

## Agent Mode Behavior
- When asked to "fix", always run `npm test` after changes.
- If editing `mcp_servers.json`, warn about restarting the MCP client.

## Permission System (KRITIKUS!)
- **Minden agent permission-ellenőrzésen megy keresztül** (`src/agents/permissions.ts`)
- **Tool permission check:** MCP tool-ok ellenőrzik az agent jogosultságokat (`src/tools/toolPermissions.ts`)
- **Developer agent:** `src/**`, `test/**` - kód írás
- **Robotkez agent:** `data/**` - böngésző automatizáció, adat legyűjtés
- **SpecWriter agent:** `conductor/**` - spec generálás
- **Researcher agent:** read-only - kutatás, információ gyűjtés
- **Evaluator agent:** read-only + teszt futtatás - audit

## Spec Freeze Protocol
- **SOHA ne írj komplex kódot jóváhagyott spec nélkül!**
- Ha nincs `conductor/tracks/<feature>/spec.md`, ELŐSZÖR a SpecWriterAgent-et hívd meg
- Spec státuszok: `pending_approval` → `approved` → implementation kezdődhet

## Phoenix Protocol (Self-Healing)
- Build fail = STOP, javítsd azonnal
- Test fail = STOP, debuggold
- Agent error = checkpoint + git sync
- CI green = deployment OK

## Quick Commands
```bash
npm run build          # 0 error legyen MINDIG
npm test               # PASS kell MINDEN commit előtt
brunella conductor status
```

## MCP Tool Usage
- **browser_navigate**, **harvest_scenario**: Robotkez agent only
- **sqlite_query**: Developer, Researcher, Evaluator
- **sqlite_execute**: Developer only
- **write_file**: Agent-specific path restrictions érvényesek!

## Anti-Patterns
- ❌ Spec nélkül kódolás
- ❌ `any` type használata
- ❌ `console.log()` production kódban
- ❌ Permission check bypass (kivéve tesztekben)
- ❌ `conductor/tracks.md` manuális szerkesztése

---

**Mindig kérdezz vissza, ha nem világos a spec vagy a permission követelmény!**
