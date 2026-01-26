# Implementation Plan - Tudásbázis Indexelése (LanceDB RAG)

## Phase 1: Create Indexing Script
- [ ] Task: Create Script
    - [ ] Hozz létre egy `scripts/index_knowledge.ts` fájlt.
    - [ ] A script csatlakozzon a futó MCP szerverhez (vagy indítsa el saját magának), és hívja meg a `knowledge_index_file` eszközt a célfájlokra.
- [ ] Task: Identify Files
    - [ ] Írj egy logikát, ami összegyűjti az indexelendő fájlokat (`glob` minták alapján).

## Phase 2: Index Data
- [ ] Task: Run Indexing
    - [ ] Futtasd a scriptet: `npx ts-node scripts/index_knowledge.ts`.
    - [ ] Ellenőrizd a kimenetet (siker/hiba).

## Phase 3: Verify & Search
- [ ] Task: Test Search
    - [ ] Bővítsd az E2E tesztet vagy hozz létre egy `scripts/search_knowledge.ts` scriptet.
    - [ ] Futtass egy keresést: "Hogyan működik a scheduler?" és ellenőrizd, hogy a találatok között szerepel-e a `mag.md` vagy a releváns conductor fájl.
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md` System Status szekcióját (RAG status).
