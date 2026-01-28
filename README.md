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

## 🤝 Hozzájárulás
Kérlek, kövesd a `conductor` mappában található protokollokat és a `workflow.md`-t.
