# Specification: Tudásbázis Indexelése (LanceDB RAG)

## 1. Overview
A Brunella Core rendszer rendelkezik egy LanceDB alapú RAG (Retrieval-Augmented Generation) képességgel (`knowledge_tool`), de jelenleg a tudásbázis valószínűleg üres. Ez a track a tudásbázis feltöltését célozza a projekt releváns dokumentumaival (`conductor/*.md`, `README.md`, és opcionálisan a `01_CONTEXT` mappa, ha elérhető).

## 2. Goals
- Indexelő script (`scripts/index_knowledge.ts`) létrehozása.
- A scriptnek képesnek kell lennie egy adott könyvtár bejárására és a támogatott fájlok (.md, .txt) indexelésére a `knowledge_index_file` eszközön keresztül.
- A projekt alapdokumentációjának indexelése.
- A keresés verifikálása (`knowledge_search`).

## 3. Requirements
- **Indexer Script:**
    - Node.js alapú (TypeScript).
    - Használja az MCP SDK-t vagy közvetlenül a `knowledge.ts` logikáját (preferált az MCP hívás a konzisztencia miatt).
- **Target Files:**
    - `README.md`
    - `conductor/product.md`
    - `conductor/tech-stack.md`
    - `mag.md`
    - `INTEGRATION_PLAN.md`
- **Verification:**
    - Sikeres indexelés után egy releváns keresésnek (pl. "Mi a tech stack?") vissza kell adnia a megfelelő kontextust.

## 4. Out of Scope
- PDF vagy Word dokumentumok indexelése (egyelőre csak szöveges fájlok).
- Az indexelés automatikus futtatása minden fájlmentéskor (watch mode).
