# Plan — Agent Legacy Migration Audit (P4)

## Goal
src/agents legacy fa állapotának feltárása a packages/agents kanonikus fához képest.

## Steps (audit-only)
1. ✅ Fájlszámlálás: packages/agents 129 .ts vs src/agents 122 .ts
2. ✅ Canonical proof: package.json `build:raw` script `cp packages/agents/registry.json build/...` → packages a forrás
3. ✅ src/index.ts orphan státusz megerősítése (package.json main=build/apps/mcp-core/index.js)
4. ✅ Independent layers azonosítása (myai/agents/ TOML, .github/agents/ Copilot subagent)
5. ✅ Findings dokumentum: docs/audits/legacy-drift-followups-20260429.md (P4 fejezet)
6. ✅ Track lezárás (status: completed, audit-only)

## Out of scope
- src/agents/ + src/index.ts tényleges törlése (HIGH risk → user approval)
- 7-fájl divergencia analízis (packages 129 vs src 122) — git log alapú deep-dive következő track

## Result
A `packages/agents/` a **kanonikus** registry source (build pipeline innen másol). A `src/agents/` 122 fájllal **orphan legacy fa** — IDE auto-import zavart okozhat, de a build-be nem kerül bele. A `myai/agents/` (Python TOML DynamicAgent) és `.github/agents/` (Copilot .agent.md) **független rétegek** — érintetlenek maradnak. Cleanup szükséges, de user approval kell a HIGH risk miatt.
