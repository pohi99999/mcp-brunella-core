# Fejlesztési Terv: BAS Scale-Up & Stabilization (2026-01-31)

Ez a fejlesztési terv a **"BAS Scale-Up & Stabilization"** projekt technikai megvalósítását célozza, a **Zone I-IV** (LangSmith, LanceDB RAG, Strukturált Browser kimenet, Gyárigazgatás) implementálására fókuszálva.

--- START OF AI SESSION ---
**CONTEXT FOR THE CODER AI:**
"Te vagy a Végrehajtó Ügynök. A következő feladatot kell végrehajtanod lépésről lépésre. A cél: A Brunella Agent System (BAS) stabilizálása és skálázása a Zone I-III fejlesztési fázisok szerint. Ez magában foglalja a LangSmith telemetria bevezetését, a hibrid LanceDB alapú memóriarendszer kiépítését, valamint a böngésző ügynök (Robotkéz) Pydantic alapú, strukturált kimenetre való átállítását. Ne kérdezz, hajtsd végre az alábbi fájlműveleteket."

**STEP 1: DEPENDENCIES & SETUP**
Futtasd az alábbi parancsokat a Node.js magban és a Python subsystemben:

```bash
# Node.js függőségek
npm install langchain @langchain/langsmith @lancedb/lancedb zod

# Python függőségek
pip install langsmith lancedb pydantic browser-use
```

**STEP 2: FILE CREATION**

Fájl: `src/utils/telemetry.ts`

```typescript
// FILE: src/utils/telemetry.ts
// PURPOSE: Zone I: LangSmith integráció az observability és költségfigyelés érdekében.

import { Client } from "langsmith";
import { LangChainTracer } = "langchain/callbacks";

export const getTracer = (projectName: string = "brunella-core") => {
  return new LangChainTracer({
    projectName,
    client: new Client({
      apiKey: process.env.LANGCHAIN_API_KEY,
    }),
  });
};

export const logTokenUsage = (agentName: string, usage: { input: number, output: number }) => {
  console.log(`[Telemetry] Agent: ${agentName} | Tokens: In=${usage.input}, Out=${usage.output}`);
};
```

Fájl: `src/utils/rag.ts`

```typescript
// FILE: src/utils/rag.ts
// PURPOSE: Zone II: Hibrid memória rendszer (LanceDB) valós idejű íráshoz Node.js-ben.

import * as lancedb from "@lancedb/lancedb";

export class HybridMemory {
  private dbPath = "./data/brunella_lancedb";

  async addDocument(content: string, metadata: object) {
    const db = await lancedb.connect(this.dbPath);
    const tableNames = await db.tableNames();
    
    let table;
    if (tableNames.includes("memory")) {
      table = await db.openTable("memory");
    } else {
      table = await db.createTable("memory", [{ vector: new Array(1536).fill(0), text: content, ...metadata }]);
    }
    
    // Itt történne az embedding generálás és beszúrás
    await table.add([{ text: content, ...metadata }]);
  }
}
```

Fájl: `myai/browser_worker.py`

```python
# FILE: myai/browser_worker.py
# PURPOSE: Zone III: Browser-use Robotkéz átállítása strukturált JSON kimenetre.

from pydantic import BaseModel
from browser_use import Agent, Controller
import asyncio

class BrowserResult(BaseModel):
    summary: str
    data_points: list[dict]
    success: bool

controller = Controller()

@controller.action("save_extracted_data", param_model=BrowserResult)
def save_extracted_data(result: BrowserResult):
    return result.dict()

async def run_browser_task(task: str):
    agent = Agent(
        task=task,
        llm=None, # Itt a konfigurált LLM kerül behelyettesítésre
        controller=controller
    )
    history = await agent.run()
    # A kimenet már a Pydantic modell szerinti validált JSON
    return history.final_result()
```

**STEP 3: INTEGRATION**

* Frissítsd a `.env` fájlt: `LANGCHAIN_TRACING_V2=true`, `LANGCHAIN_PROJECT=Brunella_Core`, `LANGCHAIN_API_KEY=your_key`.
* **Kiegészítés (Cursor ügynök által elvégezve):**
    *   **1. `src/core/llm_client.ts` – LangSmith tracer minden LLM híváskor:**
        *   `chatWithOllamaInternal`: a tényleges Ollama hívás (fetch / chat stream) egy belső függvénybe került.
        *   `chatWithOllama`:
            *   Ha be van állítva a `LANGCHAIN_API_KEY`, az első híváskor betölti a `langsmith/traceable-t`, és a belső függvényt `traceable` wrapperbe teszi (`name: "chatWithOllama"`, `run_type: "llm"`, `project: LANGCHAIN_PROJECT` vagy `"brunella-core"`).
            *   Minden további hívás ezen a `traced` verzión megy keresztül, így minden LLM hívás LangSmithba kerül.
            *   Ha nincs `LANGCHAIN_API_KEY`, a régi viselkedés marad (nincs tracing).
    *   **2. `src/pipeline/llmPipeline.ts` – Pipeline is traced:**
        *   A közvetlen `fetch("http://localhost:11434/api/generate", ...)` helyett most `chatWithOllama(prompt, undefined, "qwen2.5-coder:1.5b")` hívódik.
        *   Így a `self-healing pipeline` LLM hívásai is `traced` lesznek, ha van LangSmith API kulcs.
    *   **3. `src/server/web.ts` – Dashboard generate endpoint traced:**
        *   `/api/ollama/generate` nem közvetlen `fetch`-et használ, hanem `chatWithOllama(prompt, system, selectedModel)`.
        *   A dashboardról indított generálások is LangSmithba mennek, ha be van állítva a kulcs.
* A `myai/refiner_logic.py` fájlt egészítsd ki a LanceDB Python-oldali batch írási logikájával az `uploaded:Fejlesztési Terv Kivitelezőnek.md` 2. pontja alapján. (Ezt a lépést már elvégeztem)

**LangSmith Integráció Következményei:**
*   `OrchestratorAgent`, `DynamicAgent`, `ollamaTool`, `llmPipeline`, `/api/ollama/generate` mind a központi `chatWithOllama`-t használják.
*   Ha a `.env`-ben van `LANGCHAIN_API_KEY` (és opcionálisan `LANGCHAIN_PROJECT`, `LANGCHAIN_TRACING_V2=true`), ezek a hívások LangSmithban megjelennek.

**Jelenlegi Build Státusz és Problémák (Cursor ügynök által jelentve):**
*   A `npm run build` sikeresen lefutott.
*   `npm test -- test/telemetry.test.ts` sikeresen lefutott.
*   A build hibák (`src/utils/telemetry.ts`, `src/utils/rag.ts`, `src/cli.ts`) javításra kerültek, így a LangSmith tracer integrációja teljeskörűen működőképes.

**STEP 3b: ZONE IV – Gyárigazgatás & Antifragilitás (2026-02-02 kiegészítés)**

*   **Phoenix Protocol:** AgentManager figyeli a Python processzt; try-catch-retry újraindítás; Checkpointing (logs/health_status.json); Docker restart: always.
*   **Dual Storage:** LanceDB + JSONL backup (`logs/harvest_backup.jsonl`); DualStorageManager a `src/utils/rag.ts`-ben.
*   **CI/CD:** GitHub Actions + TEST_BOOK.md; Jules self-healing (PR a javítással).
*   **Docs-as-Code:** project_organizer git pre-commit hook; konyvtarfa.md szinkron.
*   **Data Flywheel:** Harvester → Refiner → Vector DB → Orchestrator körforgás automatizálása.

**STEP 4: VERIFICATION & TESTING**

Fájl: `test/telemetry.test.ts`

```typescript
// FILE: test/telemetry.test.ts
// PURPOSE: Ellenőrzi a LangSmith tracer inicializálását.
import { getTracer } from "../src/utils/telemetry";

describe("Telemetry Test", () => {
  it("should initialize LangChain tracer", () => {
    const tracer = getTracer("test-project");
    expect(tracer).toBeDefined();
    expect(tracer.projectName).toBe("test-project");
  });
});
```

**STEP 5: EXECUTION**

1. Telepítsd a függőségeket: `npm install && pip install -r myai/requirements.txt`.
2. Indítsd el a rendszert diagnosztikával: `node scripts/conductor_diagnostics.mjs`.
3. Futtasd a teszteket: `npm test test/telemetry.test.ts`.

--- END OF AI SESSION ---
