# MCP Brunella Core - Fejlesztői Kézikönyv

> **Státusz:** Aktív Fejlesztés alatt (Production Ready Alpha)
> **Verzió:** 2.1 (Gemini-fication Update)

## Tartalomjegyzék

1. [Bevezetés](#bevezetés)
2. [Szigorú Szabályok (Workflow)](#szigorú-szabályok-workflow)
3. [Architektúra](#architektúra)
4. [Kezdő lépések](#kezdő-lépések)
5. [Implementált Fejlesztések](#implementált-fejlesztések)
6. [Hibaelhárítás (Troubleshooting)](#hibaelhárítás-troubleshooting)

---

## Bevezetés

A **MCP Brunella Core** a "Cogella" ökoszisztéma központi eleme. Ez egy Model Context Protocol (MCP) szerver, amely hidat képez a helyi eszközök (Fájlrendszer, Adatbázis, Böngésző) és az AI modellek között.

### Alapvető Képességek
- **📁 Workspace Kezelés:** Biztonságos fájlrendszer hozzáférés.
- **🧠 Tudásbázis (RAG):** LanceDB alapú vektoros keresés dokumentumokban.
- **🌐 Böngészés:** Playwright alapú headless böngésző.
- **🤖 AI Ügynökök:** Különálló, specializált ügynökök (pl. Kutató, Fejlesztő, Auditor) koordinálása.
- **💻 Gemini CLI:** Fejlett parancssori felület (Chat, Interaktív menü, Doctor).

---

## Szigorú Szabályok (Workflow)

⚠️ **FIGYELEM:** A fejlesztési folyamat lépéseit, a minőségbiztosítási kapukat és a Git munkafolyamatot a `conductor/` mappa tartalmazza. Ezek a szabályok kötelező érvényűek.

- **📜 Működési Szabályzat:** [conductor/workflow.md](./conductor/workflow.md) (TDD, Commitok, Definition of Done)
- **🛠 Technológiai Stack:** [conductor/tech-stack.md](./conductor/tech-stack.md) (Engedélyezett technológiák)
- **🛤 Fejlesztési Szálak:** [conductor/tracks.md](./conductor/tracks.md) (Projekt állapota)

---

## Architektúra

```
mcp-brunella-core/
├── src/
│   ├── agents/              # 🤖 Agent Rendszer (Koordináció)
│   ├── config/              # ⚙️ Konfiguráció betöltő (JSON/YAML)
│   ├── pipeline/            # 🔄 Self-healing kódgeneráló pipeline
│   ├── server/              # 🔌 Express + Socket.IO Endpointok
│   ├── tools/               # 🛠 MCP Eszköz implementációk
│   └── utils/               # 🧰 Segédkönyvtárak (Logger, RAG, DB)
├── myai/                    # 🐍 Python API Szerver (FastAPI)
└── logs/                    # 📋 Strukturált naplófájlok
```

---

## Kezdő lépések

### Követelmények

- **Node.js** 20+
- **Python** 3.10+ (a Python réteghez)
- **Ollama** futtatása lokálisan (alapértelmezett porton)

### Telepítés és Indítás

```bash
# 1. Automatikus indítás (Ajánlott)
start.bat

# 2. VAGY Manuális fejlesztői mód
npm install
npm run build
npm start
```

### CLI Használat

```bash
# Interaktív menü
npm run cli

# Chat mód
npm run cli chat

# Diagnosztika
npm run cli doctor
```

---

## Implementált Fejlesztések

Az alábbi rendszerek már működnek és használatra készek:

### 1. Strukturált Logging
Minden esemény JSON formátumban kerül naplózásra a `logs/` mappába. Használd a `Logger` osztályt (`src/utils/logger.ts`).

### 2. RAG Cache
A vektoros keresések eredményeit memóriában gyorsítótárazzuk. A statisztikák lekérhetők a `getRAGCacheStats()` függvénnyel.

### 3. Bővített Health Check
A rendszer induláskor és kérésre ellenőrzi a külső szolgáltatások (Ollama, Adatbázisok) elérhetőségét.

### 4. Swagger UI (Új!)
Az API dokumentáció elérhető a `/api-docs` végponton (amikor a szerver fut).

### 5. Python API (Új!)
A `myai` mappa egy önálló FastAPI szervert tartalmaz a gyors Python kód futtatásához.

---

## Hibaelhárítás (Troubleshooting)

### Gyakori Problémák

| Jelenség | Lehetséges Ok | Megoldás |
| :--- | :--- | :--- |
| **"Ollama connection failed"** | Az Ollama nem fut vagy rossz porton figyel. | Indítsd el az Ollama-t (`ollama serve`) és ellenőrizd a `checkSystemHealth()` kimenetet. |
| **"Failed to write log"** | Jogosultsági hiba a `logs/` mappában. | Töröld a `logs/` mappát vagy add meg a megfelelő írási jogot. |
| **"Session not found" (CLI)** | Hálózati hiba SSE kapcsolatnál. | A CLI automatikusan átvált `stdio` módba, használd az `npm run cli`-t. |

### Debug Mód
Ha részletesebb kimenetre van szükséged, állítsd a környezeti változót:
```bash
STRUCTURED_LOGGING=1 NO_COLOR=1 npm run dev
```

---

**Utolsó frissítés:** 2026-01-30