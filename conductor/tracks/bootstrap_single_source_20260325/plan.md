# Plan — BOOTSTRAP.md Single Source

## Status: ACTIVE | Priority: HIGH | Assignee: Copilot

## Leírás
A BOOTSTRAP.md 3 másolatban létezik (.ai/, gyökér, .vscode/). Egyetlen forrás + automatikus másolás bevezetése.

## Phase 1 — Single source megvalósítás
- [ ] `.ai/BOOTSTRAP.md` kijelölése egyetlen forrásként
- [ ] `scripts/sync_bootstrap.ts` script: `.ai/BOOTSTRAP.md` → `BOOTSTRAP.md` + `.vscode/BOOTSTRAP.md`
- [ ] Build scriptbe (`package.json`) integrálás: `"sync:bootstrap": "tsx scripts/sync_bootstrap.ts"`

## Phase 2 — Automatikus szinkron
- [ ] Pre-commit hookba: BOOTSTRAP.md módosítás → auto-copy a másik 2 helyre
- [ ] Figyelmeztetés ha valaki a másolatot szerkeszti közvetlenül

## Definition of Done
- [ ] Egyetlen fájl szerkesztése → mindhárom példány szinkronban
- [ ] Teszt: `.ai/BOOTSTRAP.md` módosítás → script frissíti a másik kettőt
