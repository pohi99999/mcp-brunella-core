# Implementation Plan - Docs & Infra Sync

## Feladatok (Tasks)

### [ ] Task 1: Könyvtárfa Feltérképezés
- **Cél:** konyvtarfa.md létrehozása a gyökérben.
- **Megvalósítás:** Egy Node.js script (scripts/generate_tree.mjs) írása, ami automatikusan generálja a fát és a leírásokat, így bármikor frissíthető.
- **Kimenet:** konyvtarfa.md, scripts/generate_tree.mjs.

### [ ] Task 2: GitHub Szinkronizáció
- **Cél:** A helyi változtatások kijuttatása a távoli repoba.
- **Lépések:** git status, git remote ellenőrzés, git push.
- **Kimenet:** Szinkronizált repo.

### [ ] Task 3: Eszközkészlet Leltár (Toolskeszlet.md)
- **Cél:** Minden elérhető MCP tool és erőforrás listázása.
- **Megvalósítás:** Script, ami kiolvassa a src/server/registry.ts-ből a regisztrált toolokat.
- **Kimenet:** Toolskeszlet.md.

### [ ] Task 4: Dokumentáció és Memória Frissítés
- **Cél:** README.md, mag.md és a rendszerpromtok (GEMINI.md) aktualizálása az új fájlokkal.
- **Kimenet:** Frissített markdown fájlok.

### [ ] Task 5: Start Script és Integráció
- **Cél:** start.bat okosítása.
- **Lépések:** Ellenőrizze, fut-e az Ollama és az AnythingLLM. Ha nem, indítsa el őket (vagy jelezze).
- **Kimenet:** Javított start.bat.
