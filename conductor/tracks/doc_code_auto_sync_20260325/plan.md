# Plan — Documentation-Code Auto-Sync

## Status: ACTIVE | Priority: HIGH | Assignee: Copilot

## Leírás
Script ami kinyeri a tényleges számokat a kódból (agent count, route count, MCP tools, CLI commands) és validálja/frissíti a dokumentációs fájlokat. Megakadályozza az elavulást.

## Phase 1 — Sync script létrehozása
- [ ] `scripts/sync_doc_stats.ts` — Kódelemző script:
  - registry.json → agent count
  - src/server/routes/ → route modul count
  - src/tools/ → MCP tool count
  - src/cli/commands/ → CLI command count
  - src/dashboard/lib/navigation.tsx → dashboard panel count
- [ ] Célzott fájlok frissítése: README.md, BOOTSTRAP.md (3 példány), PROJEKT_DIAGRAM.md
- [ ] Dry-run mód (csak kiírja az eltéréseket, nem módosít)

## Phase 2 — CI integráció
- [ ] Pre-push hookba validáció (warn ha eltérés van)
- [ ] GitHub Actions step (opcionális)

## Definition of Done
- [ ] `npx tsx scripts/sync_doc_stats.ts --dry-run` mutatja az aktuális vs dokumentált számokat
- [ ] `npx tsx scripts/sync_doc_stats.ts` frissíti az összes doku fájlt
- [ ] Teszt: agent hozzáadása → script frissíti a számokat
