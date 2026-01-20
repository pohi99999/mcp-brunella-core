# Implementation Plan - Brunella CLI Integráció

## Phase 1: Alapstruktúra és Függőségek [checkpoint: d119ae4]
- [x] Task: Python környezet és `myai/` könyvtárstruktúra kialakítása. [211893b]
- [x] Task: `requirements.txt` létrehozása és csomagok telepítése. [3c21491]
- [x] Task: `config.py` és alap LLM hívások (`core/llm.py`) implementálása. [6c3b2e9]

## Phase 2: Core Modulok és Eszközök [checkpoint: 56bcd2c]
- [x] Task: Sandbox környezet (`core/sandbox.py`) megvalósítása. [7c0a5b2]
- [x] Task: Projekt segédeszközök (`core/tools.py` és `core/project.py`) beépítése. [3d13ef5]
- [x] Task: Multi-ágens logika (`core/agent.py`) implementálása. [66ac462]

## Phase 3: CLI és MCP Integráció
- [x] Task: Fő CLI interfész (`cli.py`) létrehozása Typer alapokon. [6c3b2e9]
- [x] Task: Az új CLI regisztrálása MCP eszközként a Cogella Core-ban. [bae8cda]
- [x] Task: Tesztelés: `dev_agent` futtatása a kalkulátor példával. [2503bb5]
- [x] Task: Conductor - User Manual Verification [78d4353]
