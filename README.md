# 🧠 MCP Brunella Core

Ez a Brunella Agent System (BAS) központi MCP szervere és parancssori felülete. Hibrid architektúrát valósít meg, amely ötvözi a Node.js alapú kiszolgálót, a Python alapú analitikát és a böngésző alapú adatgyűjtést.

## 🌟 Újdonságok (2026.01.29)
- **Automatizált Indítás:** A `start.bat` egyetlen kattintással elindítja az Ollamát, AnythingLLM-et és a szervert.
- **Brunella CLI v2:** Beépített Conductor támogatás és javított memória-kezelés.
- **Swarm Ingestion:** Webes adatgyűjtés és tisztítás (Refiner) integrálva.

## 📁 Dokumentáció
A projekt élő dokumentációja:
- **[🌳 Könyvtárfa](./konyvtarfa.md):** Fájlszerkezet.
- **[🛠️ Eszközkészlet](./Toolskeszlet.md):** Elérhető MCP eszközök és CLI parancsok.
- **[📝 Változásnapló](./CHANGELOG.md):** Fejlesztési mérföldkövek.
- **[🛤️ Tervek](./conductor/tracks.md):** Aktív és lezárt fejlesztési szálak.

## 🚀 Használat

### Indítás
Futtasd a `start.bat` fájlt a gyökérkönyvtárban.

### CLI Parancsok
A `brunella` parancs használatával vezérelheted a rendszert:
```bash
brunella conductor status   # Projekt állapot lekérdezése
brunella memory list        # Memória fájlok listázása
brunella run <tool>         # MCP eszköz futtatása
brunella chat               # Chat az AI-val
```

## 🔧 Technológia
- **Core:** Node.js (TypeScript), Express, Socket.IO.
- **AI:** Ollama (Llama 3.1), AnythingLLM.
- **Automation:** Playwright, Python.
- **Protocol:** MCP (Model Context Protocol).

## ⚙️ Környezeti változók (válogatott)
| Változó | Leírás |
|--------|--------|
| `CORS_ORIGINS` | CORS whitelist (vesszővel elválasztva). Üres = `*` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit ablak (ms), alapértelmezett 60000 |
| `RATE_LIMIT_MAX_PER_WINDOW` | Kérések limit ablakonként, alapértelmezett 120 |
| `PIPELINE_SANDBOX_TIMEOUT_MS` | Pipeline subprocess timeout (ms), alapértelmezett 5000 |
| `HEALTH_OLLAMA_TIMEOUT_MS`, `HEALTH_OLLAMA_RETRIES` | Health check: Ollama timeout és retry |
| `HEALTH_ANYTHINGLLM_TIMEOUT_MS`, `HEALTH_ANYTHINGLLM_RETRIES` | Health check: AnythingLLM |
| `BRUNELLA_SKIP_SECRETS_CHECK` | `1` = kihagyja a titkok ellenőrzését induláskor |
| `ANYTHINGLLM_API_KEY`, `OLLAMA_BASE_URL` | Külső szolgáltatások (titkok ne kódba!) |

## 🤝 Hozzájárulás
Kérlek, kövesd a `conductor` mappában található protokollokat és a `workflow.md`-t.
