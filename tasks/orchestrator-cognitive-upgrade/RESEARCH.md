# Kutatási Jelentés: Orchestrator Cognitive Upgrade & Real Execution

**Dátum:** 2026. március 1.
**Téma:** A Brunella Agent System Orchestrator ügynökének refaktorálása, hogy a jelenlegi "Mock Mode" (terv-generálás) helyett valódi, ReAct (Reason + Act) alapú Tool Calling-ot használjon.

---

## 1. A Jelenlegi Rendszer Elemzése (A Probléma Gyökere)

Jelenleg a `src/agents/OrchestratorAgent.ts` a következőképpen működik:
1.  Megkapja a felhasználói inputot.
2.  Ha nincs "gyors" kulcsszó-egyezés (Fast Path), átadja egy LLM-nek (Ollama).
3.  Az LLM egy JSON formátumú "tervet" (Execution Plan) generál, amely taskokat tartalmaz.
4.  Ezek a taskok bekerülnek a belső Task Queue-ba (`agentManager.queueTask`), vagy azonnal, szekvenciálisan futnak le.

**Problémák:**
*   **Lineáris és merev:** Az LLM előre megtervezi a feladatokat anélkül, hogy látná a részeredményeket. Nincs valódi "gondolkodás" a lépések között.
*   **Robotikus kommunikáció:** A felhasználó egy JSON-szerű "A feladatokat kiosztottam" üzenetet kap, ami rontja az UX-et.
*   **Nem használja az eszközöket (Tool Calling):** Az Orchestrator nem fér hozzá natív eszközökhöz (mint pl. egy `start_browser_session` vagy `read_project_status`), csak más ügynököknek ad ki parancsot szövegesen.

## 2. Megoldási Irányok (A ReAct Modell)

A GPT-4o (és más modern modellek) legnagyobb erőssége a **Function Calling (Tool Calling)**. 

### Az Új Ciklus (ReAct Loop):
1.  **Thought (Gondolkodás):** Az Orchestrator megkapja az utasítást, és elemzi, hogy mi a teendő.
2.  **Action (Cselekvés):** Meghív egy eszközt. Pl.: `delegate_to_agent(agent_name="RobotkezV2", instruction="Nyisd meg az n8n-t")`.
3.  **Observation (Megfigyelés):** A rendszer visszaadja az eszköz eredményét (pl. "A RobotkezV2 sikeresen elindult és befejezte a feladatot a háttérben").
4.  **Response (Válasz):** Az Orchestrator ezt az információt felhasználva egy barátságos, emberi választ generál a felhasználónak.

### Szükséges Változtatások a Kódbázisban:

#### A. `OrchestratorAgent.ts` átalakítása
*   A `chatWithOllama` egyszerű hívásának lecserélése egy olyan LLM hívásra, amely támogatja a **Tool/Function Calling**-ot (pl. `bifrost_gateway.ts` vagy a natív Vercel AI SDK, amit a projekt már használhat máshol).
*   Az Orchestrator-nek rendelkeznie kell olyan eszközökkel, mint:
    *   `delegate_task(agent_name, task_description)`
    *   `get_agent_status(agent_name)`
    *   `send_message_to_user(message)`

#### B. A Kommunikáció Javítása
*   A rendszer-prompt (System Prompt) átírása: A promptnak explicite utasítania kell a modellt, hogy "Partnerként" viselkedjen. "Ne csak listázd a feladatokat. Ha kérést kapsz, használd a delegate_task eszközt a háttérben, és mondd azt a felhasználónak: 'Értettem, elindítottam a RobotkezV2-t a háttérben. Szólok, ha végzett.'"
*   A `socketService.broadcastChatter` sűrűbb használata a köztes gondolatok kommunikálására.

#### C. `AgentManager.ts` Integráció
*   Az `AgentManager` már képes kezelni a feladatok sorba állítását és a háttérfolyamatokat (`queueTask`, `processPendingTasks`).
*   Ezt a meglévő rendszert kell "behuzalozni" az Orchestrator Tool-jaiba.

---

## 3. Ajánlott Implementációs Lépések (A Tervezéshez)

1.  **Tool-ok definiálása:** Az Orchestrator számára elérhető eszközök (Functions) formális JSON Schema definíciójának elkészítése.
2.  **LLM Kliens frissítése:** Az `OrchestratorAgent`-ben a hívás átalakítása úgy, hogy az LLM a rendelkezésre álló eszközök (tools) ismeretében generáljon választ.
3.  **Végrehajtó Ciklus (Execution Loop):** Egy while ciklus írása, amely addig fut, amíg a modell eszközt akar használni, és csak akkor tér vissza a felhasználóhoz, ha a modell egy végleges választ ad.
4.  **Prompt Engineering:** A System Prompt újraírása a ReAct és a Partner-szerű kommunikáció kierőszakolására.

---
*A kutatási fázis lezárult. Készen áll a tervezésre.*