# Implementation Plan - CLI Verification

## Feladatok (Tasks)

### [ ] Task 1: Architektúra és Entry Point Audit
- **Cél:** Tisztázni a src/cli.ts vs uild/cli/index.js keveredést. A package.json bin beállításának javítása.
- **Ellenőrzés:** 
pm link vagy lokális futtatás tesztelése.

### [ ] Task 2: Conductor Parancsok Implementációjának Ellenőrzése
- **Cél:** Megvizsgálni, hogy a src/cli.ts-ben a /conductor parancsok csak "stub"-ok (helyőrzők) vagy valódi logikát hívnak-e.
- **Javítás:** Ha hiányzik, bekötni a Conductor logikát a CLI-be.

### [ ] Task 3: Core Funkciók Tesztje (Memory, Tools)
- **Cél:** runella memory show, runella run parancsok validálása.
- **Kimenet:** Teszt jelentés.

### [ ] Task 4: Dokumentáció (Toolskeszlet.md)
- **Cél:** A CLI parancsainak és a belső tooloknak a listázása a Toolskeszlet.md-ben egy külön szekcióként ("Brunella CLI Capabilities").
