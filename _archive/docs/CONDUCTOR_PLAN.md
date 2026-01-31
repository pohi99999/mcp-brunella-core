# MCP Brunella Core 2.0 - Advanced Upgrade Plan

## Cél
A szerver "okosítása", biztonságosabbá tétele és a böngészési képességek maximalizálása Docker nélkül, a felhasználó nagy teljesítményű hardverére (Ryzen 7, RTX 3060, 32GB RAM) optimalizálva.

## Technológiai Stack
- **Browser:** Playwright (Headless Chromium)
- **Security:** vm2 (Node.js sandbox), Python venv
- **RAG:** LanceDB + Ollama Embedding (vagy Xenova)
- **Pipeline:** Ciklikus, önjavító logika

## Implementációs Fázisok

### 1. Fázis: Browser Tool Upgrade (Playwright)
- [x] `playwright` telepítése
- [x] `browser_navigate`: Teljes oldalbetöltés, JS futtatással.
- [x] `browser_screenshot`: Képernyőkép készítése (base64).
- [x] `browser_extract_text`: Tiszta szöveg kinyerése (readability mód).

### 2. Fázis: Security Hardening (No-Docker Sandbox)
- [x] `vm2` telepítése
- [x] Node.js interpreter átírása `VM` alapúra.
- [x] Python interpreter izolálása (timeout, limitált env).

### 3. Fázis: Knowledge Tool Upgrade (Local RAG)
- [x] `lancedb` és embedding lib telepítése.
- [x] Indexelő modul írása (induláskor vagy on-demand).
- [x] `knowledge_semantic_search` tool implementálása.

### 4. Fázis: Pipeline 2.0 (Self-Healing Agent)
- [x] Pipeline logika átalakítása ciklikusra (Generate -> Test -> Fix -> Test).
- [x] Hibavisszacsatolás az LLM-nek.

## Eredeti Funkciók (Megtartva & Javítva)
- **workspace_tool**: Szigorított
- **system_tool**: Whitelistelt & Logolt
- **CLI Tools**: Copilot & Jules

## Státusz
- [x] 1. Fázis: Browser Tool (Playwright implementálva)
- [x] 2. Fázis: Security (vm2 implementálva, Python env korlátozva)
- [x] 3. Fázis: RAG (LanceDB alapú szemantikus keresés implementálva)
- [x] 4. Fázis: Pipeline (Self-healing ügynök logika implementálva)

## Kész
A szerver teljes mértékben frissítve a 2.0-ás verzióra.
- **Böngészés:** Playwright (fejlett).
- **Biztonság:** VM2 Sandbox.
- **Memória:** LanceDB RAG.
- **Intelligencia:** Önjavító Pipeline.

## Kiegészítések (2026-01)
- [x] Interpreter output limit + async Promise kezelés
- [x] AnythingLLM toolok (workspace list + chat)
- [x] AnythingLLM API key tamogatas
- [x] Agent registry JSON + strukturált agent list
- [x] Agent registry bovites + agent_registry tool
- [x] Smoke teszt script (MCP ping + AnythingLLM)
- [x] Web UI kapcsolo (WEB_UI_ENABLED / WEB_UI_PORT)
- [x] Build ellenőrzés (`tsc`)

## Tesztelés és Dokumentálás
- [x] MCP smoke teszt (ping)
- [ ] AnythingLLM smoke teszt (API key szukseges)
- [ ] End-to-end tesztek
- [x] Dokumentáció frissítve (README)

## Kész
A szerver lefordítva a `build` mappában található.
Indítás: `npm start` vagy `node build/index.js`.
