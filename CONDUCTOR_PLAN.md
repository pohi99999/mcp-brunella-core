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
- [ ] `playwright` telepítése
- [ ] `browser_navigate`: Teljes oldalbetöltés, JS futtatással.
- [ ] `browser_screenshot`: Képernyőkép készítése (base64).
- [ ] `browser_extract_text`: Tiszta szöveg kinyerése (readability mód).

### 2. Fázis: Security Hardening (No-Docker Sandbox)
- [ ] `vm2` telepítése
- [ ] Node.js interpreter átírása `VM` alapúra.
- [ ] Python interpreter izolálása (timeout, limitált env).

### 3. Fázis: Knowledge Tool Upgrade (Local RAG)
- [ ] `lancedb` és embedding lib telepítése.
- [ ] Indexelő modul írása (induláskor vagy on-demand).
- [ ] `knowledge_semantic_search` tool implementálása.

### 4. Fázis: Pipeline 2.0 (Self-Healing Agent)
- [ ] Pipeline logika átalakítása ciklikusra (Generate -> Test -> Fix -> Test).
- [ ] Hibavisszacsatolás az LLM-nek.

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
- [ ] Tesztelés és Dokumentálás

## Kész
A szerver lefordítva a `build` mappában található.
Indítás: `npm start` vagy `node build/index.js`.
