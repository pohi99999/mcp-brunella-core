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
- **Node.js Tests:** Sikeres (3 teszt lefutott, 0 hiba).
- **Python Tests:** HIBA. A virtuális környezet (`.venv`) hibás útvonalra mutat, a `pytest` nem futtatható.
- **Ismert problémák:**
    - Python virtuális környezet (`.venv`) újrainicializálást igényel.
    - PowerShell script futtatási szabályzata korlátozza az `npm` hívásokat (közvetlen `node` hívás szükséges).

## Development Log
### 2026.01.26 - Projekt Inicializálása és Conductor Setup
- Conductor keretrendszer beállítása.
- Termékdefiníció, Tech Stack és Workflow rögzítése.
- Első track: Projekt Dokumentáció és Stabilitás megkezdése.
- `mag.md` létrehozása és alapinformációk rögzítése.
- **Rendszerellenőrzés:** Node.js tesztek rendben, Python környezet hibás.

