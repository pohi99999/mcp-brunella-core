# 🌌 BRUNELLA MASTER CONTEXT (Élő Rendszertérkép)

**Verzió:** 2.4.0
**Frissítve:** 2026-04-22
**Státusz:** ACTIVE (Élő rendszer)

---

## 1. 🏗️ Rendszer Áttekintés (The Big Picture)

A **Brunella Agent System (BAS)** egy hibrid, multi-agent AI ökoszisztéma, amelyet szoftverfejlesztés, kutatás és üzleti folyamatok automatizálására terveztek.

**Fő Jellemzők:**
*   **Hibrid Architektúra:** Node.js (Orchestration) + Python (AI/ML/Browser) + Cloudflare (Edge).
*   **Lokális + Felhő AI:** Ollama (Privát) + Gemini/OpenAI (Teljesítmény).
*   **Öngyógyító:** Phoenix Protocol v2 (Hiba detektálás és újraindítás).
*   **Memória:** SQLite (Feladatok) + LanceDB (Vektor/RAG) + AnythingLLM (Tudásbázis).
*   **Docs/config SOT:** warning (75/100, docs 4/4, config 57% / 39%).

---

## 2. 🤖 Az Ügynök Sereg (The Legion)

A rendszer **79** regisztrált ügynökkel rendelkezik.

### 👑 Vezérkar (Core Leadership)
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **evaluator** | undefined | audit_system, run_tests, check_health |
| **orchestrator** | undefined | planning, routing, delegation |


### 🛠️ Végrehajtók (Execution Team)
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **RobotkezV2** | Magyar Agentic Browser (Comet Stílus) | web_search, data_extract, form_fill |


### 🏢 Üzleti és Egyéb Ügynökök
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **InvoiceAutomation** | undefined | gmail_read, vision_extraction, ocr_extraction |
| **SzamlazzHu** | undefined | szamlazz_fetch, invoice_normalization, sheets_sync |
| **agent_architect** | undefined | prompt_engineering, agent_design, configuration |
| **ApifyScraping** | Research & Intelligence — Deep Web Scraper |  |
| **Architect** | architect |  |
| **ChromeDevTools** | Web Debug & Performance Analyst |  |
| **ViktoriaPhygital** | Luxury Fashion Phygital Orchestrator | lux_harvesting, visual_brand_safety, bilingual_extraction |
| **CampaignGenerator** | undefined |  |
| **BrunellaProjectManager** | undefined | project_status, track_snapshot, foszal_summary |
| **ProjectMaintainer** | undefined | root_cleanup, log_rotation, track_verification |
| **ReconciliationIngestion** | Pénzügyi adat ingesztor | finance-ingestion, data-normalization, accounting-parsing |
| **AdvancedMatching** | Intelligens párosító motor | smart-reconciliation, partial-payment-split, fx-recalculation |
| **PropertyVisionary** | undefined |  |
| **ConflictMediator** | Organizational Conflict Resolution |  |
| **copywriter** | undefined | social_media_generation, email_drafting, copywriting |
| **viktoria-brand-voice** | undefined | brand-voice, caption-writing, email-drafting |
| **social_concierge** | undefined | social_post_drafting, social_reply_drafting, dm_drafting |
| **shopping_assistant** | undefined | shopping_guidance, availability_reply, order_support |
| **DataScientist** | scientist |  |
| **DependencyGraph** | Dependency Graph Analyzer |  |
| **Developer** | undefined | code_generation, self_healing |
| **DevOps** | devops |  |
| **DigitalHeadhunter** | HR aszisztens és Toborzási specialist | cv_parsing, candidate_matching, leave_approval |
| **documenter** | undefined | docs, summarization |
| **EdgeProxy** | Edge Proxy & Remote Access |  |
| **NavAgent** | undefined | nav_api_integration, xml_parsing, data_normalization |
| **AnomalyDetection** | Pénzügyi anomáliadetektáló |  |
| **CashFlowPrediction** | Cash-flow elemző |  |
| **email_triage** | undefined | email_classification, priority_detection, auto_response |
| **enterprise_orchestrator** | undefined | enterprise_event_parsing, priority_assignment, module_routing |
| **github_models** | undefined | code_generation, code_review, architecture_design |
| **grant_watcher** | undefined | grant_scraping, eligibility_matching |
| **innovation_bridge** | undefined | problem_abstraction, triz_analysis, cross_industry_search |
| **law_detective** | undefined | law_monitoring, legal_intelligence, compliance_analysis |
| **lead_mining** | undefined | lead_generation, web_scraping, icebreaker_generation |
| **lint_fixer** | undefined | lint_check, auto_fix, type_check |
| **LocalCSR** | Sustainability & Social Responsibility Tracking |  |
| **LogisticsDispatcher** | Automated Shipment Tracking & Complaint Management |  |
| **market_intel** | undefined | competitor_scraping, price_extraction, trend_analysis |
| **marketing_director** | undefined | campaign_orchestration, content_assembly, trend_analysis_coordination |
| **procurement** | undefined | supplier_price_analysis, negotiation_strategy_selection |
| **project_organizer** | undefined | organization, documentation, cleanup |
| **ProjectConductor** | undefined | project_management, documentation_sync, track_management |
| **PropertyAnalyst** | Ingatlan Elemző |  |
| **Python** | Python Subsystem Guardian |  |
| **qa** | undefined | test_execution, validation |
| **researcher** | undefined | rag_search, summarization |
| **DailyAgentBriefing** | undefined | tech_harvester, agent_news, web_research |
| **sales** | undefined |  |
| **SpecWriter** | undefined |  |
| **TaskDecomposer** | undefined |  |
| **UXDesigner** | User Experience Designer Agent |  |
| **voice** | undefined |  |
| **EmailAgent** | undefined |  |
| **BankAgent** | Transaction Watcher |  |
| **MatchingAgent** | The Brain |  |
| **SheetsSyncAgent** | UI Sync |  |
| **InventoryFifoAgent** | Készletkezelő — FIFO értékelés |  |
| **InventoryWacAgent** | Készletkezelő — WAC értékelés |  |
| **DemandForecastAgent** | Kereslet-előrejelzési ágens |  |
| **SafetyStockAgent** | Biztonsági készlet kalkulátor |  |
| **PurchaseOrderAgent** | Autonóm beszerzési rendelés generáló |  |
| **StocktakeReconciliationAgent** | undefined | inventory_reconciliation |
| **StocktakeReportAgent** | undefined | inventory_reporting |
| **InventoryAdjustmentAgent** | undefined | accounting_preparation |
| **AccountingPipeline** | undefined |  |
| **PettyCashAgent** | Házi pénztár kezelő |  |
| **i18n_specialist** | undefined |  |
| **InventoryPipeline** | undefined |  |
| **StudioSupervisor** | undefined |  |
| **MediaIngest** | undefined |  |
| **StoryCut** | undefined |  |
| **AudioMix** | undefined |  |
| **ColorPrep** | undefined |  |
| **QcRender** | undefined |  |
| **StudioReviewer** | undefined |  |


---

## 3. ⚙️ Technológiai Stack (The Engine)

### Backend (Core)
*   **Runtime:** Node.js (TypeScript)
*   **Server:** Express.js + Socket.IO
*   **Port:** 3000

### Python Subsystem (Intelligence)
*   **Server:** FastAPI
*   **Port:** 8010 (Health), 8000 (API)
*   **Libs:** Pandas, Playwright, LanceDB

### AI Models
*   **Local:** Ollama (llama3.1:8b)
*   **Cloud:** Gemini 2.0 Flash, GPT-4o

---

## 4. 🖥️ Interfészek

*   **Mission Control Dashboard:** http://localhost:5173
*   **Brunella CLI:** 

---

**Ez a dokumentum automatikusan generált. Ne szerkeszd kézzel!**
*Script: scripts/update_master_context.ts*

