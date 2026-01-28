# 🧠 MCP Brunella Core

Ez a Brunella Agent System (BAS) központi MCP szervere. Hibrid architektúrát valósít meg, amely ötvözi a Node.js alapú kiszolgálót, a Python alapú analitikát és a böngésző alapú adatgyűjtést.

## 📁 Struktúra és Dokumentáció

A projekt naprakész dokumentációja az alábbi automatikusan generált fájlokban található:

- **[🌳 Könyvtárfa (konyvtarfa.md)](./konyvtarfa.md):** A teljes fájlrendszer felépítése és leírása.
- **[🛠️ Eszközkészlet (Toolskeszlet.md)](./Toolskeszlet.md):** Az elérhető MCP eszközök és ágensek listája.
- **[🛤️ Fejlesztési Terv (conductor/tracks.md)](./conductor/tracks.md):** Aktív és lezárt fejlesztési szálak.

## 🚀 Indítás

A rendszer indítása a `start.bat` segítségével történik, amely automatikusan kezeli:
1.  Ollama szerver ellenőrzése/indítása.
2.  AnythingLLM ellenőrzése.
3.  MCP Szerver indítása (`npm start`).

## 🔧 Technológia

- **Nyelv:** TypeScript (Server), Python (Data Science).
- **Kommunikáció:** MCP (Model Context Protocol) stdio-n keresztül.
- **Adatbázis:** SQLite (better-sqlite3), LanceDB (Vector).
- **Ingestion:** Playwright, Python Refiner.

## 🤝 Hozzájárulás

Kérlek, kövesd a `conductor` mappában található protokollokat.