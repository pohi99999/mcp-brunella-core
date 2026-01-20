# Track Specifikáció: Brunella CLI - Multi-Agent Tooling

## 1. Áttekintés
Létrehozunk egy Python alapú CLI eszközkészletet (`myai`), amely lokális Ollama modelleket használ komplex feladatok (tervezés, kódolás, futtatás, ellenőrzés) elvégzésére. Ez az eszköz hibrid módon kiegészíti a Cogella Core meglévő képességeit.

## 2. Funkcionális Követelmények
- **Multi-Agent Flow:** Planner → Coder → Executor (Sandbox) → Reviewer folyamat implementálása.
- **Python Sandbox:** Izolált környezet a generált kódok teszteléséhez.
- **Projekt Analízis:** Képesség a teljes projektstruktúra gyors áttekintésére és összefoglalására.
- **MCP Bridge:** A CLI funkcióinak elérhetővé tétele a fő Gateway-en keresztül.

## 3. Technikai Részletek
- **Nyelv:** Python 3.12+
- **Library-k:** `typer` (CLI), `rich` (UI), `requests` (API).
- **LLM:** Ollama (alapértelmezett: llama3.1, qwen2.5-coder).

## 4. Hatókör
- A `myai/` mappa struktúrájának és moduljainak kialakítása.
- A korábban megadott kódrészletek integrálása és finomhangolása.
- Alapvető tesztek a sandbox működésére.
