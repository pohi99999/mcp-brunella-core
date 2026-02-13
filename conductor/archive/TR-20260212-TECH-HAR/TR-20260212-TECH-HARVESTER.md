\# TRACK: BAS Neural Expansion \& Tech-Harvester Protocol

\*\*Status:\*\* ✅ COMPLETED (100% - All Phases DONE)

\*\*Owner:\*\* Brunella Orchestrator

\*\*Priority:\*\* HIGH (Strategic Growth)

\*\*Zone:\*\* Zone III (External Automation \& Self-Learning)



\## 🎯 Célkitűzés (Objective)

Létrehozni egy autonóm, Python-alapú alrendszert ("Tech-Harvester"), amely rendszeres időközönként (Cron) feltérképezi a meghatározott technológiai forrásokat (GitHub, DevTools, AI News). A rendszernek képesnek kell lennie:

1\. \*\*Harvesting:\*\* Releváns tartalmak lekaparása (Browser-Use / Playwright).

2\. \*\*Refining:\*\* A tartalom szűrése és tömörítése (LLM Summary).

3\. \*\*Memory Injection:\*\* A tudás vektorizálása és mentése a LanceDB-be (RAG).

4\. \*\*Self-Evolution:\*\* A tisztított adatok hozzáadása a "Golden Dataset"-hez az éjszakai finomhangoláshoz (Incubator).



\## 🛠 Technikai Architektúra (Stack)



\* \*\*Execution Engine:\*\* Python 3.10+ (a `myai/` alrendszerben)

\* \*\*Browsing:\*\* `browser-use` (LangChain integrációval) + Playwright

\* \*\*Database:\*\* LanceDB (Semantic Memory)

\* \*\*Format:\*\* JSONL (for Fine-tuning)

\* \*\*Orchestration:\*\* Node.js `scheduler` -> Python Trigger



\## 📋 Implementációs Lépések (Step-by-Step)



\### 1. Fázis: Konfiguráció és Források

Létrehozni a `myai/config/sources.json` fájlt, amely tartalmazza a célpontokat.

\* \*Struktúra:\*

&nbsp;   ```json

&nbsp;   {

&nbsp;     "targets": \[

&nbsp;       {"name": "GitHub Trending AI", "url": "\[https://github.com/trending/python?since=daily](https://github.com/trending/python?since=daily)", "type": "list"},

&nbsp;       {"name": "Gemini CLI News", "url": "\[https://geminicli.com](https://geminicli.com)", "type": "article"},

&nbsp;       {"name": "Vercel AI SDK", "url": "\[https://sdk.vercel.ai/docs](https://sdk.vercel.ai/docs)", "type": "docs"}

&nbsp;     ],

&nbsp;     "keywords": \["MCP", "Agent", "Orchestrator", "RAG", "Local LLM"]

&nbsp;   }

&nbsp;   ```



\### 2. Fázis: The Harvester Script (`myai/agents/tech\_harvester.py`)

Egy Python script fejlesztése, amely:

\* Inicializálja a `Browser-Use` ágenst.

\* Végigiterál a `sources.json` listán.

\* \*\*Prompt Logika:\*\* "Látogass el erre az oldalra. Keresd meg a legújabb 3 projektet/cikket, ami releváns az 'AI Agents' és 'MCP' témában. Gyűjtsd ki a nevet, leírást és a GitHub linket JSON formátumban."

\* Kimenet: `temp/harvest\_results\_{date}.json`



\### 3. Fázis: The Refiner \& Integrator (`myai/tools/knowledge\_integrator.py`)

Egy feldolgozó script, amely:

\* Validálja a nyers JSON-t (Pydantic).

\* \*\*RAG Update:\*\* Embeddings generálása és mentése a LanceDB `tech\_trends` táblájába.

\* \*\*Dataset Update:\*\* Hozzáfűzi az adatokat a `myai/incubator/training\_data.jsonl` fájlhoz (Instruction Tuning formátumban: "User: What is new in AI? Assistant: \[New Tech Info]").



\### 4. Fázis: Automation (Conductor Hook)

\* Node.js oldalon (`src/cron/scheduler.ts`) létrehozni egy job-ot, ami 3 naponta (vagy parancsra) futtatja:

&nbsp;   `python myai/agents/tech\_harvester.py --mode auto`



\## 🛡️ Glass Box \& Logs

\* A folyamat minden lépését (URL látogatás, talált adat, mentés állapota) a `logs/harvester.log` fájlba kell írni.

\* A Dashboardon meg kell jeleníteni: "Last Knowledge Update: \[Date]"



\## ✅ Definition of Done

\* \[x] **Phase 1:** Config (`myai/config/sources.json`) - 6 sources configured ✅
\* \[x] **Phase 2:** Harvester Script (`myai/agents/tech_harvester.py`) - Browser-Use + Playwright ✅
\* \[x] **Phase 3:** Refiner & Integrator (`myai/tools/knowledge_integrator.py`) - LanceDB RAG ✅
\* \[x] **Phase 4:** Automation Pipeline (`myai/tools/harvest_pipeline.py`) + CLI (`brunella harvest`) ✅

\* \[x] Config created (6 sources: GitHub, Vercel, LangChain, HuggingFace, MCP, Anthropic)
\* \[x] Harvester CLI working (`python agents/tech_harvester.py --help`)
\* \[x] Refiner CLI working (`python tools/knowledge_integrator.py <file>`)
\* \[x] Pipeline wrapper working (`python tools/harvest_pipeline.py`)
\* \[x] Brunella CLI command (`brunella harvest run` + `brunella harvest status`)
\* \[x] LanceDB integration (vector storage for RAG)
\* \[x] Golden Dataset update (instruction tuning JSONL format)
\* \[x] Deduplication (cosine similarity on embeddings)
\* \[x] LLM summarization (Ollama qwen2.5-coder)

