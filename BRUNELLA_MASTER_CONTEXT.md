# 🌌 BRUNELLA MASTER CONTEXT (Élő Rendszertérkép)

**Verzió:** 1.0.0
**Frissítve:** 2026-02-25
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

A rendszer **32** regisztrált ügynökkel rendelkezik.

### 👑 Vezérkar (Core Leadership)
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **orchestrator** | undefined | planning, routing, delegation |
| **evaluator** | undefined | audit_system, run_tests, check_health |


### 🛠️ Végrehajtók (Execution Team)
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |


### 🏢 Üzleti és Egyéb Ügynökök
| Ügynök | Szerep | Képességek |
| :--- | :--- | :--- |
| **enterprise_orchestrator** | undefined | enterprise_event_parsing, priority_assignment, module_routing |
| **researcher** | undefined | rag_search, summarization |
| **task_decomposer** | undefined | task_decomposition, dag, preview |
| **Developer** | undefined | code_generation, self_healing |
| **robotkezv2** | undefined | web_search, data_extract, form_fill |
| **qa** | undefined | test_execution, validation |
| **documenter** | undefined | docs, summarization |
| **ops** | undefined | monitoring, diagnostics |
| **project_organizer** | undefined | organization, documentation, cleanup |
| **agent_architect** | undefined | prompt_engineering, agent_design, configuration |
| **integrator** | undefined | integration, knowledge_sync |
| **lint_fixer** | undefined | lint_check, auto_fix, suggest_fix |
| **voice** | undefined | voice_command_refinement, multimodal_context_analysis |
| **ProjectConductor** | undefined | project_management, documentation_sync, track_management |
| **copywriter** | undefined | social_media_generation, email_drafting, copywriting |
| **marketing_director** | undefined | campaign_orchestration, content_assembly, trend_analysis_coordination |
| **SpecWriter** | undefined | track_generation, epp_v2_compliance, requirement_extraction |
| **github_models** | undefined | code_generation, code_review, architecture_design |
| **sales** | undefined | lead_generation, crm_integration, email_drafting |
| **sales_hunter** | undefined | linkedin_scraping, lead_scoring, email_draft_generation |
| **market_intel** | undefined | competitor_scraping, price_extraction, trend_analysis |
| **procurement** | undefined | supplier_price_analysis, negotiation_strategy_selection |
| **finance_guardian** | undefined | invoice_processing, ocr_extraction, anomaly_detection |
| **email_triage** | undefined | email_classification, priority_detection, auto_response |
| **grant_watcher** | undefined | grant_scraping, eligibility_matching |
| **logistics_dispatcher** | undefined | tracking_extraction, route_optimization |
| **knowledge_base_builder** | undefined | message_analysis, wiki_generation |
| **lead_mining** | undefined | lead_generation, web_scraping, icebreaker_generation |
| **innovation_bridge** | undefined | problem_abstraction, triz_analysis, cross_industry_search |
| **law_detective** | undefined | law_monitoring, legal_intelligence, compliance_analysis |


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

