# Brunella teljes funkció- és tulajdonságmátrix

**Projekt:** Brunella Agent System (BAS)  
**Repo:** `mcp-brunella-core`  
**Verzió:** 2.4.0  
**Készült:** 2026-03-25  
**Cél:** egyetlen dokumentumban összefoglalni a Brunella rendszer teljes képességkészletét: szolgáltatások, logikai alrendszerek, memória- és adatkezelés, MCP integrációk, API-k, UI felületek, Python és Cloudflare rétegek, fejlesztői és operációs workflow-k.

---

# 1. Vezetői összefoglaló

A Brunella egy **hibrid Node.js + Python + Cloudflare** alapú, **multi-agent**, **MCP-kompatibilis**, **dashboard- és CLI-vezérelt** intelligens operációs rendszer, amely egyszerre tud:

- szoftvert fejleszteni,
- böngészőt automatizálni,
- LLM-eket route-olni és fallbackelni,
- tudást indexelni és RAG-ként visszakeresni,
- enterprise workflow-kat futtatni,
- Cloudflare edge workereket használni,
- memóriát és mintákat újrahasznosítani,
- fejlesztési trackeket menedzselni,
- és többféle AI felületet egységes rendszerként összefogni.

A rendszer egyszerre működik:

1. **MCP szerverként** AI kliensek felé,
2. **REST/WebSocket backendként** dashboard és külső kliensek felé,
3. **interaktív CLI-ként** fejlesztők és operátorok felé,
4. **Python AI alrendszerként** böngésző-, RAG- és adatpipeline-feladatokra,
5. **Cloudflare edge infrastruktúraként** távoli, skálázható és részben decentralizált végrehajtásra.

---

# 2. Rendszer-kulcsszámok

| Mutató | Jelenlegi érték | Forrás |
|---|---:|---|
| Regisztrált agentek | 54 | `src/agents/registry.json` |
| Tool fájlok | 31 | `src/tools/` |
| REST route fájlok | 57 | `src/server/routes/` |
| Dashboard nav itemek | 62 | `src/dashboard/lib/navigation.tsx` |
| Dashboard nav csoportok | 7 | `src/dashboard/lib/navigation.tsx` |
| Core modulok | 72 | `src/core/` |
| Security modulok | 5 | `src/security/` |
| Script fájlok | 119 | `scripts/` |
| Lokális fő log/db fájlok | 15+ | `logs/` |
| Cloudflare worker route/topológia | 20 worker körüli dokumentált készlet | `cloudflare.md` |

> Megjegyzés: a rendszerben a regisztrált agenteken túl vannak dinamikusan betöltött, TOML-alapú és enterprise modulokhoz kapcsolt képességek is, ezért a gyakorlati képességkészlet nagyobb, mint a puszta registry-szám.

---

# 3. Architektúra és futtatási módok

## 3.1. Fő futtatási módok

| Mód | Leírás | Fő belépési pont |
|---|---|---|
| MCP stdio szerver | AI kliensek (Claude Desktop, MCP-kompatibilis kliensek) felé szabványos eszközszerver | `src/index.ts` |
| Express + REST + Socket.IO | Dashboard, CLI bridge, külső integrációk | `src/index.ts`, `src/server/web.ts` |
| CLI | Magyar, interaktív és parancsalapú üzem | `src/cli.ts` |
| Python FastAPI | Böngésző, scraping, RAG, worker logika | `myai/server.py` |
| Python FastMCP | Python oldali MCP tool execution | `myai/mcp_server.py` |
| Cloudflare edge | Távoli worker, D1, KV, tunnel, AI endpoint | `cloudflare/src/index.ts` |
| Tauri/desktop shell | Asztali kliens futtatási opció | `package.json`, `src-tauri/` |
| VSCode/code-server bridge | Böngészős IDE és remote dev felület | `package.json`, dashboard embedded workflow |

## 3.2. Központi technológiai döntések

- **TypeScript ESM** (`type: module`, Node16 moduleResolution)
- **Strict konvenciók**: `.js` importvégek, `any` tiltása, projekt logger használata
- **Node + Python kooperáció**
- **Zod alapú konfiguráció és validáció**
- **MCP first szemlélet**
- **Cloud + local LLM hibrid routing**
- **Track-alapú fejlesztési workflow**

## 3.3. Fő belépési pontok

| Fájl | Szerep |
|---|---|
| `src/index.ts` | MCP + HTTP dual-mode rendszerindító |
| `src/cli.ts` | Brunella CLI (bin: `brunella`) |
| `src/server/web.ts` | Express webszerver + route wiring |
| `myai/server.py` | FastAPI AI alrendszer |
| `myai/mcp_server.py` | Python MCP tool hosting |
| `cloudflare/src/index.ts` | Edge worker entrypoint |

---

# 4. Fő capability-domének

## 4.1. AI multi-agent orchestration

A Brunella egyik legerősebb tulajdonsága, hogy **többféle szerepkörű, specializált agentet** egységes rendszerbe szervez.

### Funkciók
- feladatértelmezés,
- delegálás,
- agent routing,
- szerepalapú végrehajtás,
- domain-specifikus specializáció,
- enterprise modulok automatizált meghívása,
- multi-agent colony/swarm minták,
- dinamikus agent betöltés TOML fájlokból.

### Fő komponensek
- `src/agents/AgentManager.ts`
- `src/agents/OrchestratorAgent.ts`
- `src/agents/EnterpriseOrchestratorAgent.ts`
- `src/agents/ProjectConductorAgent.ts`
- `src/agents/DynamicAgent.ts`
- `src/agents/swarm/`

## 4.2. Szoftverfejlesztési és mérnöki automatizálás

### Funkciók
- kódgenerálás,
- refaktor,
- lint fix,
- code review,
- dependency graph elemzés,
- spec írás,
- architektúra-tervezés,
- scaffoldolás,
- önjavító pipeline.

### Fő agentek / modulok
- `DeveloperAgent`
- `EvaluatorAgent`
- `SpecWriterAgent`
- `ArchitectAgent`
- `DependencyGraphAgent`
- `LintFixerAgent`
- `GenesisOrchestrator`
- `src/agents/developerPipeline.ts`

## 4.3. Browser automation és web interaction

### Funkciók
- Playwright-alapú böngészővezérlés,
- Robotkéz módok,
- Browser Copilot,
- multi-step browser task execution,
- cross-tab/session kezelés,
- screenshot alapú critic/vision értékelés,
- CDP / Chrome DevTools alapú debugging,
- web scraping és strukturált extraction.

### Fő komponensek
- `src/agents/RobotkezV2Agent.ts`
- `src/agents/CometBrowserAgent.ts`
- `src/agents/ChromeDevToolsAgent.ts`
- `myai/browser_worker.py`
- `myai/agents/comet/`
- `src/server/routes/browserCopilot.ts`
- `src/server/routes/robotkez.ts`
- `src/server/routes/robotkez_pro.ts`
- `src/tools/browser.ts`
- `src/tools/persistentBrowserTools.ts`

## 4.4. Knowledge / RAG / memória

### Funkciók
- dokumentumindexelés,
- semantic search,
- LanceDB/ChromaDB alapú vektorkeresés,
- strukturált agent-memória,
- pattern reuse,
- golden dataset gyűjtés,
- kontextus-visszatöltés agent futásokba.

### Fő komponensek
- `src/utils/rag.ts`
- `src/core/structuredMemory.ts`
- `src/core/goldenDatasetBridge.ts`
- `src/core/knowledgeGraph.ts`
- `src/core/graphRagEngine.ts`
- `myai/rag.py`
- `myai/vector_db_interface.py`
- `myai/chromadb_adapter.py`
- `src/tools/knowledge.ts`
- `src/tools/memoryTool.ts`

## 4.5. Enterprise és business automation

### Funkciók
- marketing kampány generálás,
- sales és lead mining,
- HR és fejvadászat,
- procurement,
- claims/proaktív ügykezelés,
- pricing és property analysis,
- grant hunting,
- law detective,
- invoice és Google Sheets alapú pénzügyi automatizmusok.

### Fő agentek / modulok
- `MarketingDirectorAgent`
- `CampaignGeneratorAgent`
- `SalesAgent`, `SalesHunterAgent`, `LeadMiningAgent`
- `DigitalHeadhunterAgent`, `HeadHunterAgent`
- `FinanceGuardian`, `FinancialGuardAgent`, `ProcurementAgent`
- `ProactiveClaimsAgent`, `PricingAgent`
- `LawDetectiveAgent`, `GrantWatcherAgent`, `GrantHunter`
- `PropertyVisionaryAgent`, `PropertyAnalystAgent`
- `LocalCSRAgent`, `EmailTriageAgent`, `ConflictMediatorAgent`
- `src/server/routes/enterprise.ts`, `sales.ts`, `grants.ts`, `businessJobs.ts`

## 4.6. Cloudflare / edge / remote execution

### Funkciók
- edge worker dispatch,
- D1 query bridge,
- KV-backed session/cache minták,
- tunnel-alapú remote elérés,
- Workers AI inference,
- CEAN orchestration,
- edge history/status/task route-ok,
- custom domain és DNS topológia.

### Fő komponensek
- `src/server/routes/cloudflare.ts`
- `src/utils/cloudflareClient.ts`
- `src/utils/cloudflareConfig.ts`
- `src/utils/d1Adapter.ts`
- `src/utils/cloudflareBrowser.ts`
- `src/core/edgeHealthMonitor.ts`
- `src/agents/EdgeProxyAgent.ts`
- `cloudflare/src/index.ts`
- `cloudflare/migrations/`
- `cloudflare.md`
- `cloudflareversup.md`

## 4.7. Workflow, scheduling és orchestration engine-ek

### Funkciók
- task queue,
- decomposition,
- scheduled tasks,
- suggested task generation,
- DAG execution,
- workflow engine,
- Jules automation,
- N8N és Langflow beágyazás,
- workflow state és coordination.

### Fő komponensek
- `src/agents/taskQueue.ts`
- `src/agents/TaskDecomposerAgent.ts`
- `src/core/dagEngine.ts`
- `src/core/scheduledTasksEngine.ts`
- `src/core/suggestedTasksScanner.ts`
- `src/core/julesIntegration.ts`
- `src/server/routes/tasks.ts`
- `src/server/routes/scheduledTasks.ts`
- `src/server/routes/suggestedTasks.ts`
- `src/server/routes/jules.ts`
- `src/tools/n8n.ts`

---

# 5. Agent-ökoszisztéma mátrix

## 5.1. Agent kategóriák

| Kategória | Jellemző szerep | Példák |
|---|---|---|
| Orchestrator / management | routing, delegation, coordination | `OrchestratorAgent`, `EnterpriseOrchestratorAgent`, `ProjectConductorAgent` |
| Engineering | code/spec/architecture | `DeveloperAgent`, `EvaluatorAgent`, `ArchitectAgent`, `SpecWriterAgent`, `LintFixerAgent` |
| Browser / automation | web task, browser interaction, debug | `RobotkezV2Agent`, `CometBrowserAgent`, `ChromeDevToolsAgent`, `VoiceAgent`, `EdgeProxyAgent` |
| Data / knowledge | scraping, RAG, knowledge build | `ResearcherAgent`, `DataScientistAgent`, `KnowledgeBaseBuilderAgent` |
| Enterprise | sales, finance, HR, legal, grants, property | `MarketingDirector`, `FinanceGuardian`, `DigitalHeadhunter`, `LawDetective`, `PropertyVisionary`, stb. |
| Dynamic/TOML | prompt-first, gyorsan bővíthető agent | `DynamicAgent`, TOML-config ügynökök |
| Swarm | többszereplős kolónia logika | `SwarmManager`, `SwarmColony`, swarm core |

## 5.2. Reprezentatív, üzletileg fontos agentek

| Agent | Fő képesség | Üzleti / technikai érték |
|---|---|---|
| `Developer` | kódolás és javítás | fejlesztési automatizálás |
| `Evaluator` | audit, teszt, review | minőségbiztosítás |
| `Researcher` | kutatás, információgyűjtés | tudásbővítés, lead research |
| `RobotkezV2` | browser task execution | web automation |
| `CometBrowserAgent` | planner→actor→critic automation | intelligens böngésző ügynök |
| `ProjectConductor` | track / state menedzsment | fejlesztési folyamatirányítás |
| `MarketingDirector` | kampány orchestration | marketing automatizáció |
| `FinanceGuardian` | pénzügyi kontroll | finance governance |
| `DigitalHeadhunter` | recruitment screening | HR automatizálás |
| `LawDetective` | jogi dokumentumelemzés | compliance / legal support |
| `GrantWatcher` / `GrantHunter` | pályázatfigyelés | üzleti opportunity discovery |
| `PropertyVisionary` | ingatlan elemzés | property intelligence |
| `EdgeProxy` | Cloudflare/edge routing | remote execution |

## 5.3. Agent mechanikák

| Mechanika | Leírás | Fájl |
|---|---|---|
| IAgent interface | egységes végrehajtási szerződés | `src/agents/types.ts` |
| BaseAgent | RAG + lifecycle + bridge pattern | `src/agents/BaseAgent.ts` |
| Registry | agent definíciók és metaadatok | `src/agents/registry.json` |
| AgentManager | lifecycle, delegálás, queue, init | `src/agents/AgentManager.ts` |
| Permissions / RBAC | role és path-jogok | `src/agents/permissions.ts` |
| Dynamic loading | TOML-ból agent indítás | `src/agents/DynamicAgent.ts` |
| Status / logging | státusz- és logkezelés | logger, agent state |

---

# 6. MCP és tool integrációs mátrix

## 6.1. MCP szerepe a rendszerben

A Brunella MCP-kompatibilis rendszer, ahol a toolok és agentek egy része **MCP szerverként**, másik része **REST/CLI bridge-en keresztül** érhető el. A projekt egyik alapvető tulajdonsága, hogy az AI-kliens, a dashboard és a backend ugyanazon képességtér különböző hozzáférési felületei.

## 6.2. Tool családok

| Tool család | Fájlok | Fő funkciók |
|---|---|---|
| Workspace | `workspace.ts`, `unifiedWorkspace.ts` | fájlolvasás, írás, keresés, workspace műveletek |
| Knowledge | `knowledge.ts`, `memoryTool.ts` | RAG keresés, memóriakezelés |
| System | `system.ts`, `monitor.ts`, `deploymentAnalyzer.ts` | rendszerállapot, diagnosztika, deployment elemzés |
| Browser | `browser.ts`, `persistentBrowserTools.ts`, `browserBridge.ts` | webinterakció, sessionök, böngésző bridge |
| LLM provider tools | `ollamaTool.ts`, `geminiTool.ts`, `githubModelsTool.ts`, `claudeTool.ts` | több-provideres AI hívások |
| CLI bridges | `copilotCliTool.ts`, `julesCliTool.ts` | külső CLI-k integrálása |
| Swarm | `swarmTools.ts`, `negotiationEngine.ts` | kolónia-voting, koordináció |
| External automation | `n8n.ts`, `anythingllm.ts`, `crawl4aiTool.ts`, `evHunterTool.ts` | workflow és szolgáltatás integrációk |
| Business/invoice | `getSzamlazzInvoices.ts`, `writeSheetsInvoices.ts`, `getAiRecommendation.ts` | számla, Sheets, recommendation |
| Google Workspace | `googleWorkspace.ts`, `unifiedGoogleWorkspaceTool.ts` | Gmail, Drive, Sheets, naptár jellegű integrációk |

## 6.3. Tool-regisztrációs logika

A toolok központi regisztrációja a `src/server/registry.ts` fájlban történik.

### Regisztrációs sajátosságok
- agent toolok is toolként exportálhatók,
- belső handler map fenntartása,
- dinamikus agentek runtime regisztrációja,
- Node-only toolok conditional importtal,
- dashboard/tool discovery célú metaadat-készlet.

## 6.4. MCP specifikus képességek

| Képesség | Leírás |
|---|---|
| MCP stdio server | AI kliensek közvetlen eszközhozzáférése |
| Dynamic tool registry | eszközök és metaadatok központi regisztere |
| MCP discovery | tool- és integráció-feltárás core szinten |
| MCP command center | dashboardból is elérhető tool execution center |
| Tool permissions | RBAC-szintű tool kontroll |
| Python FastMCP | Python oldali MCP tool hosting |

---

# 7. REST API és szolgáltatási mátrix

## 7.1. Aktív route családok a central routerben

A `src/server/routes/index.ts` alapján az API v1 központi router az alábbi capability-ket köti be:

| Route prefix | Funkciótér |
|---|---|
| `/health` | health és állapot |
| `/agents` | agent execution és inventory |
| `/registry` | agent registry |
| `/providers` | provider lista |
| `/ollama`, `/gemini`, `/github-models`, `/llm` | LLM route-ok |
| `/files`, `/rag` | fájl- és tudáskezelés |
| `/tasks` | task queue és státusz |
| `/tools`, `/debug` | eszközfuttatás és diagnosztika |
| `/chat`, `/anythingllm` | chat és külső LLM/workspace |
| `/incubator`, `/n8n` | külső AI/workflow rendszerek |
| `/developer` | fejlesztői pipeline |
| `/browser-copilot`, `/robotkez`, `/robotkez-pro` | böngészővezérlés |
| `/jules` | Jules AI automatizáció |
| `/cloudflare` | edge és worker kontroll |
| `/tracks` | conductor/track réteg |
| `/tts` | szöveg-felolvasás |
| `/brunella` | recommendation és platform-közeli funkció |
| `/machines` | gép/asset capability |
| `/enterprise` | enterprise modulok |
| `/system` | architektúra + rendszerkontroll |
| `/business-jobs` | business workflow-k |
| `/security` | security audit és monitor |
| `/assistant` | personal assistant |
| `/copilot-bridge` | Copilot↔BAS bridge |

## 7.2. Route szintű rejtett / latent képességek

A repo 56 route fájlja közül több olyan is van, amely teljes implementációt tartalmaz, de nincs mindenhol teljesen kiexponálva.

Kiemelten fontos latent route-családok:
- `autonomousInfra.ts`
- `universalOrchestrator.ts`
- `swarm.ts`
- `observability.ts`
- `prometheus.ts`
- `pythonWorkers.ts`
- `ce an.ts`
- `fleet.ts`
- `scaling.ts`
- `goldenDataset.ts`
- `mcp.ts`
- `studio.ts`
- `workers.ts`
- `wrangler.ts`

> Ez azt jelenti, hogy a Brunella képességtér **nagyobb**, mint amit a mindennapi UI vagy default API útvonalak mutatnak.

---

# 8. Dashboard és felhasználói felület mátrix

## 8.1. Dashboard platform

**Stack:** React 19 + Vite + Tailwind v4 + Radix UI  
**Fő registry:** `src/dashboard/lib/navigation.tsx`

## 8.2. Regisztrált dashboard capability-k

A dashboard 63 regisztrált nav itemet tart fenn 7 fő csoportban.

### Nav csoportok
1. **Core Systems**
2. **AI & Agents**
3. **Enterprise**
4. **Értékesítési Központ**
5. **Orchestration**
6. **Project Mgmt**
7. **System**

## 8.3. Fő dashboard panelek

| Panel / oldal | Funkció |
|---|---|
| Mission Control | központi dashboard |
| Neural Map | rendszerkapcsolatok vizualizációja |
| CEAN Orchestrator | edge orchestration felület |
| Cloudflare Deploy | Cloudflare capability kezelés |
| Agent Roster | agent menedzsment |
| Agent Diagnostics | agent állapot és hibaelemzés |
| Task Queue | futó feladatok |
| Tracks | fejlesztési szálak |
| Neural Knowledge | RAG / knowledge |
| Agent Memory | memória panel |
| MCP Command Center | tool execution UI |
| Developer | fejlesztői segédpanel |
| Edge | edge állapot |
| Robotkéz | browser automation kezelő |
| Browser Copilot | magasabb szintű böngésző asszisztens |
| Enterprise Suite | enterprise capability-k |
| Campaign Studio | kampányrendszer |
| Invoice Sync | számla integráció |
| Lead Mining | lead discovery |
| Trojan Horse | sales/marketing command center |
| Guardrails | policy/guardrail figyelő |
| Telemetry | telemetria és diagnosztika |
| LLM Observability | provider viselkedés monitorozása |
| Security Monitor | biztonsági láthatóság |
| Crawl4AI | webcrawl capability |
| Copilot Commander | Copilot bridge kezelő |
| Personal Assistant | assistant blueprint / readiness |
| Python Workers | Python alrendszer láthatóság |
| Fleet Manager | worker fleet képességek |
| Autonomous Infra | autonomous infra funkciók |
| Jules AI | Jules integráció |

## 8.4. Beágyazott felületek és external UI-k

- `n8n Automation`
- `Langflow Orchestration`
- `VSCode Stream`
- `Chrome ACP Browser`

## 8.5. Rejtett / nem regisztrált UI capability-k

A repo dokumentáció és korábbi auditok alapján további elérhető, de nem mindenhol bekötött UI elemek is vannak, pl.:
- `CognitiveMemoryPanel`
- `LiveExecutionMonitor`
- `ModelRouterPanel`
- `TraceViewer`
- `LogViewer`
- `VectorizeAnalyticsWidget`
- `HarvestPipelineWidget`

---

# 9. Python AI alrendszer

## 9.1. Fő szerep

A Python réteg adja a rendszer **böngészős**, **web scraping**, **RAG**, **worker**, **strukturált adatfeldolgozó** és részben **MCP-hosting** képességeinek jelentős részét.

## 9.2. Fő modulok

| Fájl / mappa | Funkció |
|---|---|
| `myai/server.py` | FastAPI API és AI végpontok |
| `myai/mcp_server.py` | FastMCP szerver |
| `myai/browser_worker.py` | Playwright/browser task execution |
| `myai/crawl4ai_worker.py` | intelligens crawling |
| `myai/refiner_logic.py` | adattisztítás |
| `myai/rag.py` | RAG szolgáltatás |
| `myai/vector_db_interface.py` | vektor DB absztrakció |
| `myai/chromadb_adapter.py` | ChromaDB integráció |
| `myai/pydantic_models.py` | szigorú adatmodellek |
| `myai/agents/comet/` | planner/actor/critic/memory/orchestrator |
| `myai/workers/` | edge worker jellegű alrendszerek |
| `myai/tools/`, `myai/workflows/`, `myai/scenarios/` | automatizációs és segédlogikák |

## 9.3. Python capability-k

- browser automation,
- structured extraction,
- RAG retrieval,
- vector indexing,
- crawl pipeline,
- prompt/agent TOML konfigurációk,
- data refining,
- screenshot és page-state feldolgozás,
- Comet protocol implementáció,
- edge worker kísérleti / kapcsolódó alrendszerek.

---

# 10. Cloudflare, CEAN és remote capability-k

## 10.1. Dokumentált Cloudflare topológia

A repo dokumentáció szerint a Cloudflare része a Brunella egyik kritikus remote execution rétege.

### Dokumentált elemek
- domain: `peterpohanka.com`
- CNAME/tunnel hostok:
  - `api.bas.peterpohanka.com`
  - `browser-use.bas.peterpohanka.com`
  - `n8n.bas.peterpohanka.com`
- D1: `bas-metadata`
- KV namespace: 1 dokumentált namespace
- 20 körüli működő worker

## 10.2. Cloudflare képességek

| Képesség | Leírás |
|---|---|
| Worker inventory | worker állapotlista és audit |
| Task dispatch | edge task beküldés |
| Status/history | edge task életciklus |
| D1 bridge | távoli SQL-szerű query proxy |
| Workers AI | `/ai/generate` inference endpoint |
| Chat sync | Cloudflare worker alapú chat/fallback útvonal |
| Tunnel diagnostics | tunnel runtime config és linkek |
| Remote browser capability | Cloudflare browser routing/bridge |

## 10.3. CEAN

CEAN = **Cloudflare Edge Agents Network**, amely a Brunella edge-orientált distributed execution rétege.

### Jellemzők
- orchestrator worker,
- D1 séma,
- history/status/task API,
- edge capability routing,
- remote execution alapszint,
- follow-up DNS zone reconciliation track.

## 10.4. Remote layer roadmap

A repo szerint többfázisú remote layer terv fut:
- foundation,
- discovery/auth,
- mobile,
- voice,
- distributed mesh,
- adaptive swarms,
- collective evolution,
- planet-scale supersystem,
- emergent superintelligence.

Ez azt mutatja, hogy a Brunella nem csak lokális AI orchestrator, hanem hosszú távon **elosztott intelligens operációs platform** irányába épül.

---

# 11. Memória-, adat- és tudásréteg

## 11.1. Memóriafajták

| Memóriafajta | Implementáció | Funkció |
|---|---|---|
| Agent memória | `src/core/structuredMemory.ts` | task/result minta újrahasznosítás |
| RAG memória | `src/utils/rag.ts`, `myai/rag.py` | dokumentum alapú kontextus |
| Comet memory | `myai/agents/comet/memory.*` | browser action history |
| User preferences | `src/core/userPreferences.ts`, dashboard panel | felhasználói preferenciák |
| Golden dataset | `src/core/goldenDatasetBridge.ts` | fine-tuning corpus |
| Conductor/track state | `conductor/project_state.json` | fejlesztési tudás és állapot |
| Cloudflare edge state | D1/KV | elosztott állapot |

## 11.2. Structured memory részletek

A `structuredMemory.ts` alapján a Brunella:
- SQLite/WAL módot használ,
- `agent_memories` táblát tart fenn,
- task hash + normalized task alapján újrahasznosít,
- confidence és reuse count metrikákat tárol,
- TTL napokkal kezeli a lejáratot,
- exact match és hasonlósági keresést is támogat.

## 11.3. Tudás- és adattároló rétegek

| Tároló | Szerep |
|---|---|
| SQLite | lokális runtime és állapot |
| LanceDB | elsődleges vektortároló |
| ChromaDB | alternatív vektor DB |
| Cloudflare D1 | edge-relációs adat |
| Cloudflare KV | elosztott cache/session |
| Cloudflare R2 | nagyobb artefaktok, ha használva van |
| JSON/TOML/Markdown | konfigurációs és tudásfájlok |

---

# 12. Perzisztencia és tárolási mátrix

## 12.1. Lokális log- és adatfájlok

A `logs/` könyvtár alapján jelen vannak többek közt:

- `brunella.db`
- `dashboard.log`
- `harvester.log`
- `harvest_pipeline.log`
- `health.log`
- `http.log`
- `knowledge_integrator.log`
- `mcp_audit.log`
- `node_backend.log`
- `orchestrator.log`
- `python_backend.log`
- `python_backend_err.log`
- `startup.log`
- `targeted-vitest.log`
- `web_ui.log`

## 12.2. Funkcionális jelentésük

| Fájl / réteg | Jelentés |
|---|---|
| `brunella.db` | központi lokális SQLite állapot |
| task / checkpoint DB-k | task queue, retry, állapotmentés |
| audit logok | végrehajtás és biztonsági nyomkövetés |
| backend logok | Node/Python üzemeltetési diagnosztika |
| startup/health/http logok | rendszerindítás és API viselkedés |

---

# 13. Biztonság, guardrails és compliance mátrix

## 13.1. Fő security komponensek

| Fájl | Funkció |
|---|---|
| `src/security/redactor.ts` | PII és secret redaction |
| `src/security/remoteAuth.ts` | remote auth réteg |
| `src/security/safe_zone_validator.ts` | biztonságos path/zone validáció |
| `src/security/e2b_sandbox_manager.ts` | sandbox execution |
| `src/security/index.ts` | security összefogó export |

## 13.2. Guardrail képességek

- PII redaction (email, telefon, IP, bankkártya, tax id)
- secret redaction (JWT, GitHub token, bearer token, API key, password, connection string)
- soft-fail redaction wrapper agent outputokra
- RBAC jogosultsági profilok
- safe zone alapú fájlrendszer-hozzáférés
- route- és edge-auth minták
- sandbox execution izoláció

## 13.3. Redactor konkrét minták

A `redactor.ts` explicit támogat:
- email,
- magyar és nemzetközi telefon,
- IPv4,
- credit card,
- magyar tax id,
- JWT,
- Anthropic/OpenAI/AWS/GitHub token,
- bearer token,
- connection string,
- általános API key,
- password mező redakcióját.

---

# 14. Observability, telemetry és öngyógyítás

## 14.1. Observability capability-k

| Capability | Fő fájlok |
|---|---|
| LLM observability | dashboard panel, `src/server/routes/observability.ts` |
| Telemetry | `src/cli.ts`, telemetry utilok, dashboard telemetria |
| Prometheus | `src/core/prometheus.ts`, `routes/prometheus.ts` |
| Metrics | `routes/metrics.ts` |
| Health checks | `routes/health.ts`, `scripts/health_check.*`, `scripts/smoke.mjs` |
| Test results tracking | `src/core/testResultsService.ts` |
| Process monitor | `src/core/processMonitor.ts` |

## 14.2. Phoenix Protocol

A Brunella öngyógyító mechanikája:
- checkpointing,
- retry stratégia,
- recovery logika,
- git recovery,
- event bus alapú állapotváltozás-kezelés.

### Fő komponensek
- `src/core/checkpoint.ts`
- `src/core/phoenixEventBus.ts`
- `src/core/gitRecovery.ts`
- `src/core/retryStrategy.ts`
- `src/core/failoverRegistry.ts`

---

# 15. LLM routing és modellek

## 15.1. Provider stratégia

A rendszer több-provideres és fallback képes.

### Fő providerek
- Ollama
- Gemini
- GitHub Models
- Anthropic
- Cloudflare Workers AI

## 15.2. Fő komponensek

| Fájl | Funkció |
|---|---|
| `src/core/modelRouter.ts` | brain vs muscle routing |
| `src/core/bifrost_gateway.ts` | multi-provider gateway |
| `src/server/routes/llm.ts` | HTTP provider bridge |
| provider toolok | közvetlen tool-hozzáférés |

## 15.3. LLM capability-k

- complexity alapú modellválasztás,
- budget-aware routing,
- local-preferred / cloud-preferred módok,
- provider health figyelés,
- fallback chain,
- edge-only lehetőségek,
- user preference alapú viselkedés.

---

# 16. Külső integrációk és automation surface-ek

## 16.1. Dokumentált integrációk

| Integráció | Funkció |
|---|---|
| Google Workspace | Gmail, Sheets, Drive, naptár jellegű workflow-k |
| Számlázz.hu | invoice beolvasás és feldolgozás |
| n8n | workflow automation |
| AnythingLLM | külső knowledge/chat surface |
| Apify | deep scraping |
| Jules | teszt / automation / CI-jellegű orchestration |
| Cloudflare | edge, workers, D1, tunnel |
| Chrome ACP / DevTools | browser debug automation |
| code-server | remote IDE felület |
| Tauri | desktop shell |
| Playwright | browser automation |
| LanceDB / ChromaDB | vector knowledge |
| E2B | sandbox execution |
| Nodemailer / Google APIs | kommunikációs/workspace capability-k |

## 16.2. Értékesítési és outreach capability-k

A repo több sales/marketing fókuszú alrendszert is tartalmaz:
- lead mining,
- EV hunter,
- trojan horse campaign,
- campaign studio,
- innovation bridge,
- market watcher,
- grants és pályázat figyelés,
- invoice sync és business analytics.

---

# 17. CLI capability-mátrix

## 17.1. CLI jellemzők

- binárisok: `brunella`, `brunella-jules`, `brunella-hu`
- magyar nyelvű UX
- Commander.js + inquirer + chalk + boxen + ora
- telemetria támogatás
- dashboard- és backend bridge jellegű parancsok

## 17.2. CLI capability-csoportok a `src/cli.ts` alapján

| Csoport | Funkció |
|---|---|
| `gold` | golden / pipeline related |
| `dev` | fejlesztői műveletek |
| `tracks` | track listing és menedzsment |
| `taskDecomposer` | feladatbontás |
| `progress` | előrehaladás |
| `edge` | Cloudflare/edge parancsok |
| `suggestedTasks` | javasolt feladatok |
| `robotkez` | browser automation |
| `conductor` | conductor rescan/state |
| `invoice` | invoice workflow |
| `lead` / `market` | sales & market capability |
| `workspace` | fájl/workspace |
| `dashboard` | dashboard launch/bridge |
| `task` | task execution |
| `guardrails`, `telemetry` | biztonság és megfigyelés |
| `memory` / `memoria` | memóriakezelés |
| `workflow` | workflow engine |
| `swarm` | colony/swarm funkciók |
| `tool-discovery` | tool inventory |
| `security` | security diagnosztika |
| `chrome-acp` | browser devtools bridge |
| `browser-copilot` | magasabb szintű browser assist |
| `crawl4ai` | crawling |
| `observability` | provider és runtime láthatóság |
| `assistant` blueprint summary | személyi asszisztens readiness |

---

# 18. Fejlesztői workflow és operációs capability-k

## 18.1. Build/Test/Lint capability-k

A `package.json` alapján a rendszer támogat:
- `build`
- `dev`
- `smoke`
- `test`
- `test:fast`
- `test:coverage`
- `test:dashboard`
- `test:ui`
- `test:e2e`
- `health`
- `desktop:dev` / `desktop:build`
- `dev:vscode`
- migrációs scriptek

## 18.2. Script-ökoszisztéma

102 top-level script fájl található a `scripts/` könyvtárban.

### Fő script-kategóriák
- sync és session bootstrap,
- health/smoke/monitoring,
- Cloudflare setup és teszt,
- Jules sync,
- security check,
- LanceDB/vector migrációk,
- nightly training,
- invoice automation,
- robotkez tesztek,
- context generation,
- conductor diagnosztika,
- webhook és bridge tesztek.

## 18.3. Fejlesztési governance

| Capability | Leírás |
|---|---|
| Track system | `conductor/tracks/`, `conductor/archive/`, `tracks.md` |
| Rescan and state sync | `brunella conductor rescan` |
| FOSZAL sync | `scripts/sync_foszal.py` |
| Git sync | `scripts/sync.*` |
| Husky hooks | pre-commit / pre-push ellenőrzések |
| AI-agent coordination | `.ai/` naplók |
| Bootstrap protocol | README és `.ai/BOOTSTRAP.md` |

---

# 19. Conductor és projektirányítási capability-k

## 19.1. Track lifecycle

```
PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
```

## 19.2. Fő conductor elemek

| Fájl / mappa | Funkció |
|---|---|
| `conductor/tracks/` | aktív és proposed fejlesztési szálak |
| `conductor/archive/` | archivált trackek |
| `conductor/tracks.md` | auto-generált összefoglaló |
| `conductor/project_state.json` | track state index |
| `src/services/trackStateManager.ts` | újragenerálás, state sync |
| `ProjectConductorAgent` | fejlesztéskoordináció |

## 19.3. Miért fontos ez a Brunellában?

A Brunella nem csak futtat egy AI rendszert, hanem **önmaga fejlesztését is trackeli és koordinálja**, ami a rendszer egyik meta-képessége.

---

# 20. A Brunella legfontosabb tulajdonságai — összefoglaló mátrix

| Tulajdonság | Mit jelent a gyakorlatban |
|---|---|
| Multi-agent | több szerepkörű specialista és koordinátor agent |
| MCP-kompatibilis | AI kliensek felé standard eszközkiszolgálás |
| Full-stack | backend + dashboard + CLI + Python + edge |
| Hibrid AI | local és cloud modellek együtt |
| Browser-native | erős web automation és browser-copilot réteg |
| RAG-native | tudás és memória vektorosan visszakereshető |
| Enterprise-ready | sales, finance, HR, legal, property capability-k |
| Edge-extendable | Cloudflare worker és CEAN réteg |
| Self-healing | Phoenix protocol, retry, recovery |
| Track-driven | fejlesztés és evolúció is formális state-ben él |
| Security-aware | redaction, RBAC, safe zones, sandbox |
| Observable | telemetry, metrics, health, logging |
| CLI + UI + API egyszerre | több felület ugyanarra a capability space-re |
| Evolvable | dinamikus agentek, latent route-ok, remote layer roadmap |

---

# 21. Végkövetkeztetés

A Brunella nem egyetlen alkalmazás, hanem egy **AI-operációs réteg** a következő komponensek összefűzésével:

- intelligens agenthálózat,
- fejlesztői automatizálás,
- browser execution,
- enterprise workflow engine,
- RAG és memória-infrastruktúra,
- dashboard + CLI + REST + MCP többfelületű működés,
- Python AI runtime,
- Cloudflare edge és remote execution,
- önfigyelő és részben öngyógyító architektúra,
- trackelt, evolúciós fejlesztési modell.

Ez a repo tehát egy **teljes AI-rendszerplatform**, amely egyszerre tud kutatni, végrehajtani, fejleszteni, szervezni, tanulni, emlékezni, és több környezetben futni.

---

# 22. Fő forrásfájlok ehhez a mátrixhoz

- `README.md`
- `package.json`
- `src/agents/registry.json`
- `src/server/routes/index.ts`
- `src/server/registry.ts`
- `src/dashboard/lib/navigation.tsx`
- `src/core/`
- `src/security/`
- `src/tools/`
- `myai/`
- `cloudflare/`
- `cloudflare.md`
- `cloudflareversup.md`
- `conductor/`
- `scripts/`
- `logs/`
