# Implementation Plan: BAS Hook Infrastructure Upgrade

## Fázisok

### 1. Fázis: Architect (Hook Engine Design)
- [ ] Task: `src/core/agentHookEngine.ts` implementálása a megadott minta alapján.
- [ ] Task: `src/agents/BaseAgent.ts` módosítása az életciklus hookok beépítéséhez.
- [ ] Task: Conductor - User Manual Verification '1. Fázis: Architect'

### 2. Fázis: DevOps (Git & Husky Guard)
- [ ] Task: `scripts/sync/precommit-track-guard.mts` létrehozása.
- [ ] Task: `.husky/pre-commit` bővítése az új guard-dal.
- [ ] Task: Conductor - User Manual Verification '2. Fázis: DevOps'

### 3. Fázis: Coder (MCP & n8n Integration)
- [ ] Task: `src/core/mcpToolHook.ts` implementálása és a tool wrapping elvégzése.
- [ ] Task: `src/server/routes/webhookHooks.ts` létrehozása n8n visszacsatoláshoz.
- [ ] Task: `src/core/sdlcHooks.ts` minőségkapuk beépítése.
- [ ] Task: Conductor - User Manual Verification '3. Fázis: Coder'

### 4. Fázis: QA (Validation)
- [ ] Task: Unit tesztek az összes új hook típushoz.
- [ ] Task: End-to-end teszt: Számla beérkezés -> Hook -> Dashboard megjelenés.
- [ ] Task: Conductor - User Manual Verification '4. Fázis: QA'
