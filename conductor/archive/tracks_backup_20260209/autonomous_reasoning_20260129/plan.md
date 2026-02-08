# Implementation Plan - Autonomous Reasoning

## Feladatok (Tasks)

### [ ] Task 1: Task Queue Implementáció
- **Cél:** A meglévő SQLite \	asks\ tábla bekötése az \AgentManager\-be.
- **Funkciók:** \queueTask\, \getNextTask\, \updateTaskStatus\.
- **Dashboard:** A feladatok állapotának megjelenítése valós időben.

### [ ] Task 2: Orchestrator Agent Létrehozása
- **Cél:** Egy "Főnök" ügynök, aki LLM-et használ a tervezéshez.
- **Logika:** User Prompt -> LLM (Plan) -> Sub-tasks -> Queue -> Workers.

### [ ] Task 3: Smart Researcher ("A Kereső")
- **Cél:** A \`ResearcherAgent\` felokosítása. Ha nem kap URL-t, keressen rá a témára.
- **Megvalósítás:** Playwright alapú DuckDuckGo/Google scraper implementálása.

### [ ] Task 4: Dashboard Integráció (Task Queue Vizualizáció)
- **Cél:** A feladatsor és az ügynökök állapotának megjelenítése a webes felületen.
- **Backend:** \`src/server/web.ts\` bővítése \`tasks_update\` eseménnyel.
- **Frontend:** \`TaskQueueCard.tsx\` létrehozása (opcionális/későbbi fázis, első körben backend support).

### [ ] Task 5: End-to-End Teszt ("Gondolkodó Raj")
- **Scenario:** "Nézz utána a legújabb AI ágenseknek!"
- **Várt folyamat:** Orchestrator tervet készít -> Researcher keres -> Találatokat megnyitja -> DataScientist tisztít -> Eredmény a tudásbázisban.
