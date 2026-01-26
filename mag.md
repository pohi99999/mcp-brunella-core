# MAG - MCP Brunella Core Központi Dokumentáció

## Project Overview
Az MCP Brunella Core a Brunella rendszer központi MCP szervere, amely biztonságos hozzáférést biztosít a fájlrendszerhez, tudásbázishoz, rendszerparancsokhoz és webes tartalmakhoz. Támogatja az AI ágensek integrációját és valós idejű monitorozását.

## Technical Architecture
- **Monorepo szerkezet:** Node.js (TypeScript) szerver és React dashboard.
- **Backend:** Express.js, MCP SDK, FastMCP (Python), Socket.io.
- **Frontend:** React, Vite, Tailwind CSS, Radix UI.
- **Adattárolás:** LanceDB (vektoros), SQLite (metaadatok).
- **Biztonság:** Sandboxolt kód futtatás (vm2), korlátozott fájlműveletek.

## System Status
- **Node.js Tests:** Sikeres (manuális node hívással). Az `npm test` script optimalizálva lett.
- **Python Tests:** Nincs tesztfájl, de a környezet (`.venv`) sikeresen felépült és a függőségek telepítve lettek. A `pytest` futtatható (bár tesztek híján üresen tér vissza).
- **Ismert problémák:**
    - PowerShell script futtatási szabályzata korlátozza az `npm` hívásokat. Javasolt a `cmd` használata vagy a policy módosítása (`Set-ExecutionPolicy RemoteSigned`).
    - A `pytest` hibát dobhat a könyvtárnévben lévő `[]` karakterek miatt paraméterezéskor, de ez nem befolyásolja a működést, ha nincsenek paraméterezett tesztek.

## Development Log
### 2026.01.26 - Fejlesztői Környezet Helyreállítása
- Python `.venv` törlése és újragenerálása.
- Függőségek (`requirements.txt`) sikeres telepítése.
- `package.json` teszt scriptek szétbontása (`test:build`, `test:run`) a jobb kompatibilitásért.

### 2026.01.26 - Projekt Inicializálása és Conductor Setup
- Conductor keretrendszer beállítása.
- Termékdefiníció, Tech Stack és Workflow rögzítése.
- Első track: Projekt Dokumentáció és Stabilitás megkezdése.
- `mag.md` létrehozása és alapinformációk rögzítése.
- **Rendszerellenőrzés:** Node.js tesztek rendben, Python környezet hibás.

