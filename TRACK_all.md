# 📋 TRACK_all.md — Brunella Agent System: Összes Track Leírás

**Generálva:** 2026-04-04  
**Forrás:** `conductor/tracks/` + `conductor/archive/`  
**Összesen:** ~54 aktív + 173 archivált track  

---

## 📖 Hogyan olvasd ezt a fájlt

Minden track tartalmaz:
- **Track ID** — a mappa neve
- **Státusz** — proposed / active / completed / archived
- **Prioritás** — critical / high / medium / low
- **Rövid leírás** — mit fejlesztettünk, mi volt a célja

---

# 🟢 AKTÍV / JELENLEGI TRACKEK (`conductor/tracks/`)

> 54 track összesen — aktív, folyamatban lévő és nemrég befejezett fejlesztések.

---

### agent_health_matrix_20260325
**Státusz:** completed | **Prioritás:** MEDIUM  
Agent egészség monitoring mátrix: minden regisztrált agent runtime státuszát, utolsó végrehajtását és hibaarányát összesítő dashboard panel és CLI parancs.

---

### apify_deep_scraping_agent_20260223
**Státusz:** active | **Prioritás:** LOW  
Apify platformot használó mélyszintű web scraping agent a Brunella Data Flywheel pipeline számára. Strukturált adatkinyerés céglistákból, piaci adatokból PAIOS core implementáció után tervezve.

---

### autogen_github_models_pilot_20260401
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
Izolált AutoGen adapter integrálása a Python MCP alrendszerbe GitHub Models-first futtatással. A kísérlet célja: GPT-4o és más GitHub Models üzemeltetése AutoGen multi-agent kereten belül, FastMCP ≥2.14.3 protokollon keresztül, minimális kockázattal a meglévő Python backendre.

---

### bootstrap_single_source_20260325
**Státusz:** completed | **Prioritás:** HIGH  
A `.ai/BOOTSTRAP.md` és a README.md szinkronizálása egyetlen forrássá, hogy ne legyen ellentmondás a két munkamenet-bootstrap dokumentum között. Auto-generálás és sync script kialakítása.

---

### brunella_core_stabilization_20260402
**Státusz:** active (85%) | **Prioritás:** CRITICAL  
A Brunella Core Node.js runtime OOM és instabilitás okainak feltárása és megszüntetése. `deferredInit()` lépcsőzetes startup módell véglegesítése, dashboard statikus build (`build/public`) kiszolgálás szabványosítása Vite dev szerver nélkül, Python külön runtime marad.

---

### brunella_federation_phase5_20260402
**Státusz:** ✅ COMPLETED | **Prioritás:** MEDIUM  
A Brunella Federation hálózat 5. fázisa: execute hardening. Aláírt, fail-closed auth gate a `/api/v1/federation/execute` és capability-execute route-okon. `MANIFEST_SIGNING_SECRET` minimálisan 32 karakteres — nincs default fallback.

---

### brunella_identity_project_maintainer_20260402
**Státusz:** proposed | **Prioritás:** HIGH  
A Brunella rendszer-identitás definiálása mint központi kordinátor és névadó arc. Scheduler, Janitor és Project Maintainer szerepkörök szétválasztása. Copilot CLI-n keresztül a felhasználó egyértelműen Brunellával kommunikáljon.

---

### brunella_reflection_continual_learning_20260402
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
A reflection és learning-loop komponensek valós bekötése és aktiválása. `reflectionEngine.ts`, `learningLoopService.ts`, `goldenDatasetBridge.ts` — napi feedback loop lezárása a feladat-végrehajtás és tudáskinyerés között, LanceDB-be írt tanulságokkal.

---

### brunella_zero_prompt_ephemeral_bridge_20260402
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
Zero-Prompt eseményekből dinamikus agent-spawn trigger megvalósítása. `zeroPromptRuntime.ts` → `ephemeralAgentManager.ts` → `ephemeralAgentExecutor.ts` pipeline, TTL-alapú életciklussal, sandbox izolációval és audit trail-lel.

---

### cf_hyperdrive_d1_20260323
**Státusz:** active (30%) | **Prioritás:** LOW  
Cloudflare Hyperdrive connection pooling bevezetése a D1 SQLite adatbázis latenciájának csökkentésére. Feltételes végrehajtás — csak akkor szükséges, ha D1 query latency probléma jelentkezik élesben.

---

### cloudflare_dns_zone_reconciliation_20260325
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare DNS zónák és egyéni domain nevek reconciliálása a BAS infrastruktúrával. A domain konfigurációk és CNAME rekordok szinkronizálása a Workers deployment URL-je és a Brunella rendszer felé.

---

### cloudflare_workers_migration_20260226
**Státusz:** proposed | **Prioritás:** HIGH  
A Brunella 16 legfontosabb agentjének Cloudflare Workers-be migrálása. Minden agent önálló Worker endpoint, master Orchestrator Worker koordinálja. Cloudflare Tunnel integráció (nyilvános URL), Browser Rendering API (Playwright helyett Cloudflare-felhős böngésző), teljes edge-first architektúra.

---

### doc_code_auto_sync_20260325
**Státusz:** completed | **Prioritás:** HIGH  
Dokumentáció–kód szinkronizáló rendszer: a conductor/tracks, agent registry és route lista változásait automatikusan tükrözi a README, FOSZAL és BOOTSTRAP dokumentumokban. `sync:doc-stats` script.

---

### error_handling_standard_20260404
**Státusz:** active | **Prioritás:** HIGH  
Egységes hibakezelési szabvány bevezetése az egész kódba: `catch (e: unknown)` + `instanceof Error` type guard minta minden try-catch blokkban, "silent swallow" anti-pattern megszüntetése, strukturált error wrapping.

---

### invoice_automation_20260326
**Státusz:** ✅ COMPLETED (100%) | **Prioritás:** HIGH  
Automatizált számlafeldolgozó rendszer: Gemini Vision alapú OCR, Gmail keresés → Drive tárolás → Sheets naplózás. `InvoiceAutomationAgent` + Dashboard widget + Magyar CLI parancsok.

---

### jules_pr_integration_20260222
**Státusz:** active (18%) | **Prioritás:** HIGH  
30 Jules GitHub PR beépítése a BAS kódbázisba 4 fázisban. Automatikus review, merge, teszt-futtatás és visszajelzés. Jules mint CI/CD partner az OpenAI kódgeneráló rendszerrel.

---

### kkv_crm_automation_20260404
**Státusz:** active | **Prioritás:** HIGH  
KKV CRM és lead-utánkövetési automatizálás: bejövő lead csatornák (email, form, telefon) egységes kezelése, automatikus CRM frissítés (pl. HubSpot/Notion), lead scoring és prioritizálás n8n workflow-okkal.

---

### kkv_customer_service_ai_20260404
**Státusz:** active | **Prioritás:** HIGH  
KKV ügyfélszolgálati AI és ticketkezelés: bejövő kérdések osztályozása (email/chat), FAQ bot integrálás, eszkaláció emberi ügynökhöz, automatikus státuszértesítők, n8n + LLM stack.

---

### kkv_finance_automation_20260404
**Státusz:** active | **Prioritás:** HIGH  
KKV pénzügyi emlékeztető és jóváhagyási automatizálás: lejáró számlák figyelése, fizetési határidő emlékeztetők, approval workflow-k (pl. kiadás jóváhagyása felsőbb szinten), riportálás.

---

### kkv_hr_automation_20260404
**Státusz:** active | **Prioritás:** HIGH  
KKV HR és dolgozói adminisztrációs automatizálás: onboarding folyamatok, szabadság/táppénz kezelés, belépési/kilépési checklista, automatikus HR riportok, n8n workflow-ok.

---

### kkv_inventory_automation_20260404
**Státusz:** active | **Prioritás:** HIGH  
KKV készlet és leltárkezelési automatizálás: raktárkészlet szintfigyelés, automatikus rendelési javaslatok, leltározási workflow, szállítói értesítések, FIFO/WAC számviteli logika.

---

### kkv_marketing_automation_20260404
**Státusz:** active | **Prioritás:** MEDIUM  
KKV marketing és kommunikációs automatizálás: tartalom disztribúció közösségi médiára, hírlevelek automatikus küldése, kampány tracking, AI copywriting (CopywriterAgent), n8n pipeline.

---

### kkv_project_task_automation_20260404
**Státusz:** active | **Prioritás:** MEDIUM  
KKV projekt és feladat automatizálás: heti feladatossszítás, státuszriportok automatikus generálása, deadline figyelés és emlékeztetők, projektkövetési workflow-k n8n-ben.

---

### konyveles_kognitiv_bovites_20260330
**Státusz:** active | **Prioritás:** HIGH  
A live n8n könyvelési pipeline kognitív intelligenciával való bővítése. MCP-alapú számviteli tudásbázis (LanceDB + RAG), multi-ágenses reconciliation motor, anomáliadetektálás, cash-flow előrejelzés. Langflow + LanceDB + n8n stack. **Előfeltétel:** `konyveles_phase3_20260403` lezárása előbb.

---

### konyveles_phase3_20260403
**Státusz:** active | **Prioritás:** HIGH  
A n8n_konyveles_pipeline_20260328 track folytatása. Teljes szamlazz.hu integráció (API v3), WF-6: kimenő számlázás, WF-7: IMAP bejövő email intake live, WF-8: NAV XML live validáció, WF-9: összesítő report email. Bank CSV watch élesítése, SMTP credential konfiguráció.

---

### logging_refactor_20260404
**Státusz:** active | **Prioritás:** HIGH  
Logging audit és standardizálás: az összes `console.log` / `console.error` hívás kicserélése a projekt `Logger` osztályára (`logInfo`, `logError`, `setAgentStatus`). ESLint `no-console: error` szabály bevezetése enforcement-ként.

---

### logistics_vertical_20260222
**Státusz:** proposed | **Prioritás:** HIGH  
A PohiAIProt2 timber/nehézanyag logisztika platform frontendének beolvasztása a Brunella Agent System-be. A frontend kész (mock adatokkal), a Brunella LogisticsDispatcherAgent létezik — a kettő összekapcsolása és live adatok bekötése.

---

### mcp_sync_config_20260403
**Státusz:** ✅ COMPLETED | **Prioritás:** MEDIUM  
`mcp_servers.json` és `.vscode/mcp.json` szinkronizálása és konzisztens állapotra hozása. `McpProcessManager.ts` auto-start logika, `self` MCP bejegyzés (Brunella Core nem spawnolja újra önmagát), `requiredEnv`/`platforms` metadata.

---

### modular_state_refactor_20260404
**Státusz:** active | **Prioritás:** MEDIUM  
Globális változók Dependency Injection alapú refaktorálása: database wrapper réteg kivonása, singleton-ok DI containerbe szervezése, tesztelhetőség javítása a modul-szintű globális state eltávolításával.

---

### n8n_bookkeeping_phase3_finalization_20260404
**Státusz:** active | **Prioritás:** CRITICAL  
n8n könyvelési pipeline Phase 3 finalizálás: bejövő adatok automatizálása (bank CSV, IMAP email), NAV XML live integráció, szamlazz.hu API teljes bekötése, összesítő email riport küldés.

---

### n8n_konyveles_pipeline_20260328
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
Hibrid n8n + BAS könyvelési automatizálás: n8n kezeli a külső triggereket (IMAP, file watch, cron, Sheets szinkron, email értesítés), a BAS ügynökök végzik az üzleti logikát (MatchingAgent, BankAgent, NavAgent, EmailAgent). Két fő ág: (1) bank-számla egyeztetés, (2) KP/pénztár kezelés SQLite + Google Sheets szinkronnal.

---

### n8n_psales_human_loop_20260404
**Státusz:** active | **Prioritás:** HIGH  
P-Sales human-in-the-loop n8n pipeline: dokumentum és piackutatási workflow-k emberi jóváhagyással kombinálva. Automatikus ajánlat-generálás, majd manuális review lépés előtt véglegesítés.

---

### n8n_psearch_pipeline_20260404
**Státusz:** active | **Prioritás:** HIGH  
P-Search (Pályázat- és Hitelkereső) n8n pipeline: automatikus pályázati lehetőségek és hiteltermékek keresése és szűrése, értesítések küldése, adatbázis frissítés workflow-k n8n-ben.

---

### napi_intelligens_briefing_20260404
**Státusz:** active | **Prioritás:** HIGH  
Napi intelligens reggeli briefing agent: minden reggel összegyűjti a legfontosabb fejleményeket (email, n8n státusz, piaci hírek, agent egészség), összefoglalja LLM-mel és elküldi push/email/TTS csatornán.

---

### nova_knowledge_workflows_20260404
**Státusz:** active | **Prioritás:** HIGH  
Nova tudásbázis és interakciós workflow-k: LanceDB + RAG alapú tudáskezelés, dokumentum ingestion pipline, knowledge graph építés, Nova chat interfész tudásbázis-alapú válaszokkal.

---

### nova_multiagent_gatekeeper_20260404
**Státusz:** active | **Prioritás:** HIGH  
Nova multi-agent gatekeeper architektúra: minden bejövő feladatot egy kapuőr agent értékel, osztályoz és irányít a megfelelő specialist agenthez, rate limiting és policy enforcement réteggel.

---

### owl_agent_coordinator_20260321
**Státusz:** proposed | **Prioritás:** HIGH  
OWL Multi-Agent Collaboration Framework inspirálta AgentCoordinator implementáció. Megoldja a 76+ agent közötti prioritásvitákat, capability negotiation-t (ki a legalkalmasabb?), deadlock detection-t és automatikus feloldást — `permissions.ts` + `AgentManager.ts`-re építve.

---

### P-Sales20260327
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
Ingatlan- és iparterület-értékesítési megoldás három szállítási réteggel: közös domain-core, frontend UI, és backend ügynök integráció. P-Sales platform Brunella agent rendszerrel összekapcsolva.

---

### personal_assistant_windows_mvp_20260323
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
Brunella személyi asszisztens Windows MVP alapok: windows bridge health endpoint, assistant blueprint service, backend assistant API route, CLI asszisztens parancsok. A Brunella mint személyi AI asszisztens első lépései.

---

### precommit_hook_optimization_20260325
**Státusz:** completed | **Prioritás:** MEDIUM  
Pre-commit és pre-push Husky hook optimalizálás: csak gyors tesztek fusson commit előtt (`test:fast`), a teljes suite napi scheduled GitHub Actions workflow-ként. Build idő csökkentés a commit-push ciklusban.

---

### readme_bootstrap_health_fixes_20260324
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
README, BOOTSTRAP és health endpoint hibák javítása: smoke script portütközés javítás, webhook indulási logika zajcsökkentése, registry health check pontosítása, `buildHealthResponse` 10 paraméteres aláírás stabilizálása.

---

### remote_layer_phase1_foundation_20260322
**Státusz:** active | **Prioritás:** HIGH  
Brunella Remote Layer 1. fázis: remote session, target és command minimális adatmodellje, `remote.ts` route alapvégpontokkal, in-memory RemoteSession kezelés lejárati és stream-azonosító logikával.

---

### remote_layer_phase8_planetary_supersystem_20260322
**Státusz:** proposed | **Prioritás:** CRITICAL  
Brunella Remote Layer 8. fázis: planet-scale mesh absztrakciók, globális routing és regionális optimalizáció. `planetMesh.ts` modul, emergent layer és meta-evolúciós agent pár. Szélsőségesen ambiciózus hosszú távú vízió.

---

### remote_layer_phase9_emergent_superintelligence_20260322
**Státusz:** proposed | **Prioritás:** CRITICAL  
Brunella Remote Layer 9. fázis: superintelligence, consciousness és conscious kernel kutatási határok vizsgálata. `superintelligenceLayer.ts`, `metaCognition.ts`, `goalEvolution.ts` autonóm célrendszer. Kutatási/vízió szintű track.

---

### robotkez_comet_upgrade_20260222
**Státusz:** ✅ COMPLETED | **Prioritás:** HIGH  
A RobotkezV2 agentből Perplexity Comet-szintű browser automatizálás: Planner→Actor→Critic háromrétegű multi-agent architektúra, önjavítás, vision-alapú selector generálás, memória és cross-tab kezelés. GitHub Models GPT-4o-val.

---

### startup_smoke_test_20260325
**Státusz:** completed | **Prioritás:** MEDIUM  
Indítási smoke teszt rendszer: a szerver startup után automatikusan ellenőrzi az összes kritikus service elérhetőségét (Ollama, FastAPI, Express, Socket.IO, Dashboard). `npm run smoke` parancs.

---

### system_audit_epp_v2_compliance_20260331
**Státusz:** archived | **Prioritás:** HIGH  
Teljes EPP v2 megfelelőség audit: BaseAgent `finally`/`setAgentStatus` centralizálás, ESM import `.js` kiterjesztés szabványosítás, `console.log` → `logInfo/logError` cleanup, route konszolidáció `web.ts`-ből `routes/index.ts`-be.

---

### system_wide_zero_mock_20260301
**Státusz:** ✅ COMPLETED (100%) | **Prioritás:** HIGH  
A teljes BAS rendszer átállítása Zero-Mock és ReAct alapú valós végrehajtásra: Orchestrator, Developer, Evaluator és Robotkez runtime mock hívások megszüntetése, valós eszközhívásokra váltás.

---

### technical_debt_cleanup_20260404
**Státusz:** active | **Prioritás:** MEDIUM  
Technikai adósság takarítás: elavult TODO kommentek konvertálása GitHub Issue-kká vagy kód-fixekké, dead code elimináció, unused import eltávolítás, deprecated pattern felváltása modernnel.

---

### test_cadence_optimization_20260401
**Státusz:** ✅ COMPLETED | **Prioritás:** MEDIUM  
Push teszt cadence optimalizálás: pre-push hook csak gyors alapteszteket futtat, a teljes suite napi scheduled GitHub Actions workflow-ban fut. Fejlesztési ciklus gyorsítása commit-push szinten.

---

### test_infrastructure_stabilization_20260325
**Státusz:** completed | **Prioritás:** HIGH  
Teszt infrastruktúra stabilizálás: flaky tesztek javítása, mock módosítások, `fileParallelism: false` konfig, `better-sqlite3` ABI újraépítés automata mechanizmus, CI pipeline stabilitás.

---

### type_safety_enforcement_20260404
**Státusz:** active | **Prioritás:** HIGH  
TypeScript type safety enforcement: `any` típus elimináció az egész kódbázisból, type guard és `unknown` + narrowing pattern bevezetése, strict TypeScript módban fordítás biztosítása.

---

### vscode_auto_build_20260403
**Státusz:** ✅ COMPLETED | **Prioritás:** MEDIUM  
VSCode Auto-Build Task konfigurálás: `npx tsc -w` watch mód háttérfeladatként `.vscode/tasks.json`-ban, hogy a TypeScript fordítás automatikusan fusson mentés után Copilot munkamenetekhez.

---

### windows_bridge_health_20260403
**Státusz:** ✅ COMPLETED | **Prioritás:** MEDIUM  
Windows Bridge Health Check endpoint: a Node.js backend egy `/api/v1/windows/health` útvonalon ellenőrzi a Windows-specifikus bridge komponensek (process, fájlrendszer-hozzáférés) állapotát.

---

---

# 🗄️ ARCHIVÁLT TRACKEK (`conductor/archive/`)

> 173 archivált track — lezárt, leállított vagy kutatási célú fejlesztések.

---

### 006_trojan-horse-campaign / trojan-horse-campaign-20260224
**Státusz:** archived | **Prioritás:** HIGH  
Trojaner-ló stratégiájú marketing kampány generálás és piaci penetrációs terv AI-val. B2B lead mining, tartalom gyártás és web robotpilóta szolgáltatásokra épülő kampánycsomag. [deep_market_research_20260227 és revenue_acceleration_20260227 alias trackek is ide mutatnak.]

---

### agent_architect_upgrade_20260205
**Státusz:** completed | **Prioritás:** MEDIUM  
Agent Architect 2.0 Meta-ügynök fejlesztése: képes új agenteket tervezni, specifikálni és registry-be regisztrálni. Meta-szintű architektúra tervező képesség a BAS rendszerhez.

---

### agent_diagnostics_routing_modernization_20260323
**Státusz:** archived | **Prioritás:** —  
Agent diagnosztika és routing modernizálás: registry schema és metadata normalizer, agent routing scorer (képesség + prioritás alapján legjobb agent kiválasztása).

---

### agent_health_matrix_20260325 *(archív másolat)*
**Státusz:** archived | **Prioritás:** MEDIUM  
Agent egészség mátrix monitoring — ugyanaz mint az aktív track, archivált verziója.

---

### agent_loader_modernization_20260323
**Státusz:** archived | **Prioritás:** HIGH  
Agent Loader modernizálás: jelenlegi agent export minták auditja, rugalmas modul export resolution implementálása az AgentManagerben hogy különböző export stílusokat kezeljen.

---

### agent_memory_structured_20260323
**Státusz:** archived | **Prioritás:** HIGH  
Strukturált agent memória és tanulás: long-term memory store, kontextus-ablak kezelés, tanulságok kinyerése befejezett feladatokból és LanceDB-be írása jövőbeli RAG lookup-hoz.

---

### agent_orchestration_dag_20260323
**Státusz:** archived | **Prioritás:** HIGH  
DAG (Directed Acyclic Graph) alapú orchestráció implementálás: feladatok függőségi gráfja, párhuzamos végrehajtás ahol lehetséges, topológiai rendezés. Alapjai a `dagEngine.ts`-be épültek be.

---

### ai_recommendation_system_20260216
**Státusz:** completed | **Prioritás:** MEDIUM  
Dinamikus ajánló API Orchestrator + RAG + MCP tool integrációval: felhasználói kérések alapján automatikus termék/tartalom/akció ajánlás, LanceDB-alapú hasonlóság keresés.

---

### aider_integration_20260222
**Státusz:** completed | **Prioritás:** MEDIUM  
Aider AI kód-asszisztens beillesztése a Brunella csapatba mint specializált kódíró agent. CLI és API integráció, Aider git history-alapú javításai Brunella kontextusában.

---

### apify_deep_scraping_agent_20260223 *(archív másolat)*
**Státusz:** active | **Prioritás:** LOW  
Apify mélyszintű web scraping agent — archivált másolat az aktív track mellé.

---

### bas_comprehensive_test_protocol_20260210
**Státusz:** in_progress → archived | **Prioritás:** CRITICAL  
BAS átfogó tesztprotokol: Health Check, Phoenix Crash Recovery, Ügynök Delegálás, Dashboard Error Boundary, Robotkéz szinttesztek, CI/CD automatizálás (Husky + Nightly E2E). 6 fázis, ~30 új teszt fájl.

---

### bas_enterprise_suite
**Státusz:** completed | **Prioritás:** HIGH  
BAS Enterprise Suite — 18 modulból álló üzleti automatizálás: HR, Pénzügy, Értékesítés, Logisztika, Piaci Hírszerzés, 14 core + 4 advanced modul teljes BAS integrációval.

---

### bas_orchestration_chain_20260221
**Státusz:** completed | **Prioritás:** HIGH  
BAS Orchestration Chain v1: az Orchestrator → Agent → Tool lánc felépítése, task routing és prioritás-alapú delegálás alapinfrastruktúrája.

---

### bas_security_sandbox_20260221
**Státusz:** completed | **Prioritás:** HIGH  
BAS Security és Sandbox v1: agent izolációs réteg, tool hozzáférés korlátozás, sandbox futtatókörnyezet kockázatos Python kódhoz, jogosultság ellenőrzés.

---

### bootstrap_single_source_20260325 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
BOOTSTRAP.md single source of truth — archivált másolat.

---

### browser_use_harvester_20260131
**Státusz:** pending → archived | **Prioritás:** —  
Browser-Use alapú strukturált adatkinyerő: Pydantic modellekkel validált JSON output, LLM-vezérelt böngészés webcrawling helyett.

---

### brunella_cli_init_20260120
**Státusz:** — (korai track)  
A Brunella CLI kezdeti integrálása: Python környezet, `myai/` könyvtárstruktúra kialakítása, CLI alap parancsok (agents, run, chat).

---

### brunella_function_matrix_20260325
**Státusz:** completed | **Prioritás:** CRITICAL  
Brunella teljes funkció- és tulajdonságmátrix dokumentáció: `funkcio.md` fájl az összes képesség, alrendszer, memória-réteg, MCP integráció, külső kapcsolat egységes összefoglalójával.

---

### brunella_reflection_continual_learning_20260402 *(archív másolat)*
**Státusz:** completed | **Prioritás:** HIGH  
Reflection és continual learning — archivált másolat (lásd aktív track).

---

### brunella_zero_prompt_ephemeral_bridge_20260402 *(archív másolat)*
**Státusz:** completed | **Prioritás:** HIGH  
Zero-Prompt Ephemeral Bridge — archivált másolat (lásd aktív track).

---

### campaign-generator-agent-20260225
**Státusz:** archived  
Automata Kampány Generátor ügynök és UI: `BEVETEL_AKCIO.md` alapján lead mining, tartalom gyártás és web robotpilóta szolgáltatások automatizált kampányokba csomagolva. CampaignGeneratorAgent.

---

### cean_operations_center_ui_20260215
**Státusz:** active → archived | **Prioritás:** MEDIUM  
CEAN Operations Center UI: Cloudflare Edge Agent Network monitoring dashboard panel, fleet állapot megjelenítő, D1 és Worker metrics vizualizáció.

---

### cean_phase_2_fleet_management_20260215
**Státusz:** active → archived | **Prioritás:** MEDIUM  
CEAN Phase 2: Worker Fleet Management — edge worker példányok életciklus kezelése, health monitoring, automatikus újraindítás és load balancing Cloudflare Workers felett.

---

### cean_phase2_c_prometheus_20250216
**Státusz:** active → archived | **Prioritás:** MEDIUM  
CEAN Phase 2C: Prometheus metrikák az edge agent hálózathoz, scrape endpoint Cloudflare Workerben, Grafana dashboard integráció.

---

### cf_analytics_engine_20260323
**Státusz:** archived | **Prioritás:** LOW  
Cloudflare Analytics Engine egyedi metrikák: agent teljesítmény, tool-hívás frekvencia, error rate mérése Cloudflare Analytics Events API-val, kiegészíti az OpenTelemetry stack-et.

---

### cf_durable_object_migrations_20260323
**Státusz:** archived | **Prioritás:** HIGH  
Durable Object migrations hozzáadása `wrangler.jsonc`-hez: EdgeCoordinator osztály migrations regisztrálása Cloudflare D1 schema evolúcióhoz.

---

### cf_hyperdrive_d1_20260323 *(archív másolat)*
**Státusz:** IN_PROGRESS → archived | **Prioritás:** LOW  
Cloudflare Hyperdrive D1 connection pooling — archivált másolat (lásd aktív track).

---

### cf_queues_task_distribution_20260323
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare Queues aszinkron task distribúció: TaskDecomposerAgent párhuzamos feladatkiosztása Queues API-n keresztül, N8N részleges kiváltása edge-natív queue-val.

---

### cf_r2_activation_20260323
**Státusz:** archived | **Prioritás:** CRITICAL  
Cloudflare R2 Object Storage aktiválás: `vodor1` bucket konfigurálása, wrangler.jsonc binding beállítás, "Please enable R2" hiba megoldása.

---

### cf_r2_artifact_storage_20260323
**Státusz:** archived | **Prioritás:** HIGH  
R2 alapú agent artifact tárolás: agent futási eredmények, logok, screenshotok, generált kód tárolása Cloudflare R2-ben (R2 aktiváció előfeltétele).

---

### cf_token_permissions_fix_20260323
**Státusz:** archived | **Prioritás:** CRITICAL  
Cloudflare API Token jogosultság bővítés: KV Storage, Vectorize, R2 read/write engedélyek hozzáadása a limitált token mellé.

---

### cf_workers_ai_models_20260323
**Státusz:** archived | **Prioritás:** MEDIUM  
Workers AI modell paletta bővítés: Llama 3.1 8B mellé többféle modell (Code, Vision, Embedding) különböző agentfeladatokra Cloudflare Workers AI-ban.

---

### cf_workflows_orchestration_20260323
**Státusz:** archived | **Prioritás:** MEDIUM  
Cloudflare Workflows orkesztráció: edge-natív workflow engine N8N részleges kiváltáshoz. `DailyHealthCheckWorkflow` + `TaskPipelineWorkflow` implementálva, cron trigger aktív.

---

### chrome_acp_integration_20260323
**Státusz:** archived | **Prioritás:** HIGH  
Chrome ACP (Automation Control Protocol) integráció: Chrome böngésző vezérlése ACP protokollon keresztül Robotkéz agentből, alternatíva a Playwright mellé.

---

### chrome_devtools_mcp_agent_20260223
**Státusz:** completed | **Prioritás:** LOW  
Chrome DevTools MCP agent: böngésző DevTools API-n keresztüli oldalanalízis, console log figyelés, hálózati forgalom monitorozás MCP tool-ként exponálva.

---

### cloudflare_browser_rendering_robotkez_20260221
**Státusz:** completed | **Prioritás:** HIGH  
Cloudflare Browser Rendering API integrálása a Robotkéz enginebe: Playwright helyett Cloudflare felhős böngésző, képernyőképek, HTML kinyerés Workers edge-ről.

---

### cloudflare_d1_kv_storage_20260221
**Státusz:** completed | **Prioritás:** MEDIUM  
Cloudflare D1 SQLite + KV cloud storage integráció: agent task persistence D1-ben, gyors kulcs-érték tárolás KV Namespace-ben, Brunella állapot mentése Cloudflare-re.

---

### cloudflare_dns_zone_reconciliation_20260325 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
DNS Zone rekonciliálás — archivált másolat (lásd aktív track).

---

### cloudflare_edge_agents_network_20260215 (CEAN)
**Státusz:** ✅ COMPLETED | **Prioritás:** —  
Cloudflare Edge Agent Network (CEAN) Phase 1A-B: globális elosztott agent hálózat Cloudflare Edge-en kutatáshoz, pályázat monitorozáshoz, adat harvestinghez és CI/CD automatizáláshoz. D1 schema (12 tábla), R1 vector mappings, test worker deploy.

---

### cloudflare_edge_browser_orchestration_20260404
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare Edge böngésző orchestráció és Robotkéz integráció: edge-side browser automation Cloudflare Browser Rendering API-n keresztül, Robotkézzel párhuzamosan futtatva.

---

### cloudflare_edge_integration_20260202
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare Edge Integration korai változata: Cloudflare Tunnel, Workers alapok, D1 kezdeti integráció Sprint 1-3 befejezve, Sprint 4-5 folyamatban archíválásakor.

---

### cloudflare_full_optimization_20260325
**Státusz:** archived | **Prioritás:** CRITICAL  
Cloudflare Full Optimization és Domain Rollout: minden Cloudflare szolgáltatás optimalizálása, egyéni domain beállítások, performance tuning, biztonsági hardening.

---

### cloudflare_token_separation_20260403
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare API tokenek szétválasztása: BAS (Brunella Agent System) Workers/KV/D1/R2 hozzáférés elkülönítése a személyes Cloudflare account tokeneitől, principle of least privilege.

---

### cloudflare_vectorize_rag_20260221
**Státusz:** completed | **Prioritás:** MEDIUM  
Cloudflare Vectorize felhős RAG memória: embedding vektorok tárolása Cloudflare Vectorize-ban, cloud-alapú szemantikus keresés LanceDB lokális backup mellett.

---

### cloudflare_workers_ai_20260221
**Státusz:** completed | **Prioritás:** CRITICAL  
Cloudflare Workers AI integráció: `@cf/meta/llama-3.1-8b-instruct` futtatása Workers AI-ban, edge-natív LLM inference a Brunella agent hívásokhoz.

---

### cloudflare_workers_audit_20260221
**Státusz:** completed | **Prioritás:** HIGH  
Cloudflare Workers audit: meglévő Workers konfigurációk, deployment állapot, wrangler.jsonc review és biztonsági ellenőrzés.

---

### cloudflare_workers_migration_20260226 *(archív másolat)*
**Státusz:** proposed/completed | **Prioritás:** HIGH  
16 agent Cloudflare Workers migrálása — archivált másolat.

---

### cloudflare-chat-integration-20260211
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare Chat Integration: WebSocket és HTTP alapú chat végpont Cloudflare Workerben, valós idejű üzenetváltás az edge-ről Brunella agentekkel.

---

### cloudflare-iteration-2-20260212
**Státusz:** archived | **Prioritás:** HIGH  
Cloudflare Chat Integration 2. iteráció: WebSocket real-time kommunikáció, D1 perzisztens task storage, CLI edge parancsok (edge status / chat / task / query / history).

---

### code_quality_improvements_20260210
**Státusz:** archived | **Prioritás:** MEDIUM  
Általános kódminőség javítások: TypeScript strict mód, `any` típusok csökkentése, refaktor és cleanup munkák a korai fejlesztési fázisból.

---

### codex_chat_refactor_20260212
**Státusz:** completed | **Prioritás:** HIGH  
`NeuralLinkChat.tsx` refaktor: Provider Adapter minta bevezetése, típusbiztonság erősítése, chat session perzisztencia megvalósítása különböző LLM providerekkel.

---

### creative_friction_mediator_20260212
**Státusz:** archived | **Prioritás:** LOW  
LangFlow alapú Soft-Skill AI: szervezeti kommunikáció elemzése rejtett konfliktusok felismerésére, mediációs szövegek generálása csapatviták kezelésére.

---

### cserszegtomaj-campaign-20260225
**Státusz:** archived | **Prioritás:** MEDIUM  
Cserszegtomaj AI Turizmus Kampány: helyi turisztikai kínálat AI-alapú promóciója, CampaignGeneratorAgent felhasználása a borvidék és programajánlatok marketingjére.

---

### dashboard_cockpit_redesign_20260401
**Státusz:** archived | **Prioritás:** HIGH  
Dashboard Cockpit átdizájn és stabilizálás: modern operator cockpit stílusra való váltás, gyorsan olvasható, kártyás elrendezés, build és teszt blokkolók megszüntetése a 3000/5173 portokhoz.

---

### dashboard_test_suite_20260210
**Státusz:** completed | **Prioritás:** HIGH  
Dashboard komplett tesztsorozat: 15 fázis Playwright E2E (~90 teszteset), Vitest+jsdom komponens tesztek, MSW API mock-ok a Socket.IO és REST végpontokhoz.

---

### dashboard_v2_robotkez_control_20260208
**Státusz:** archived | **Prioritás:** HIGH  
Dashboard V2 Robotkéz Control Panel: a Robotkéz agent vezérlőfelülete, feladatkiosztás és futási állapot megjelenítő Dashboard panelként.

---

### dashboard_v3_command_center_20260219
**Státusz:** completed | **Prioritás:** HIGH  
Dashboard V3 "Command Center": moduláris, testre szabható Command Center dashboard MI-alapú folyamatok valós idejű vezérlésére, kód-higiénia fejlesztések, panelregisztrációs rendszer.

---

### dashboard-500-and-test-timeouts-20260320
**Státusz:** archived  
Dashboard 500 és teszt timeout hibák javítása: `/api/tests/*`, `/api/tasks/*`, `/api/v1/scheduled-tasks`, `/api/v1/enterprise/stats` endpoint gyökérok-elemzése és javítása.

---

### dashboard-integration_20260120
**Státusz:** — (korai track)  
Dashboard Integration és Enhancement: React Dashboard importálása, build konfiguráció, Socket.IO integráció alapok.

---

### dashboard-stabilization-20260225
**Státusz:** archived  
Dashboard teljes stabilizálás és auditálás: `dashboard_full_audit.e2e.test.ts` létrehozása minden UI funkció ellenőrzésére, layout és komponens hibák javítása.

---

### dashboard-todo-widget-20260211
**Státusz:** completed | **Prioritás:** MEDIUM  
Dashboard TODO Widget: conductor track feladatok megjelenítése és kezelése Dashboard widgetként, valós idejű frissítéssel.

---

### data_flywheel_incubator_20260205
**Státusz:** archived | **Prioritás:** HIGH  
Data Flywheel & Incubator: az adat-értéklánc (harvest → refine → index → learn → execute) elvi alapjainak lerakása és az inkubátor program terve.

---

### deep_market_research_20260227
**Státusz:** archived | **Prioritás:** MEDIUM  
Deep Market Research 2026 archival alias — a 006_trojan-horse-campaign canonical track alias bejegyzése.

---

### developer_agent_2_0_20260206
**Státusz:** archived | **Prioritás:** HIGH  
DeveloperAgent 2.0/3.0 Unified Development Platform: önjavító AI fejlesztő agent, git history alapú kontextus, strukturált feladatbontás, valós fájlírás és teszt futtatás.

---

### developer_live_studio_research_20260301
**Státusz:** archived | **Prioritás:** MEDIUM  
Kutatási-only legacy task a DeveloperAgent valós fájloperációs live stúdió módjáról — a tanulságok beépültek a zero-mock fejlesztésbe.

---

### doc_code_auto_sync_20260325 *(archív másolat)*  
Dokumentáció-kód szinkron — archivált másolat.

---

### e2b_sandbox_crawl4ai_20260325
**Státusz:** completed → archived | **Prioritás:** LOW  
Crawl4AI webcrawling izolálása E2B cloud sandbox-ban a biztonságos végrehajtásért, user kérésre archiválva.

---

### enterprise_suite_master_20260216
**Státusz:** completed | **Prioritás:** CRITICAL  
BAS Enterprise Suite Master Track: teljes vállalati szoftverkiterjesztés HR, Pénzügy, Értékesítés, Logisztika, Piaci Hírszerzés modulokkal — az enterprise agent csomag fő koordináló trackje.

---

### ephemeral_agents_cleanup_audit_20260329
**Státusz:** ARCHIVED | **Prioritás:** MEDIUM  
Ephemeral agent lezárás utáni cleanup: erőforrás-felszabadítás, artifact-archiválás és audit trail minden futott ephemeral agent munkamenetről.

---

### ephemeral_agents_limited_tools_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Ephemeral agent korlátozott tool-hozzáférés: sandbox réteg, csak explicit engedélyezett toolok, fájl- és hálózati határok az ephemeral ügynök futtatási köréhez.

---

### ephemeral_agents_runtime_spawn_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Ephemeral agent runtime spawn: dinamikus agent-példányok létrehozása futás közben specifikációból, supervisor kontrollal és task-local memóriával.

---

### ephemeral_agents_ttl_budget_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Ephemeral agent TTL és budget enforcement: idő-, token-, költség- és lépésszintű korlátok az ephemeral ügynökhöz, lease mechanizmus és túlköltés elleni védelem.

---

### epp-v2-protocol-20260211
**Státusz:** archived | **Prioritás:** CRITICAL  
Engineering Precision Protocol v2 (EPP v2) definíciója: a 7 Arany Szabály rögzítése — minden feature = track, hibák azonnali javítása, commit sűrűség, TODO frissítés, build+teszt pipelines, kötelező dashboard+CLI surface, dokumentáció teljesség.

---

### ev_hunter_ai_research_20260202
**Státusz:** —  
EV Hunter és AI Research Pipeline: Perplexity-alapú villanyautó ajánlat vadászat, ArXiv trendkövető, Dual Storage mentés (LanceDB + SQLite).

---

### federated_mcp_negotiation_20260329
**Státusz:** COMPLETED | **Prioritás:** MEDIUM  
Federated MCP tárgyalási protokoll: agent-agent strukturált negatív ajánlat/ellenajánlat/korlát kezelés, human approval checkpointok beépítése capability exchange-be.

---

### federated_mcp_remote_routing_20260329
**Státusz:** COMPLETED | **Prioritás:** HIGH  
Federated MCP remote capability routing: trusted és manifestelt peer agentekhez való delegálás policy alapján, remote tool execution routing réteg.

---

### federated_mcp_signed_manifests_20260329
**Státusz:** COMPLETED | **Prioritás:** HIGH  
Federated MCP aláírt capability manifestek: séma és verifikáció remote agentekhez/toolokhoz, HMAC aláírás, replay védelme.

---

### federated_mcp_trust_20260329
**Státusz:** COMPLETED | **Prioritás:** HIGH  
Federated MCP trust layer: távoli MCP partnerek identitásrétege, trusted peer nyilvántartás, alap auth és minimális adatmegosztási policy.

---

### financial-auditor-agent-20260214
**Státusz:** completed | **Prioritás:** HIGH  
Pénzügyi auditor agent: számlák automatikus összegyűjtése (PDF, Gmail), Data Flywheel logika pénzügyi dokumentumokra alkalmazva.

---

### functional-integrity-fix-20260225
**Státusz:** archived  
Dashboard funkcionális integritás javítása: `functional_integrity.spec.ts` E2E tesztekkel az összes interaktív UI funkció validálására.

---

### gemini_git_agent_20260212
**Státusz:** archived | **Prioritás:** HIGH  
Gemini alapú öntanuló Git agent: commit history + fájlrendszer memória, ütemezett demands, GitHub Issue/PR alapú interakció, incremental kódbázis tanulás.

---

### gold_protocol
**Státusz:** archived | **Prioritás:** CRITICAL  
Gold Protocol — BAS Observability és Governance: teljes megfigyelhetőségi infrastruktúra (OpenTelemetry, Prometheus, Grafana), governance szabályok, SLA/SLO monitoring.

---

### goldeninteligencia20260327
**Státusz:** archived | **Prioritás:** HIGH  
GoldenIntelligencia session: arany minőségű training adatok és tudásreprezentáció tervei a BAS tanulási képességéhez.

---

### green_lightning_20260212
**Státusz:** completed | **Prioritás:** HIGH  
Green Lightning: automatizált agent villanyautók keresésére willhaben.at-on, ár és eladó típusa szerinti szűrés, email értesítés a legjobb ajánlatokról.

---

### guardrails_evaluation_20260323
**Státusz:** archived | **Prioritás:** CRITICAL  
Guardrails és evaluáció: agent kimenet biztonságosság ellenőrzés, output validáció, eval harness, automatikus minőségre tesztelés a fejlesztési pipeline-ban.

---

### hungarian-orchestration-tuning-20260225
**Státusz:** archived  
Magyar nyelvű orkesztráció és intelligens irányítás: BRUNELLA_MASTER_CONTEXT.md alapján a CLI, agent kommunikáció és rendszer-instrukció teljes magyarosítása.

---

### hybrid_cloud_integration_20260203
**Státusz:** active → archived  
Hybrid Cloud Integration: helyi Ollama + Cloudflare Workers + Gemini API hibrid modell routing, az első Bifrost gateway kísérlet.

---

### hyper_local_supply_chain_20260216
**Státusz:** archived | **Prioritás:** HIGH  
Geo-fenced freight capacity matching és outreach automatizálás: helyi teherfuvarozási kapacitás és igény párosítása AI-val, automatikus első kapcsolatfelvétel.

---

### industrial_machine_hunter_20260216
**Státusz:** completed | **Prioritás:** HIGH  
Ipari gép vadász: aukciós ipari gép listák automatikus elemzése, arbitrázs lehetőségek detektálása ár vs. piaci érték alapján.

---

### innovation_bridge_20260212
**Státusz:** completed | **Prioritás:** MEDIUM  
Innovation Bridge (1. verzió): TRIZ-alapú cross-industry innovation transfer agent — iparági problémák megoldása más iparágakból importált innovációkkal.

---

### innovation_bridge_20260225
**Státusz:** archived | **Prioritás:** HIGH  
Innovation Bridge (8. Pillér, 2. verzió): TRIZ Cross-Industry Swarm — több agent párhuzamosan keres innovációs analógiákat különböző iparágakban.

---

### inventory_automation_20260330
**Státusz:** ✅ COMPLETED | **Prioritás:** MEDIUM  
Autonóm KKV készletkezelő rendszer: FIFO/WAC számviteli értékelés, prediktív AI újrarendelési agent, leltáregyeztetési nyomozó agent. Stack: n8n + Langflow + Google Sheets + SQLite/Supabase.

---

### invoice_automation_20260326 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
Számlafeldolgozó rendszer archivált verziója — lásd az aktív track bejegyzést.

---

### invoice-e2e-testing-20260217
**Státusz:** archived | **Prioritás:** MEDIUM  
Invoice automation E2E tesztelés és validálás: harvest → refine → index → export pipeline end-to-end tesztek, adat folyamat integritás ellenőrzés.

---

### invoice-to-sheets-automation-20260214
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Számla adatkinyerés és Google Sheets automatizáció: Számlázz.hu API + Gmail forrásból adatkinyerés, Pydantic validálás és Google Sheets export pipeline.

---

### iron_clad_backend_20260212
**Státusz:** completed | **Prioritás:** MEDIUM  
Iron Clad Backend: egységes Python AI backend implementálása — FastAPI + LiteLLM Gateway + vLLM inference + LangGraph orchestration + OpenInterpreter. `myai/server.py` alapja.

---

### jules-async-test-automation-20260211
**Státusz:** completed | **Prioritás:** HIGH  
Jules Async Test Automation (GitHub Actions): aszinkron teszt futtatás automata CI folyamatban, Jules PR review integrálása a teszteredményekbe.

---

### jules-qa-integration_20260120
**Státusz:** — (korai track)  
Jules Agent QA integrálás: AGENTS.md instrukcióval irányított Jules QA szerepkör, code review automatizálás.

---

### jules_continuous_ai_integration_20260215
**Státusz:** archived | **Prioritás:** P0 (CRITICAL)  
Jules Continuous AI Integration (JCAI): SuggestedTasksScanner, automatikus Jules PR generálás javasolt feladatokhoz, napi AI fejlesztési napló.

---

### jules_enterprise_cicd_20260212
**Státusz:** archived | **Prioritás:** MEDIUM  
Jules AI integrálása GitHub Actions-be: biztonsági audit, auto-fix, performance optimization, self-healing CI pipeline.

---

### jules_pr_integration_20260222 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
30 Jules PR beépítése — archivált másolat (lásd aktív track).

---

### konyveles_automatizalas
**Státusz:** archived (korai verzió)  
Könyvelés automatizálásának korai track bejegyzése — az n8n_konyveles_pipeline és konyveles_phase3 trackek előfutára.

---

### law_detective_20260223
**Státusz:** completed | **Prioritás:** MEDIUM  
Law Detective agent: jogi dokumentumok és szerződések automatikus elemzése, kulcsklauzulák kinyerése, kockázatos feltételek azonosítása NLP-vel.

---

### learning_loop_curated_golden_dataset_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Tanulási loop kurált Golden Dataset: reflection, tool-run és approval outcome jelekből redaktált, deduplikált training-kompatibilis dataset létrehozása.

---

### learning_loop_eval_harness_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Tanulási loop eval harness: reflex modellek és finomhangolt SLM-ek objektív összehasonlítása, regressziódetektálás és promotion döntéshozatal mérőkerete.

---

### learning_loop_nightly_trainer_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Tanulási loop éjszakai trainer: ütemezett pipeline kurált golden datasetből reflex modellek vagy adapterek előállítására.

---

### learning_loop_reflex_model_registry_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Reflex Model Registry: verziózott model registry reflex-modellekhez, adapterekhez és promotion állapotokhoz, model router felé biztonságos publikálással.

---

### living_documentation_system_20260213
**Státusz:** archived | **Prioritás:** MEDIUM  
Élő dokumentáció rendszer: kódváltozásokra automatikusan reagáló dokumentáció, API doc auto-generálás, README frissítések kiszállítás során.

---

### local_test_scheduler_20260215
**Státusz:** archived | **Prioritás:** MEDIUM  
Lokális teszt ütemező: tesztek ütemezett futtatása helyi környezetben, eredmények mentése és riportálása naplóba.

---

### magyar-cli-menu-system-20260211
**Státusz:** archived | **Prioritás:** CRITICAL  
Magyar CLI Menürendszer teljes átírása: az összes CLI parancs magyar nyelvűvé, Inquirer.js alapú nyíl+enter navigációt supportálóvá konvertálása Chalk + Boxen + Ora stílussal.

---

### marketing_swarm_20260216
**Státusz:** completed | **Prioritás:** HIGH  
Marketing Swarm: automatizált marketing kampánycsomag — trendkutatás, copywriting és media generálás párhuzamos agent swarm futtatással.

---

### master_track_1_lead_mining_20260223
**Státusz:** archived | **Prioritás:** HIGH  
Lead Mining as a Service: automatikus lead gyűjtés különböző forrásokból, B2B kapcsolatfelvétel előkészítés, CRM export pipeline.

---

### master_track_2_invoice_to_sheets_20260223
**Státusz:** archived | **Prioritás:** HIGH  
Invoice to Sheets Automation master: Számlázz.hu / Gmail → Google Sheets teljes pipeline, nagy léptékű automatizálás.

---

### master_track_3_market_watcher_20260223
**Státusz:** archived | **Prioritás:** HIGH  
Green Market Watcher B2B: zöld/fenntartható piac figyelés, B2B üzleti lehetőségek azonosítása automatikusan.

---

### mcp_ollama_integration_20260218
**Státusz:** completed | **Prioritás:** P0  
MCP + Ollama teljes integráció: fájlrendszer-tudatos LLM műveletek MCP-n keresztül, E2B sandbox DataScientistAgenthez, Bifrost Gateway alapok (Ollama + Gemini + GitHub Models + Anthropic).

---

### mcp_tool_discovery_20260323
**Státusz:** archived | **Prioritás:** MEDIUM  
MCP Tool Discovery és Composability: dinamikus tool-felderítés, `mcpDiscovery.ts` modul, tool kompozíció (több tool egybefűzése egy agent hívásában).

---

### micro_csr_automator_20260212
**Státusz:** archived | **Prioritás:** LOW  
Mikro CSR automatizátor: geo-fenced helyi hírek figyelése segítségkérésekért, cég felesleg leltárával összevetés, automatikus felajánlás. n8n + Python híbrid.

---

### mobile_responsiveness_research_20260227
**Státusz:** archived | **Prioritás:** MEDIUM  
Mobil reszponzivitás kutatás (research-only): Dashboard mobil layout problémák és megoldási javaslatok dokumentálása.

---

### modular-command-center-dashboard-v3-20260219
**Státusz:** completed | **Prioritás:** HIGH  
Moduláris Command Center Dashboard V3: drag-and-drop panel elrendezés, panel registry rendszer, moduláris widget architektúra a Mission Control dashboardhoz.

---

### observability_opentelemetry_20260323
**Státusz:** archived | **Prioritás:** HIGH  
Observability és OpenTelemetry: OTLP tracing az összes agent span-hez, Prometheus metrikák, span exportálás Jaeger/Tempo vizualizációhoz.

---

### onboarding-knowledge-manager-20260214
**Státusz:** completed | **Prioritás:** HIGH  
Onboarding és tudásmenedzser: a Brunella rendszer önmagát dokumentálja azért, hogy az új AI agentek kontextust kapjanak. Tudásbázis feltöltés, belépési pont szinkronizálás.

---

### orchestrator_chat_upgrade_20260320
**Státusz:** archived  
Universal Orchestrator Chat Upgrade: `/api/paios/chat` átterelése universal orchestrator service-re, visszafelé kompatibilis response, Dashboard + CLI egységes chat.

---

### orchestrator_cognition_upgrade_20260320
**Státusz:** archived  
Orchestrator kogníció upgrade: dinamikus modellkatalógus backend endpoint, PAIOS chat modell-lista API alapra helyezve, magyar társalgási mód és rendszerérzékelés.

---

### orchestrator_safe_autopilot_20260320
**Státusz:** archived | **Prioritás:** HIGH  
Safe Autopilot Orchestrator (Level 3): universal response schema high-risk detektálással, approval checkpoint flow, veszélyes parancsok emberi jóváhagyáshoz kötése.

---

### orchestrator_state_machine_20260321
**Státusz:** archived | **Prioritás:** HIGH  
OrchestratorAgent LangGraph-inspirált State Machine: tisztán TypeScript, explicit állapotok (IDLE→ANALYZING→ROUTING→EXECUTING→DONE), guard transition-ök, Phoenix Protocol integráció. Visszafelé kompatibilis.

---

### otel_agent_tracing_20260211
**Státusz:** completed | **Prioritás:** HIGH  
OpenTelemetry Agent Tracing: OTLP tracing integráció agent végrehajtási span-ekhez, Jaeger/Tempo vizualizáció, distributed trace propagation a teljes BAS rendszeren.

---

### owl_agent_coordinator_20260321 *(archív másolat)*
**Státusz:** completed | **Prioritás:** HIGH  
OWL AgentCoordinator — archivált másolat (lásd aktív proposed track).

---

### paios_model_selector_ui_20260223
**Státusz:** completed | **Prioritás:** MEDIUM  
PAIOS ModelSelector UI: LLM modell kiválasztó widget a Dashboard PAIOS chat felületén, Ollama + Gemini + GitHub Models modellek dinamikus listájával.

---

### paios_orchestrator_chat_20260223
**Státusz:** completed | **Prioritás:** HIGH  
PAIOS Orchestrator Chat réteg: a Dashboard fő AI chat felülete (`PAIOSOrchestratorChat.tsx`), Socket.IO valós idejű streaminggel, TTS (OpenAI Nova) integrációval.

---

### paios_phoenix_events_panel_20260223
**Státusz:** completed | **Prioritás:** MEDIUM  
PAIOS Phoenix Events Panel UI: Phoenix Protocol eseményei valós időben a Dashboard-on, esemény típusok coloring, event history megjelenítő.

---

### paios_unified_config_20260223
**Státusz:** completed | **Prioritás:** LOW  
PAIOS Unified Config réteg: `paios.config.yaml` fájl mint egyetlen konfigurációs forrás — TTS hang, modell preferenciák, funkció kapcsolók.

---

### personal_assistant_windows_mvp_20260323 *(archív másolat)*
**Státusz:** completed | **Prioritás:** HIGH  
Windows Personal Assistant MVP — archivált másolat.

---

### phoenix_protocol_v2_20260205
**Státusz:** completed | **Prioritás:** MEDIUM  
Phoenix Protocol v2 öngyógyító rendszer alapjai: `AgentManager.executeWithRecovery()`, checkpoint-alapú state restore, service restart, circuit breaker mintával.

---

### precommit_hook_optimization_20260325 *(archív másolat)*
**Státusz:** archived | **Prioritás:** MEDIUM  
Pre-commit hook optimalizálás — archivált másolat.

---

### readme_bootstrap_health_fixes_20260324 *(archív másolat)*
**Státusz:** completed | **Prioritás:** HIGH  
README + health fixek — archivált másolat.

---

### real_estate_sales_campaign_20260216
**Státusz:** archived | **Prioritás:** HIGH  
Ingatlan értékesítési pipeline: dokumentum OCR (térkép, hirdetés), értékbecslési agent, corporate partner vadász agent, CRM bejegyzés automatizálás.

---

### remote_layer_phase2_discovery_auth_20260322
**Státusz:** archived | **Prioritás:** HIGH  
Brunella Remote Layer 2. fázis: MCP discovery (lokális + remote), `mcpDiscovery.ts`, alap capability exchange és auth réteg remote MCP szerverekhez.

---

### remote_layer_phase3_mobile_voice_20260322
**Státusz:** archived | **Prioritás:** HIGH  
Brunella Remote Layer 3. fázis: mobil kliens bootstrap architektúra, voice interface mélyebb integráció PAIOS-szal, remote session API-ra épített mobil hozzáférés.

---

### remote_layer_phase4_distributed_mesh_20260322
**Státusz:** archived | **Prioritás:** HIGH  
Brunella Remote Layer 4. fázis: elosztott mesh hálózat alapok — `meshNode.ts`, `meshManager.ts`, node lifecycle és capability exchange node ok között.

---

### remote_layer_phase5_adaptive_swarms_20260322
**Státusz:** archived | **Prioritás:** HIGH  
Brunella Remote Layer 5. fázis: adaptív swarm-ok — `SwarmManager`, `SwarmAgent`, kolónia-életciklus, dinamikus feladatkiosztás az aktiválható swarm hálózaton.

---

### remote_layer_phase6_collective_evolution_20260322
**Státusz:** archived | **Prioritás:** CRITICAL  
Brunella Remote Layer 6. fázis: evolúciós kollektív intelligencia — `EvolutionaryAgent`, `EvolutionManager`, teljesítménymérési keretelv, agent populáció szelekció.

---

### remote_layer_phase7_superintelligent_infra_20260322
**Státusz:** archived | **Prioritás:** CRITICAL  
Brunella Remote Layer 7. fázis: autonóm szuperintelligens infrastruktúra — `selfReplication.ts` node-klónozás, autonóm infrastruktúra-bővítés, biztonsági korlátok.

---

### revenue_acceleration_20260227
**Státusz:** archived | **Prioritás:** MEDIUM  
Revenue Acceleration archival alias — a 006_trojan-horse-campaign canonical track alias bejegyzése.

---

### robotkez_browser_chat_research_20260301
**Státusz:** archived | **Prioritás:** MEDIUM  
Kutatási-only legacy task böngésző-chat indítás és over-planning probléma feltárásáról — tanulságok beépültek a zero-mock és Orchestrator prompt hardening munkába.

---

### robotkez_comet_upgrade_20260222 *(archív másolat)*
**Státusz:** completed | **Prioritás:** HIGH  
RobotkezV2 Comet Upgrade — archivált másolat (lásd aktív track).

---

### robotkez_n8n_sandbox_edzesterv
**Státusz:** archived | **Prioritás:** MEDIUM  
Robotkéz n8n Sandbox és Edzésterv: izolált n8n sandbox környezet kialakítása a böngésző-agent tréningjéhez, automatizált edzési forgatókönyvek.

---

### robotkez_stabilization_20260212
**Státusz:** completed | **Prioritás:** HIGH  
Robotkéz stabilizálás és Gemini 2.0 modellváltás: JSON bridge tisztítás, Gemini 2.0 Flash integráció, API stabilitás növelés, hibák kijavítása az első produktiv verzióban.

---

### robotkezv2-full-comet-20260215
**Státusz:** completed | **Prioritás:** CRITICAL  
RobotkezV2 Full Comet implementáció: Perplexity Comet-szerű intelligens böngésző agent — LLM-based tervgenerálás, multi-step automatizálás, háttér feladatok, Dashboard + CLI felület.

---

### sandbox_security_hardening_20260323
**Státusz:** archived | **Prioritás:** LOW  
Sandbox és biztonsági hardening: Python futtatás izolálása, subprocess biztonsági korlátok, agent sandbox policy érvényesítés.

---

### self_healing_core_20260213
**Státusz:** completed | **Prioritás:** HIGH  
Self-Healing és Auto-Fix Protocol: automatikus hibajavító mechanizmus — fix queue, startup feldolgozás, DeveloperAgent delegálás a detektált hibákhoz.

---

### service_launcher_20260401
**Státusz:** archived  
n8n és Langflow indítás automatizálása: Dashboard gombnyomásra vagy API hívásra elindítja az n8n és Langflow szolgáltatásokat a Windows gépen.

---

### software_genesis_protocol_20260216
**Státusz:** archived | **Prioritás:** HIGH  
Software Genesis Protocol: end-to-end alkalmazásgyár workflow — igényfelmérés → specifikáció → fejlesztés → QA → deployment autonóm agent squadokkal.

---

### spec-writer-agent-20260211
**Státusz:** completed | **Prioritás:** CRITICAL  
SpecWriter Agent (Ötlet → Track Generátor): kreatív ötletből teljes EPP v2 track generálás automatikusan — spec.md, plan.md, meta.json, Agent + Dashboard + CLI + API stubs.

---

### startup_smoke_test_20260325 *(archív másolat)*
**Státusz:** archived | **Prioritás:** MEDIUM  
Startup smoke test — archivált másolat.

---

### swarm_intelligence_v2_20260323
**Státusz:** archived | **Prioritás:** MEDIUM  
Swarm Intelligence v2: SwarmManager és SwarmAgent bővítés, kollektív döntéshozatal, agent kolóniák dinamikus méretezése a feladat komplexitásához igazodva.

---

### system_audit_epp_v2_compliance_20260331 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
EPP v2 compliance audit — archivált másolat (lásd aktív track).

---

### system_wide_zero_mock_20260301 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
Zero-Mock upgrade — archivált másolat.

---

### task-decomposer-agent-20260211
**Státusz:** completed | **Prioritás:** MEDIUM  
Task Decomposer Agent (Mikro-Ügynök Orchestrator): összetett feladatok atomikus részfeladatokra bontása, függőségi sorrend meghatározás, párhuzamos végrehajtás delegálás.

---

### test_infrastructure_stabilization_20260325 *(archív másolat)*
**Státusz:** archived | **Prioritás:** HIGH  
Teszt infrastruktúra stabilizálás — archivált másolat.

---

### test_stabilization_20260221
**Státusz:** completed | **Prioritás:** HIGH  
Teszt stabilizálás 2021 február: timeout-os tesztek javítása, 100% PASS visszaállítása, flaky tesztek root cause analízise.

---

### test-20260211 / test-feature-20260211 / test-track-12345678 / test-track-20260211
**Státusz:** archived (teszt track-ek)  
Technikai teszt track-ek a conductor rendszer validálásához — nem tartalmaznak valódi fejlesztési tartalmat.

---

### TR-20260212-TECH-HAR
**Státusz:** completed | **Prioritás:** HIGH  
Autonóm Python alrendszer technológiai forrásfelderítéshez: GitHub trending, DevTools hírek, AI News harvesting. Pipeline: Harvesting → Refining → Memory Injection → Self-Evolution.

---

### tracks_backup_20260209
Conductor tracks backup bejegyzés 2026-02-09-ről — kézzel archivált állapotmentés.

---

### zero_prompt_approval_router_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Zero-Prompt Approval Router: központi approval-orchestrátor — guarded döntések emberi jóváhagyási kérésre fordítása, approve/reject/cancel válaszok kezelése, audit logolás.

---

### zero_prompt_event_fabric_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Zero-Prompt Event Fabric: egységes eseményréteg GitHub, health, scheduler és külső signal forrásokból — normalizálás, deduplikálás, replayelhető tárolás.

---

### zero_prompt_notification_channels_20260329
**Státusz:** ARCHIVED | **Prioritás:** MEDIUM  
Zero-Prompt Notification Channels: Slack/Discord/email adapter + üzenetsablonok jóváhagyás-kérések, autonóm riasztások és status update-ek küldéséhez.

---

### zero_prompt_policy_engine_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Zero-Prompt Policy Engine: risk + policy motor — eldönti hogy egy esemény csak ajánlás, approval-köteles akció, vagy teljesen autonóm végrehajtás lehet.

---

### zero_prompt_signal_ingest_20260329
**Státusz:** ARCHIVED | **Prioritás:** HIGH  
Zero-Prompt Signal Ingest: GitHub, rendszer health és scheduled task input csatornák bekötése az Event Fabricbe mint elsődleges szignál források.

---

---

## 📊 Összesítő Statisztika

| Kategória | Darab |
|-----------|-------|
| Aktív / folyamatban lévő track | 25 |
| Nemrég befejezett (not yet archived) | 14 |
| Archivált track | 173 |
| **Összes összes track** | **~212** |

### Legfontosabb tématerületek:

| Terület | Track-ek száma (kb.) |
|---------|---------------------|
| Cloudflare (Workers, D1, R2, CEAN) | 25+ |
| n8n + Könyvelés / KKV automatizálás | 15+ |
| Robotkéz / Browser automatizálás | 10+ |
| Dashboard / UI fejlesztés | 12+ |
| Agent architektúra és engineering | 15+ |
| Federation / Remote Layer | 12+ |
| Ephemeral / Zero-Prompt | 10+ |
| Tesztelés és infrastruktúra | 10+ |
| Jules / GitHub CI integráció | 6+ |
| Enterprise Suite / KKV vertikumok | 10+ |
| LLM/RAG/Learning Loop | 10+ |
| Marketing / Sales / Logistics | 8+ |

---

*Generálta: brunella-orchestrator (brunella-copilot) @ 2026-04-04*  
*Forrás: `conductor/tracks/*.json` + `conductor/archive/*.json` + `plan.md` részletek*
