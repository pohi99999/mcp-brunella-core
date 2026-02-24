# BAS Enterprise Suite - Implementation Plan

## Executive Summary

Transform BAS into a complete enterprise automation suite with 18 specialized modules covering all critical business functions: HR, Finance, Sales, Logistics, and Market Intelligence. This implementation follows a phased approach with clear dependencies and validation gates.

## Business Context

**Problem:** Small and medium businesses lack access to enterprise-grade automation tools, forcing manual work across HR, accounting, sales, and operations.

**Solution:** Deploy 18 autonomous AI agents that handle repetitive business tasks, from invoice processing to lead generation, all integrated through the BAS core orchestration system.

**Expected ROI:**
- 60-80% reduction in administrative time
- 15-25% cost savings in procurement (via Auto-Negotiator)
- 40% faster sales cycle (via Sales Hunter & Market Intel)
- 100% compliance detection (via Law Detective)

## Implementation Phases

### Phase 1: Infrastructure (Agy és Kéz) - Weeks 1-2

**Goal:** Strengthen the core orchestration and data pipeline

**Deliverables:**
1. **EnterpriseOrchestratorAgent** (`src/agents/EnterpriseOrchestrator.ts`)
   - Extend OrchestratorAgent with enterprise event recognition
   - Implement priority queue (CRITICAL, HIGH, MEDIUM)
   - Add module routing logic

2. **Dynamic Refiner Factory** (`myai/refiners/factory.py`)
   - Pydantic schema switcher based on module type
   - Validation for HR, Invoice, Price, Tracking data types

3. **Unified Workspace Tool** (`src/tools/unified_workspace_tool.ts`)
   - Consolidate Google Workspace API calls
   - Add batch operations for Calendar/Gmail/Sheets

**Validation:** `npm test` passes, new agents registered, mock events routed correctly

---

### Phase 2: Profit & Sales Modules - Weeks 3-4

**Goal:** Deploy revenue-generating automation

#### Module 2.1: Sales Hunter (Automata Értékesítő Gép)
- **Agent:** `SalesHunterAgent.ts`
- **Tools:** LinkedIn scraper, email draft generator
- **Output:** Lead list in Google Sheets + draft emails in Gmail

#### Module 2.2: Dynamic Pricing & Market Intel (Dinamikus Árazó)
- **Agent:** `MarketIntelAgent.ts`
- **Tools:** Competitor price scraper (browser-use)
- **Storage:** LanceDB table `market_trends`
- **Trigger:** Weekly cron or manual command

#### Module 2.3: Auto-Negotiator (Ártárgyaló)
- **Agent:** `ProcurementAgent.ts`
- **Logic:** Compare supplier prices vs market, generate negotiation emails
- **Constraint:** Must cite source URLs (no hallucinations)

**Validation:** Live test with real supplier data, manual approval of emails before sending

---

### Phase 3: Admin & Finance - Weeks 5-6

#### Module 3.1: Financial Guard (Pénzügyi Őrszem)
- **Agent:** `FinanceAgent.ts`
- **Input:** PDF invoices (email attachments)
- **Process:** OCR → Pydantic validation → Google Sheets export
- **Alert:** Duplicate invoices or unusual amounts

#### Module 3.2: Digital Office Manager (Digitális Irodavezető)
- **Agent:** `EmailTriageAgent.ts`
- **Function:** Priority sorting, auto-responses for common queries
- **Integration:** Gmail API + LanceDB for response templates

#### Module 3.3: Grant Watcher (Pályázatfigyelő)
- **Agent:** `GrantMonitorAgent.ts`
- **Source:** Magyar Közlöny, EU funding portals
- **Match Logic:** Company profile (TEÁOR code, employee count) vs eligibility criteria

**Validation:** Process 100 test invoices, verify zero data loss

---

### Phase 4: HR & Soft Skills - Weeks 7-8

#### Module 4.1: Digital Headhunter (Digitális Fejvadász)
- **Agent:** `RecruitmentAgent.ts`
- **Input:** Job description
- **Process:** CV screening (PDF/LinkedIn), interview question generation
- **Output:** Ranked candidate list

#### Module 4.2: Conflict Mediator (Kreatív Súrlódás Mediátor)
- **Agent:** `ConflictAnalysisAgent.ts`
- **Analysis:** Sentiment analysis on internal chat/email threads
- **Action:** Suggest mediation steps or escalation

#### Module 4.3: Local CSR Automaton (Mikro-Helyi CSR)
- **Agent:** `CSRAgent.ts`
- **Function:** Geo-fenced news monitoring for local community involvement opportunities

**Validation:** Ethics review for HR data handling, GDPR compliance check

---

### Phase 5: Logistics & Knowledge - Weeks 9-10

#### Module 5.1: Logistics Dispatcher (Logisztikai Diszpécser)
- **Agent:** `LogisticsAgent.ts`
- **Function:** Extract tracking IDs, monitor delivery status, auto-complaint generation
- **Integration:** GLS, DPD, Magyar Posta APIs

#### Module 5.2: Knowledge Base Builder (Intelligens Tudástár-építő)
- **Agent:** `KnowledgeIndexerAgent.ts`
- **Trigger:** Project folder marked "Completed"
- **Action:** Auto-index documents into LanceDB RAG, generate summary

**Validation:** End-to-end test with real shipment tracking

---

### Phase 6: Advanced Modules - Weeks 11-12

#### Module 6.1: Law Detective (Jogszabály-Detektív)
- **Source:** Magyar Közlöny daily
- **Filter:** TEÁOR code matching, employee count thresholds
- **Alert:** Dashboard notification + summary report

#### Module 6.2: Project-to-Marketing Pipeline
- **Trigger:** Completed project in Drive
- **Output:** Case study draft, LinkedIn/Facebook post variations
- **Approval:** Human-in-the-loop via Dashboard

#### Module 6.3: Digital Archivist (Digitális Irattáros)
- **Function:** Auto-organize Google Drive with naming convention `YEAR_MONTH_PARTNER_TYPE`
- **Classification:** Invoice, Contract, Offer, Technical Doc
- **Safety:** Move to "Trash_Review", never permanent delete

**Validation:** Full integration test across all 18 modules

---

## Integration & Data Flow

```
┌───────────────────────────────────────────────────────┐
│                 User Interaction                      │
│         (Dashboard / Chat / Email / Webhook)          │
└─────────────────┬─────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│         Enterprise Orchestrator Agent                │
│  • Parse intent & context                            │
│  • Assign priority (CRITICAL/HIGH/MEDIUM)            │
│  • Route to specialized module agent                 │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┴─────────┬──────────────┬──────────┐
        ▼                   ▼              ▼          ▼
    ┌──────┐          ┌──────────┐   ┌───────┐  ┌─────────┐
    │ Sales│          │ Finance  │   │  HR   │  │Logistics│
    │Hunter│          │  Guard   │   │Recruit│  │Dispatch │
    └──┬───┘          └────┬─────┘   └───┬───┘  └────┬────┘
       │                   │              │           │
       └─────────┬─────────┴──────────────┴───────────┘
                 ▼
        ┌─────────────────┐
        │  Robotkez V2    │ (Browser-use for web scraping)
        │  Refiner Logic  │ (Python Pydantic validation)
        │  LanceDB RAG    │ (Memory & context storage)
        └─────────────────┘
                 │
                 ▼
        ┌─────────────────┐
        │  Google APIs    │ (Sheets, Gmail, Drive, Calendar)
        │  External APIs  │ (Tracking, Pricing, Legal DBs)
        └─────────────────┘
```

## Critical Success Factors

1. **Type Safety:** No `any` types in EnterpriseEvent payloads
2. **Data Isolation:** HR & Finance data must stay in `_br_temp/`, no cloud sync except R2
3. **Concurrency Control:** LanceDB writes must use retry logic (Node.js vs Python conflicts)
4. **Fail-Safe Gates:** Each phase requires `npm test` ✅ + manual validation before proceeding
5. **Ethics Compliance:** Financial Guard cannot give tax advice, Law Detective must include disclaimer

## Success Metrics

- ✅ All 18 modules operational
- ✅ Zero data loss in 1000-document test
- ✅ Average task completion time < 2 minutes
- ✅ Dashboard shows real-time module status
- ✅ User satisfaction score > 8/10 in pilot testing

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|-----------|
| Google API quota exceeded | HIGH | Implement rate limiting + batch operations |
| Hallucinated data in AI outputs | CRITICAL | Require source citations, validation layers |
| GDPR violation in HR module | CRITICAL | Local-only storage, encryption at rest |
| LanceDB write conflicts | MEDIUM | Retry logic with exponential backoff |

## Next Steps

1. Create track: `conductor/tracks/bas_enterprise_suite_20260216/`
2. Start Phase 1 implementation
3. Daily sync: Developer Agent status updates
4. Weekly review: Orchestrator validates deliverables

---

**Track Owner:** Brunella Orchestrator  
**Technical Lead:** DeveloperAgent  
**Quality Assurance:** EvaluatorAgent  
**Created:** 2026-02-16
