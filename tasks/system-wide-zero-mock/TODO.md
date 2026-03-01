# Feladatlista (TODO): System-Wide "Zero-Mock" & ReAct Upgrade

Ez a dokumentum a `PLAN.md` alapján lebontott, mérnöki pontosságú feladatokat tartalmazza az Orchestrator, Developer és RobotkezV2 ágensek "élesítéséhez".

---

## 🟦 1. Fázis: OrchestratorAgent Szigorítás `[backend]` [COMPLETED]

- [x] **1.1 System Prompt Módosítás**
  - [x] `src/agents/OrchestratorAgent.ts` fájlban a `systemPrompt` frissítése.
  - [x] Kifejezett tiltás hozzáadása: SOHA ne generálj Markdown execution plan-eket.
  - [x] Utasítás hozzáadása: Azonnali "delegate_task" eszközhívás preferálása böngésző indítás esetén.
- [x] **1.2 JSON Terv Generáló Maradványok Eltávolítása**
  - [x] Ha van még a fájlban JSON string parse-olás (ami a régi `chatWithOllama` korszakból maradt), azt törölni kell, mert minden a `toolCalls`-on keresztül megy mostantól.

---

## 🟩 2. Fázis: RobotkezV2Agent "Instant Open" Képesség `[backend]` [COMPLETED]

- [x] **2.1 `llmPlanner.ts` Frissítése**
  - [x] `src/utils/llmPlanner.ts` fájlban a rendszer prompt módosítása: Ha a felhasználó csak böngésző nyitást kér URL nélkül, generáljon egy `{ action: 'navigate', url: 'about:blank' }` lépést.
- [x] **2.2 `RobotkezV2Agent.ts` URL Nélküli Kezelés**
  - [x] Biztosítani, hogy az `about:blank` vagy a `https://www.google.com` hibátlanul injektálja az Overlay Chatet és ne álljon le "érvénytelen URL" hibával.

---

## 🟧 3. Fázis: DeveloperAgent "Zero-Mock" ReAct Ciklus `[backend]` `[parallel]` [COMPLETED]

- [x] **3.1 Importok és Gateway Bekötése**
  - [x] `src/agents/DeveloperAgent.ts` fájlban a `chatWithOllama` és a nyers `generateResponse` lecserélése a `getBifrostGateway()`-re.
- [x] **3.2 Eszközök (JSON Schema Tools) Definiálása**
  - [x] Új konstans: `DEVELOPER_TOOLS` az alábbi funkciókkal:
    - [x] `read_file`: Fájl tartalmának olvasása (fs.readFileSync).
    - [x] `write_file`: Fájl létrehozása/felülírása (fs.writeFileSync).
    - [x] `replace_in_file`: Reguláris kifejezés vagy string csere (fs.readFile -> string.replace -> fs.writeFile).
    - [x] `run_shell_command`: Shell parancsok futtatása (`execSync` használata, biztonsági szűréssel pl. `rm`, `mkfs` blokkolása).
    - [x] `send_status_message`: Értesítés a Dashboardra a `socketService.broadcastChatter` segítségével.
- [x] **3.3 ReAct (Execution Loop) Implementálása**
  - [x] A `handleCodeGeneration` és egyéb specifikus metódusok egybeolvasztása vagy átalakítása egy iteratív `while` vagy `for` ciklussá (mint az Orchestratornál).
  - [x] Automatikus Tool Call parse-olás és TypeScript végrehajtás.
  - [x] Automata `npm test` triggerelés mentés után.

---

## 🟨 4. Fázis: EvaluatorAgent Szabványosítás `[backend]` [COMPLETED]

- [x] **4.1 Evaluator ReAct Bevezetés**
  - [x] `src/agents/EvaluatorAgent.ts` (vagy a megfelelő auditáló ágens) átalakítása a Gateway Tool Callingra.
  - [x] A `run_shell_command` eszköz kiosztása neki, hogy a "Tesztek lefutottak, minden zöld" választ csak tényleges `npm test` kimenet alapján mondhassa.

---

## ✅ 5. Fázis: E2E és Valós Tesztelés `[test]`

- [ ] **5.1 Orchestrator -> Robotkéz Valós Teszt**
  - [ ] Teszt (vagy manuális ellenőrzés): "Nyisd meg a böngészőt" -> Tényleg megnyílik egy ablak az overlay-el.
- [ ] **5.2 Developer Fájlírás Teszt**
  - [ ] Teszt: "Hozz létre egy src/temp/test.js fájlt console.log-al" -> A fájl ténylegesen létrejön a lemezen.
