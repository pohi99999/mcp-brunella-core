# MCP Brunella Core - Fejlesztői Kézikönyv

> **Státusz:** Aktív Fejlesztés alatt
> **Verzió:** 2.0 (Alpha)

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
- **🤖 AI Ügynökök:** Különálló, specializált ügynökök (pl. Kutató, Fejlesztő) koordinálása.

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
├── myai/                    # 🐍 Python kiterjesztések rétege
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
# 1. Függőségek telepítése
npm install

# 2. Fejlesztői mód (Auto-reload)
npm run dev

# 3. Tesztek futtatása
npm test
```

A szerver alapértelmezetten a `3000`-es porton (Web UI) és stdio-n (MCP) kommunikál.

---

## Implementált Fejlesztések

Az alábbi rendszerek már működnek és használatra készek:

### 1. Strukturált Logging
Minden esemény JSON formátumban kerül naplózásra a `logs/` mappába. Használd a `Logger` osztályt (`src/utils/logger.ts`).

### 2. RAG Cache
A vektoros keresések eredményeit memóriában gyorsítótárazzuk. A statisztikák lekérhetők a `getRAGCacheStats()` függvénnyel.

### 3. Bővített Health Check
A rendszer induláskor és kérésre ellenőrzi a külső szolgáltatások (Ollama, Adatbázisok) elérhetőségét.

### 4. Konfiguráció Kezelés
A rendszer automatikusan felismeri a `brunella.config.json` vagy `.yaml` fájlokat.

---

## Hibaelhárítás (Troubleshooting)

### Gyakori Problémák

| Jelenség | Lehetséges Ok | Megoldás |
| :--- | :--- | :--- |
| **"Ollama connection failed"** | Az Ollama nem fut vagy rossz porton figyel. | Indítsd el az Ollama-t (`ollama serve`) és ellenőrizd a `checkSystemHealth()` kimenetet. |
| **"Failed to write log"** | Jogosultsági hiba a `logs/` mappában. | Töröld a `logs/` mappát vagy add meg a megfelelő írási jogot. |
| **"Build error (TypeScript)"** | Inkompatibilis típusok a `src/tools/` mappában. | Futtass egy tiszta buildet: `npm run clean && npm run build`. |

### Debug Mód
Ha részletesebb kimenetre van szükséged, állítsd a környezeti változót:
```bash
STRUCTURED_LOGGING=1 NO_COLOR=1 npm run dev
```

4. **Performance**
   - Connection pooling
   - Batch operations
   - Lazy loading

5. **Security**
   - Rate limiting
   - Authentication tokens
   - Audit logging

---

## Changelog

### 2024-01-20 - Fejlesztési Sprint

#### Hozzáadva
- ✅ Strukturált logging rendszer (JSON + plain text)
- ✅ YAML/JSON config fájl támogatás
- ✅ RAG cache optimalizálás (in-memory, 1h TTL)
- ✅ Bővített health check (szolgáltatások, workspace, cache)
- ✅ Jest teszt infrastruktúra
- ✅ Unit tesztek (Logger, AgentManager, Pipeline)
- ✅ Type safety javítások (`any` -> `unknown`)
- ✅ Konzisztens error handling
- ✅ Cache statisztikák és management API
- ✅ Config reload funkció

#### Javítva
- ✅ Web UI markdown formázási hiba
- ✅ .gitignore bővítése
- ✅ Config merge logika (precedencia rendszer)
- ✅ Error handling konzisztencia

#### Dokumentálva
- ✅ Workflow dokumentáció
- ✅ API dokumentáció alapok
- ✅ Konfigurációs példák

---

## Kapcsolat és Támogatás

### Fejlesztési Kérdések

Problémák vagy javaslatok esetén:
1. Ellenőrizd a dokumentációt
2. Nézd meg a health check eredményeket
3. Vizsgáld meg a log fájlokat
4. Futtass unit teszteket

### Log Fájlok Helye

- `logs/system_commands.log` - Rendszerparancsok
- `logs/agent-manager.log` - Agent műveletek
- `logs/pipeline.log` - Pipeline folyamatok
- `logs/web_ui.log` - Web UI események
- `logs/health_status.json` - Health check eredmények

---

**Utolsó frissítés:** 2026-01-20
Pohánka József Péter
