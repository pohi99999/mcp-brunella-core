# Track Specifikáció: Rendszer Átvilágítás és Stabilitási Audit

## 1. Célkitűzés
A Brunella Core (Cogella) rendszer teljes körű technikai és funkcionális átvilágítása. A cél a jelenlegi működési állapot ("baseline") rögzítése, a rejtett hibák feltárása (különös tekintettel a Windows környezetre és az SSE/Socket kommunikációra), és a következő fejlesztési ciklus megalapozása.

## 2. Hatókör (Scope)

### A. Core Server & Infrastruktúra
- Szerver indulási folyamat és port binding ellenőrzése.
- Környezeti változók (.env) és konfigurációk validálása.
- Windows-specifikus stabilitás (pl. `async.c` assertion error vizsgálata).
- Docker/Sandbox konténerek állapota.

### B. MCP Protokoll & Kommunikáció
- SSE (Server-Sent Events) végpontok elérhetősége.
- WebSocket kapcsolat stabilitása (Dashboard <-> Server).
- MCP Tool regisztráció és listázás helyessége.

### C. Kliens Interfészek
1.  **CLI (Brunella CLI):**
    - `run`, `chat`, `tools` parancsok működése.
    - Csatlakozási stabilitás.
2.  **Dashboard (Web UI):**
    - Betöltés, csatlakozási állapot kijelzése.
    - "Agent Tools" lista populálódása.
    - Chat interfész reszponzivitása.

### D. Ügynök Képességek (Agent Capabilities)
- **Ollama Integráció:** Helyi modellek válaszadása.
- **Python Shell:** Kódvégrehajtás és állapotmegőrzés (statefulness).
- **Fájlrendszer:** Írás/olvasás jogosultságok és működés.

## 3. Elvárt Kimenet (Deliverables)
1.  **Részletes Audit Jelentés (`AUDIT_REPORT.md`):** Minden tesztelt pont eredménye (Sikeres/Sikertelen/Blokkoló).
2.  **Hibalista (Bug Log):** A feltárt kritikus és minor hibák listája.
3.  **Javaslat a következő lépésekre:** A feltárt állapot alapján prioritási sorrend a következő trackhez.

## 4. Sikerességi Kritériumok
- Minden teszteset lefuttatva (akkor is, ha hibára fut).
- A rendszer állapota transzparens és dokumentált.
