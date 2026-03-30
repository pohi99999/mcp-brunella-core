# Plan — Documentation-Code Auto-Sync

## Status: COMPLETED | Priority: HIGH | Assignee: Copilot

## Leírás

Script ami kinyeri a tényleges számokat a kódból (agent count, route count, MCP tools, CLI commands) és validálja/frissíti a dokumentációs fájlokat. Megakadályozza az elavulást.

## Phase 1 — Sync script létrehozása ✅

- [x] `scripts/sync_doc_stats.ts` — Kódelemző script:

  - registry.json → agent count
  - src/server/routes/ → route modul count
  - src/tools/ → MCP tool count
  - src/cli/commands/ → CLI command count
  - src/dashboard/lib/navigation.tsx → dashboard panel count

- [x] Célzott fájlok frissítése: README.md, BOOTSTRAP.md (3 példány), PROJEKT_DIAGRAM.md
- [x] Dry-run mód (csak kiírja az eltéréseket, nem módosít)

## Phase 2 — CI integráció ✅

- [x] Pre-push hookba validáció (warn ha eltérés van)
- [x] GitHub Actions step értékelve — jelenleg nem szükséges, a pre-push drift check védi a workflow-t

## Definition of Done

- [x] `npx tsx scripts/sync_doc_stats.ts --dry-run` mutatja az aktuális vs dokumentált számokat
- [x] `npx tsx scripts/sync_doc_stats.ts` frissíti az összes doku fájlt
- [x] Teszt: agent hozzáadása → script frissíti a számokat

## Validation

- [x] `npx vitest run test/sync_doc_stats.test.ts`
- [x] `.husky/pre-push` drift check bekötve
