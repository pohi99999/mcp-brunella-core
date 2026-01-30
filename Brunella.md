# 🤖 Brunella Agent System (BAS) - Rendszerközpont

Üdvözöllek a Brunella Agent System (BAS) magjában. Ez a dokumentum a rendszer "agya", amely összefoglalja a célokat, az architektúrát és a működési szabályokat.

## 📍 Projekt Áttekintés
A Brunella egy hibrid architektúrájú MI ökoszisztéma, amely a Model Context Protocol (MCP) segítségével integrálja a különböző képességeket (Node.js/TypeScript mag és Python subsystem). A cél egy "digitális idegrendszer" létrehozása, amely képes autonóm feladatvégzésre, adatgyűjtésre és öntanulásra.

- **GitHub Repo:** https://github.com/pohi99999/mcp-brunella-core.git
- **Fő könyvtár:** `F:\mcp-brunella-core`

## 🏗️ Architektúra és Tech Stack
- **Core Server (Node.js/TS):** Orchestráció, Socket.IO, Express, MCP Server.
- **Python Subsystem (myai):** FastAPI, FastMCP, nehéz elemzések, sandboxing.
- **Dashboard UI:** React, Vite, TailwindCSS (Rendszerfelügyelet).
- **Adat & Memória:** LanceDB (Vektor DB), SQLite (Feladatok és ágensek), Local Filesystem.
- **AI Integráció:** Ollama (Helyi LLM), AnythingLLM (RAG), Gemini (Cloud).

## 🤖 Ügynökök (Agent Roster)
1. **Brunella (Orchestrator):** A központi vezérlő ügynök. Feladata a feladatok delegálása és az MCP eszközök összehangolása.
2. **Jules (DevOps/QA):** Hibrid DevOps partner. Felelős a tesztelésért (`npm test`), log elemzésért és hibajavításért.
3. **Project Organizer:** A fájlrendszer tisztaságáért, a `SUMMARY.md` fájlok generálásáért és a `konyvtarfa.md` karbantartásáért felel.
4. **Agent Architect:** Új ügynökök tervezésére és beállítására szakosodott ügynök (Prompt engineering, függőség kezelés).
5. **Researcher:** Tudásgyűjtés a RAG-en keresztül.
6. **Developer:** Kódgenerálás és fejlesztési ciklusok menedzselése.

## 🛠️ MCP Eszközkészlet (Core Capabilities)
A rendszer több mint 20 beépített eszközzel rendelkezik, többek között:
- **Knowledge:** Szemantikus keresés (LanceDB), fájlok indexelése és kontextus építés.
- **System & Workspace:** Fájlrendszer műveletek, parancsfuttatás (`system_run_command`).
- **Web & Browser:** Navigáció, képernyőfotó készítés, webes tartalom betakarítás.
- **Integrációk:** Google Workspace (Gmail, Naptár), GitHub Copilot, AnythingLLM, Ollama.

## ⚠️ Működési Alapelvek
1. **Zajmentesség:** Minden mappában legyen `SUMMARY.md`. A felesleges fájlokat a `_archive/` mappába kell mozgatni.
2. **Brunella CLI Elsőbbség:** Használd a natív `brunella` parancsokat a Geminni helyett a projekt kezeléséhez.
3. **Tiszta Struktúra:** A `konyvtarfa.md` minden változtatás után frissítendő.

---
*Utolsó frissítés: 2026. január 30.*