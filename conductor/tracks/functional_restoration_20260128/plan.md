# Megvalósítási Terv: Functional Restoration

## Fázis 1: LLM & Ollama Reaktiválás
- [ ] **Task 1.1: Ollama Client Implementáció**
    - A `src/core/llm_client.ts` stub kiváltása `fetch` alapú Ollama hívásokkal.
    - `chatStream` metódus implementálása.
- [ ] **Task 1.2: AgentManager szinkronizáció**
    - Az `AgentManager.ts` frissítése az új LLM kliens metódusokhoz.

## Fázis 2: Ügynök Képességek Helyreállítása
- [ ] **Task 2.1: Data Scientist & Refiner**
    - Ellenőrizni a `myai/refiner_logic.py` elérhetőségét.
    - Biztosítani a Python bridge működését.
- [ ] **Task 2.2: Researcher & RAG**
    - A `src/utils/rag.ts` és a LanceDB kapcsolat ellenőrzése.
    - Egy teszt dokumentum indexelése és keresése.

## Fázis 3: MCP Bridge & Server Logic
- [ ] **Task 3.1: ToolManager Véglegesítés**
    - A `src/server/ToolManager.ts` stub kiváltása olyan logikával, ami ténylegesen hívja az SDK `server.tool` implementációit.
- [ ] **Task 3.2: Multi-Server Auto-connect**
    - Helyreállítani a `web.ts`-ben a külső MCP szerverekhez való csatlakozást.

## Fázis 4: Integrációs Teszt
- [ ] **Task 4.1: End-to-End Chat Teszt**
    - Dashboard Chat -> Orchestrator -> LLM -> Tool -> Válasz folyamat ellenőrzése.
