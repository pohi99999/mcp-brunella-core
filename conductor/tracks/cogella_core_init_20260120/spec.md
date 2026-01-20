# Specification: A Cogella Core alapstruktúra és aszinkron Gateway alapozása

## Context
A projekt jelenleg egy Node.js/Express alapú MCP szerver. A cél a "Cogella Core" vízió megvalósítása, amely egy Python alapú, aszinkron, moduláris Gateway architektúrára épül (FastAPI + FastMCP). Ez a track az átállás alapjait fekteti le.

## Goals
1.  Létrehozni a Python alapú projekt vázat és a virtuális környezetet.
2.  Implementálni a központi aszinkron Gateway-t (`main.py`) FastAPI és FastMCP használatával.
3.  Kialakítani a moduláris szerver struktúrát (`src/servers/`).
4.  Létrehozni a `workspace` és `automation` modulok vázát.
5.  Biztosítani az SSE (Server-Sent Events) alapú kommunikációt.

## Requirements
-   **Nyelv:** Python 3.10+
-   **Keretrendszerek:** FastAPI, FastMCP, Uvicorn
-   **Struktúra:**
    ```
    src/
    ├── main.py          # Gateway belépési pont
    ├── core/            # Közös logika
    └── servers/         # Moduláris MCP szerverek
        ├── workspace.py
        └── automation.py
    ```
-   **Aszinkronitás:** Minden végpontnak és eszköznek `async` definícióval kell rendelkeznie.
-   **Környezet:** `uv` csomagkezelő használata javasolt (vagy `pip` + `venv`).

## Out of Scope
-   A teljes üzleti logika (pl. tényleges Google Calendar integráció) implementálása ebben a fázisban nem cél, csak a vázak létrehozása.
-   A Node.js kód teljes törlése (egyelőre referenciaként megmarad).
