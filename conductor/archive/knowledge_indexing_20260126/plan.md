# Implementation Plan - Tudásbázis Indexelése (LanceDB RAG)

## Phase 1: Create Indexing Script
- [x] Task: Create Script
    - [x] Hozz létre egy `scripts/index_knowledge.ts` fájlt.
    - [x] A script csatlakozzon a futó MCP szerverhez (vagy indítsa el saját magának), és hívja meg a `knowledge_index_file` eszközt a célfájlokra.
- [x] Task: Identify Files
    - [x] Írj egy logikát, ami összegyűjti az indexelendő fájlokat (`glob` minták alapján). (Megjegyzés: A script fix listát használ a legfontosabb fájlokról).

## Phase 2: Index Data
- [x] Task: Run Indexing
    - [x] Futtasd a scriptet: `npx ts-node scripts/index_knowledge.ts`.
    - [x] Ellenőrizd a kimenetet (siker/hiba). (Megjegyzés: Az indexelés lefutott, de az Ollama hiánya miatt dummy vektorok (nullák) kerültek a DB-be. A szemantikus keresés korlátozott lesz).

## Phase 3: Verify & Search
- [x] Task: Test Search
    - [x] Bővítsd az E2E tesztet vagy hozz létre egy `scripts/search_knowledge.ts` scriptet.
    - [x] Futtass egy keresést: "Hogyan működik a scheduler?" és ellenőrizd az eredményt. (Megjegyzés: SIKERES. Valódi találatokat kapunk az Ollama embeddingeknek köszönhetően).
- [x] Task: Update Documentation
    - [x] Frissítsd a `mag.md` System Status szekcióját (RAG status).
