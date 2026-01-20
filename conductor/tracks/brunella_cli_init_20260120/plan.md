# Implementation Plan - Brunella CLI Integráció

## Phase 1: Alapstruktúra és Függőségek
- [x] Task: Python környezet és `myai/` könyvtárstruktúra kialakítása. [211893b]
- [x] Task: `requirements.txt` létrehozása és csomagok telepítése. [3c21491]
- [ ] Task: `config.py` és alap LLM hívások (`core/llm.py`) implementálása.

## Phase 2: Core Modulok és Eszközök
- [ ] Task: Sandbox környezet (`core/sandbox.py`) megvalósítása.
- [ ] Task: Projekt segédeszközök (`core/tools.py` és `core/project.py`) beépítése.
- [ ] Task: Multi-ágens logika (`core/agent.py`) implementálása.

## Phase 3: CLI és MCP Integráció
- [ ] Task: Fő CLI interfész (`cli.py`) létrehozása Typer alapokon.
- [ ] Task: Az új CLI regisztrálása MCP eszközként a Cogella Core-ban.
- [ ] Task: Tesztelés: `dev_agent` futtatása a kalkulátor példával.
- [ ] Task: Conductor - User Manual Verification
