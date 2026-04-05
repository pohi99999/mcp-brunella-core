# Implementációs Terv: Error Handling Implementation

## Problem
A repo hátralévő, magas prioritású hibakezelési útvonalain egységesíteni kell a `catch (e: any)` / silent `catch {}` mintákat a már bevezetett `ensureError()` helperre támaszkodva. A CLI, tools és server részek kész; az agents szakasz maradt.

## Approach
1. Phase 1: CLI felszínek.
   - `src/cli.ts`
   - `src/cli-jules-interactive.ts`
   - `src/cli/tracksCommands.ts`
   - `src/cli/taskCommands.ts`
   - `src/cli/robotkezCommands.ts`
   - `src/cli/devCommands.ts`
2. Phase 2: Tools és shell/integrációs réteg.
3. Phase 3: Server core és legacy control-surface modulok.
4. Phase 4: Agents + végső verifikáció.

## Todos
1. CLI error handling cleanup.
2. Tool/integration error handling cleanup.
3. Server core error handling cleanup.
4. Agent error handling cleanup.
5. Build + targeted validation.

## Notes
- Reuse `src/utils/ensureError.ts` instead of adding a second helper.
- Preserve current behavior and exit codes.
- Keep the route-layer cleanup intact; this track continues from the design track, not from a reset.
- Server cleanup is complete; agents cleanup is next.
