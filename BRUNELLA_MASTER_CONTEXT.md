# 🌌 BRUNELLA MASTER CONTEXT (Élő Rendszertérkép)

**Verzió:** 2.4.0
**Frissítve:** 2026-03-25
**Státusz:** ACTIVE (Élő rendszer)

---

## 1. 🏗️ Rendszer Áttekintés (The Big Picture)

A **Brunella Agent System (BAS)** egy hibrid, multi-agent AI ökoszisztéma, amelyet szoftverfejlesztés, kutatás és üzleti folyamatok automatizálására terveztek.

**Fő Jellemzők:**
*   **Hibrid Architektúra:** Node.js (Orchestration) + Python (AI/ML/Browser) + Cloudflare (Edge).
*   **Lokális + Felhő AI:** Ollama (Privát) + Gemini/OpenAI (Teljesítmény).
*   **Öngyógyító:** Phoenix Protocol v2 (Hiba detektálás és újraindítás).
*   **Memória:** SQLite (Feladatok) + LanceDB (Vektor/RAG) + AnythingLLM (Tudásbázis).

---

## 2. 🤖 Az Ügynök Sereg (The Legion)

A rendszer **54** regisztrált ügynökkel rendelkezik.

### 👑 Vezérkar (Core Leadership)
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **evaluator** | undefined | audit_system, run_tests, check_health |
| **NurturerAgent** | Marketing & Campaign Manager |  |
| **orchestrator** | undefined | planning, routing, delegation |


### 🛠️ Végrehajtók (Execution Team)
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **RobotkezV2** | Magyar Agentic Browser (Comet Stílus) |  |


### 🏢 Üzleti és Egyéb Ügynökök
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **agent_architect** | undefined | prompt_engineering, agent_design, configuration |
| **ApifyScraping** | Research & Intelligence — Deep Web Scraper |  |
| **Architect** | architect |  |
| **ChromeDevTools** | Web Debug & Performance Analyst |  |
| **CampaignGenerator** | undefined |  |
| **MarketingDirector** | undefined |  |
| **PropertyVisionary** | undefined |  |
| **ConflictMediator** | Organizational Conflict Resolution |  |
| **copywriter** | undefined | social_media_generation, email_drafting, copywriting |
| **DataScientist** | scientist |  |
| **DependencyGraph** | Dependency Graph Analyzer |  |
| **Developer** | undefined | code_generation, self_healing |
| **DevOps** | devops |  |
| **DigitalHeadhunter** | Automated HR Screening & Recruitment |  |
| **documenter** | undefined | docs, summarization |
| **EdgeProxy** | Edge Proxy & Remote Access |  |
| **email_triage** | undefined | email_classification, priority_detection, auto_response |
| **enterprise_orchestrator** | undefined | enterprise_event_parsing, priority_assignment, module_routing |
| **finance_guardian** | undefined | invoice_processing, ocr_extraction, anomaly_detection |
| **FinancialGuard** | Automated Invoice Processing & Anomaly Detection |  |
| **github_models** | undefined | code_generation, code_review, architecture_design |
| **grant_watcher** | undefined | grant_scraping, eligibility_matching |
| **innovation_bridge** | undefined | problem_abstraction, triz_analysis, cross_industry_search |
| **knowledge_base_builder** | undefined | message_analysis, wiki_generation |
| **law_detective** | undefined | law_monitoring, legal_intelligence, compliance_analysis |
| **lead_mining** | undefined | lead_generation, web_scraping, icebreaker_generation |
| **lint_fixer** | undefined | lint_check, auto_fix, suggest_fix |
| **LocalCSR** | Sustainability & Social Responsibility Tracking |  |
| **logistics_dispatcher** | undefined | tracking_extraction, route_optimization |
| **LogisticsDispatcher** | Automated Shipment Tracking & Complaint Management |  |
| **market_intel** | undefined | competitor_scraping, price_extraction, trend_analysis |
| **marketing_director** | undefined | campaign_orchestration, content_assembly, trend_analysis_coordination |
| **ops** | undefined | monitoring, diagnostics |
| **PricingAgent** | Market Intelligence & Dynamic Pricing |  |
| **ProactiveClaimsAgent** | Insurance & Risk Management |  |
| **procurement** | undefined | supplier_price_analysis, negotiation_strategy_selection |
| **project_organizer** | undefined | organization, documentation, cleanup |
| **ProjectConductor** | undefined | project_management, documentation_sync, track_management |
| **PropertyAnalyst** | Ingatlan Elemző |  |
| **Python** | Python Subsystem Guardian |  |
| **qa** | undefined | test_execution, validation |
| **researcher** | undefined | rag_search, summarization |
| **robotkezv2** | undefined | web_search, data_extract, form_fill |
| **sales** | undefined | lead_generation, crm_integration, email_drafting |
| **sales_hunter** | undefined | linkedin_scraping, lead_scoring, email_draft_generation |
| **SpecWriter** | undefined | track_generation, epp_v2_compliance, requirement_extraction |
| **task_decomposer** | undefined | task_decomposition, dag, preview |
| **UXDesigner** | User Experience Designer Agent |  |
| **voice** | undefined | voice_command_refinement, multimodal_context_analysis |
| **critic_agent** | undefined | quality_review, hallucination_detection, secret_leak_detection |


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

