# Megvalósítási Terv: Orchestrator Cognitive Upgrade (ReAct & Tool Calling)

**Dátum:** 2026. március 1.
**Verzió:** 1.0
**Cél:** Az `OrchestratorAgent` képességeinek kibővítése úgy, hogy natív Tool Calling funkciókkal, ReAct ciklusban tudja kezelni a folyamatokat, eltávolodva az eddigi "Mock/Tervező" üzemmódtól.

---

## 1. Fázis: LLM Kommunikációs Híd Cseréje (Bifrost Gateway)
Jelenleg az Orchestrator az `Ollama` klienst hívja közvetlenül (`chatWithOllama`). Ezt cserélni kell a `bifrost_gateway.ts`-re (ami már be van kötve a projektbe), hogy elérjük a Tool Calling-ot támogató modelleket (pl. GPT-4o, Gemini 2.0 Flash).

*   **Módosítás (`src/agents/OrchestratorAgent.ts`):** 
    *   Cserélni a `chatWithOllama` hívást a `getBifrostGateway().generate()`-re (vagy a megadott belső gateway hívásra).
    *   A híváshoz kötelezően csatolni kell egy `tools` (eszközök) listát.

## 2. Fázis: Orchestrator Eszközök (Tools) Definiálása
Az Orchestrator számára biztosítani kell az alábbi három alapvető eszközt JSON Schema formátumban:

1.  **`delegate_task`**: Egy feladat kiosztása egy adott ügynöknek.
    *   Paraméterek: `agent_name` (string), `instruction` (string), `background` (boolean - alapértelmezett: true).
    *   Akció: Meghívja az `agentManager.queueTask()` vagy `agentManager.delegate()` metódust.
2.  **`get_agent_status`**: Egy adott ügynök (vagy task) státuszának lekérdezése.
    *   Paraméterek: `agent_name` vagy `task_id` (string/number).
    *   Akció: Válaszol a folyamat állapotával (idle, working, error).
3.  **`send_message_to_user`**: Közvetlen válasz a felhasználónak a Dashboard chaten.
    *   Paraméterek: `message` (string).
    *   Akció: Használja a `socketService.broadcastChatter` funkciót.

## 3. Fázis: A ReAct (Reason + Act) Végrehajtó Ciklus (Execution Loop)
Az `execute()` metódust egy aszinkron ciklussá kell alakítani.

*   **Módosítás (`src/agents/OrchestratorAgent.ts`):**
    *   Törölni a jelenlegi "JSON terv generáló és JSON parse-oló" blokkot.
    *   Bevezetni egy `while(true)` vagy limitált `for` ciklust (max 5 iteráció a végtelen hurkok elkerülésére).
    *   **Ciklus logika:**
        1. Az LLM megkapja az üzenet előzményeket.
        2. Ha a válasz egy Tool Call (`function_call`):
           - Lefuttatja a megfelelő TypeScript eszközt (pl. `delegate_task`).
           - Az eredményt hozzáadja az üzenet előzményekhez mint `function_response`.
           - A ciklus újraindul, hogy az LLM értékelje az eredményt (Reasoning).
        3. Ha a válasz normál szöveg (és már kiadta a taskokat):
           - Kilép a ciklusból és visszatér a felhasználónak (Return).

## 4. Fázis: System Prompt és Személyiség Frissítés
*   Az LLM system promptját át kell írni, hogy támogassa a ReAct modellt és a partner-szerű kommunikációt.
*   **Új Instrukciók:** "Te Brunella vagy, a központi Orchestrator. Ha kérést kapsz, használd a `delegate_task` eszközt. Miután a háttérbe küldted a feladatot, a `send_message_to_user` eszközzel, vagy a végső visszatérési értékben tájékoztasd a felhasználót magyar nyelven (pl. 'Elindítottam a RobotkezV2-t a háttérben. Szólok, ha végzett'). SOHA ne adj vissza JSON feladatlistát szövegként."

## Ellenőrzési Pontok (Definition of Done)
- [ ] Az `OrchestratorAgent` a `BifrostGateway`-t (vagy a hivatalos tool-calling klienst) használja.
- [ ] A 3 alapvető eszköz (delegate, status, send_message) definiálva és implementálva van.
- [ ] Az Orchestrator a Dashboardon természetes nyelven válaszol, mialatt a háttérben ténylegesen elindítja a hívott ügynököt.
- [ ] A `test/OrchestratorAgent.test.ts` (ha van) vagy egy új E2E teszt igazolja a ReAct ciklus működését.

---
**Következő lépés:** `/blueprint:define` a feladatok részletes lebontásához.