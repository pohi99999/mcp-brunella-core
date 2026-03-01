# Feladatlista (TODO): Orchestrator Cognitive Upgrade

Ez a dokumentum a `PLAN.md` alapján lebontott, mérnöki szintű feladatokat tartalmazza az Orchestrator ReAct alapú átalakításához.

---

## 🟦 1. Fázis: LLM Kommunikációs Híd Cseréje `[backend]` [COMPLETED]

- [x] **1.1 Importok frissítése az OrchestratorAgent.ts-ben**
  - [x] A `chatWithOllama` importjának eltávolítása.
  - [x] A `getBifrostGateway` és a szükséges eszközhívás típusok importálása a `src/core/bifrost_gateway.ts`-ből (vagy `src/core/modelRouter.ts`-ből).
- [x] **1.2 Gateway Példányosítása**
  - [x] A `getBifrostGateway()` meghívása és az `OrchestratorAgent` osztályon belüli elérhetővé tétele.

---

## 🟩 2. Fázis: Orchestrator Eszközök (Tools) Definiálása `[backend]` [COMPLETED]

- [x] **2.1 Eszközök (Tools) sémájának definiálása**
  - [x] Egy JSON Schema alapú lista (pl. OpenAI format) létrehozása az `OrchestratorAgent.ts` fájlban, amely leírja a funkciókat az LLM számára.
  - [x] Szükséges eszközök: `delegate_task`, `get_agent_status`, `send_message_to_user`.
- [x] **2.2 Eszközök (Functions) végrehajtási logikájának megírása**
  - [x] `delegate_task` implementációja: Hívja meg az `agentManager.queueTask()`-ot. Adjon vissza egy sikeres státuszt és a kapott Task ID-t.
  - [x] `get_agent_status` implementációja: Kérdezze le az `agentManager.listAgentStatuses()` alapján a megfelelő állapotot.
  - [x] `send_message_to_user` implementációja: Hívja meg a `socketService.broadcastChatter` függvényt.

---

## 🟧 3. Fázis: A ReAct Végrehajtó Ciklus (Execution Loop) `[backend]` [COMPLETED]

- [x] **3.1 Az `execute` metódus újraírása**
  - [x] Távolítsd el a régi JSON parsert.
  - [x] Inicializálj egy `messages` tömböt, amibe a felhasználói kérés és a kontextus kerül (rendszer prompttal kiegészítve).
- [x] **3.2 A Ciklus implementálása**
  - [x] Hozz létre egy iterációs ciklust (pl. max 5 lépésig fut, hogy elkerüljük a végtelen hurkot).
  - [x] Cikluson belül: hívd meg a Gateway-t a `messages` tömbbel és a definiált `tools`-okkal.
  - [x] Ha a válasz `function_call` (vagy `tool_calls`): 
    - [x] Elemezd a hívni kívánt függvény nevét és argumentumait.
    - [x] Futtasd le a 2. Fázisban megírt logikát.
    - [x] Fűzd hozzá a `function_response` üzenetet a `messages` tömbhöz, és folytasd a ciklust (következő iteráció).
  - [x] Ha a válasz szöveges (és nem akar eszközt hívni):
    - [x] Lépj ki a ciklusból.
- [x] **3.3 Visszatérési érték (Return) beállítása**
  - [x] A ciklusból kilépve, add vissza az utolsó szöveges választ az `AgentResponse` formátumban (`{ success: true, message: "LLM válasza" }`).

---

## 🟨 4. Fázis: System Prompt és Személyiség Frissítés `[backend]` [COMPLETED]

- [x] **4.1 System Prompt átírása**
  - [x] Utasítsd a modellt a ReAct működésre: "Ne készíts terveket, hanem Cselekedj a rendelkezésre álló eszközökkel."
  - [x] Határozd meg a kommunikációs stílust: "Légy proaktív. Ha egy feladatot háttérbe küldesz, üzenj a felhasználónak a `send_message_to_user` eszközzel vagy a válaszodban."
  - [x] Integráld a meglévő "n8n / Langflow" tudást és a Fast-Routing szabályokat a promptba.

---

## ✅ 5. Fázis: Tesztelés és Átadás `[test]`

- [ ] **5.1 ReAct Loop Egységteszt**
  - [ ] Írj (vagy frissíts) egy tesztet a `test/OrchestratorAgent.test.ts` (vagy hasonló) fájlban, ami egy Mock LLM választ szimulálva ellenőrzi a Tool Calling ciklus lefutását.
- [ ] **5.2 Élő (Dashboard) Tesztelés**
  - [ ] Kérj meg az Orchestratortól egy komplex feladatot (pl. "Indítsd el az n8n-t és írd be, hogy kész") és figyeld a Dashboard "LiveChatter" felületét és az `agent_*.log` naplókat.
