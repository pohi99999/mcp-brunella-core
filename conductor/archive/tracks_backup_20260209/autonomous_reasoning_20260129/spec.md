# Track: Autonomous Reasoning & Orchestration

## Cél
A rendszer felruházása kognitív képességekkel. Az ügynökök ne csak végrehajtsanak, hanem tervezzenek és döntsenek. A központi \OrchestratorAgent\ létrehozása, amely a felhasználói szándékot (Intent) lefordítja technikai lépésekre.

## Kulcs Komponensek
1. **Orchestrator Agent:** 
   - LLM alapú "Router" és "Planner".
   - Képes eldönteni, hogy egy kéréshez melyik ügynökre (vagy ügynökökre) van szükség.
   - Decompozíció: Egy nagy feladatot ("Elemezd a piacot") kisebbekre bont ("Keress híreket", "Szűrd a zajt", "Írj összefoglalót").

2. **Smart Researcher:**
   - Kulcsszó alapú keresés integrációja (pl. Google Search tool vagy DuckDuckGo).
   - Nem igényel direkt URL-t, önállóan navigál a találatok között.

3. **Task Queue (Aszinkron "Agy"):**
   - Az \AgentManager\ kiegészítése egy perzisztens feladatsorral (SQLite \	asks\ tábla).
   - Ez biztosítja, hogy a hosszú folyamatok (long-running jobs) állapotát a Dashboardon követni lehessen.

## Technológia
- **LLM:** Ollama (Llama 3.1) JSON mode a strukturált döntéshozatalhoz.
- **Queue:** \etter-sqlite3\ (már integrálva, csak használni kell).
- **Search:** Google Search MCP tool vagy egy egyszerű scraper logika a Researcherben.
