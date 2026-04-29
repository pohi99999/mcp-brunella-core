# Plan — Dashboard Route Health Audit (P2)

## Goal
A 109 unique mount point + dashboard apiService kvantitatív feltérképezése, dead-code orphan azonosítás.

## Steps (audit-only)
1. ✅ apps/dashboard/lib/apiService.ts mérése (4313 sor, 93 konstans, 0 direkt fetch)
2. ✅ apps/mcp-core/server/routes/ vs src/server/routes/ diff (94+100, 94 közös, 6 orphan)
3. ✅ Orphan listázás (chaos, crmFollowUp, planetMesh, prometheus, tenants, webhookHooks)
4. ✅ Findings dokumentum: docs/audits/legacy-drift-followups-20260429.md (P2 fejezet)
5. ✅ Track lezárás (status: completed, audit-only)

## Out of scope
- Tényleges fájl törlés (HIGH risk → user approval szükséges)
- 6 orphan route migráció (`grep` import-elemzés a következő track feladata)

## Result
A dashboard apiService **clean architectura** — 0 direkt fetch, 100% URL konstans alapú. A routes oldalon **194 fájlnyi duplikáció** van: 94 azonos a két fa között, 6 orphan a legacy src-ben. A duplikáció a **monorepo refaktor befejezetlenségéből** ered.
