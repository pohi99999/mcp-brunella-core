# Plan — BOOTSTRAP.md Single Source

## Status: COMPLETED | Priority: HIGH | Assignee: Copilot

## Leírás

A BOOTSTRAP.md 3 másolatban létezik (.ai/, gyökér, .vscode/). Egyetlen forrás + automatikus másolás bevezetése.

## Phase 1 — Single source megvalósítás ✅

- [x] `.ai/BOOTSTRAP.md` kijelölése egyetlen forrásként
- [x] `scripts/sync_bootstrap.ts` script: `.ai/BOOTSTRAP.md` → `BOOTSTRAP.md` + `.vscode/BOOTSTRAP.md`
- [x] Package script integráció: `"sync:bootstrap": "tsx scripts/sync_bootstrap.ts"`

## Phase 2 — Automatikus szinkron ✅

- [x] Pre-commit hookba: BOOTSTRAP.md módosítás → auto-copy a másik 2 helyre
- [x] Figyelmeztetés ha valaki a másolatot szerkeszti közvetlenül

## Definition of Done

- [x] Egyetlen fájl szerkesztése → mindhárom példány szinkronban
- [x] Teszt: `.ai/BOOTSTRAP.md` módosítás → script frissíti a másik kettőt

## Validation

- [x] `npx vitest run test/sync_bootstrap.test.ts`
- [x] `.husky/pre-commit` auto-sync bekötve
