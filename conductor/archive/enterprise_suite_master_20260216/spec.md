# Technical Specification: Enterprise Suite Master

**Track ID:** `enterprise_suite_master_20260216`  
**Status:** `pending_approval`  
**Last Updated:** 2026-02-16  

---

## 📖 Context

A Brunella Agent System (BAS) egy **14 modulos, autonóm vállalati irányító szoftver** kiterjesztésére van szükség. Az aktuális rendszer szépen kezeli az alapműveletek orkestrálását, de az E2E vállalati workflow-ok automatizálása még hiányzik.

**Cél:** Egy „Glass Box" alapú Enterprise Suite, amely az alábbi szakterületeket automatizálja:
- HR (toborzás, konfliktusfeloldás)
- Pénzügy (számla feldolgozás, grant hunting)
- Értékesítés (lead gen, áralkudozás)
- Logisztika (szállítás nyomkövetés, optimalizáció)
- Piaci hírszerzés (trend discovery, compliance monitoring)

---

## 🏗️ System Architecture

### Komponens Overview

```
┌─────────────────────────────────────────────────────────┐
│         EnterpriseOrchestrator (Central Brain)        │
├─────────────────────────────────────────────────────────┤
│  HR Module  │ Finance │ Sales │ Logistics │ Intelligence│
├─────────────────────────────────────────────────────────┤
│  LanceDB (Shared Memory) | GoogleWorkspace API         │
├─────────────────────────────────────────────────────────┤
│  Robotkéz V2 (Browser) | Python Refiner Factory       │
└─────────────────────────────────────────────────────────┘
```

### Data Flow Architecture

```
1. Ingestion
   └─ RobotkezV2Agent / GoogleWorkspace tools (nyers adat)

2. Refining
   └─ Python refiners (validation + strukturálás)

3. Memory
   └─ LanceDB (indexelés a metódus alapján)

4. Action
   └─ Orchestrator (prioritás kiértékelés + delegálás)

5. Feedback Loop
   └─ Audit log (Phoenix Protocol)
```

---

## 📋 Detailed Module Specifications

### 1. HR Modulok

#### 1.1 Digitális Fejvadász (Recruiter Agent)
**Inputs:** CV fájlok, pozícióleírás  
**Outputs:** Szűrt jelölt lista, interjúkérdések  
**Tech Stack:** 
- `myai/refiner_logic.py`: Pydantic CV model
- `src/agents/HeadHunterAgent.ts`: Selection logic

**Grade:** 5000 CV feldolgozás/nap

#### 1.2 Kreatív Súrlódás Mediátor
**Inputs:** Email, chat üzenetek  
**Outputs:** Sentiment analysis, konfliktusfeloldó javaslatok  
**Tech Stack:**
- Python: Transformer modellek (Sentence-BERT)
- `src/agents/ConflictMediatorAgent.ts`: Suggestion engine

**Grade:** Szervezeti hangulat real-time monitoring

#### 1.3 Mikro-Helyi CSR Automata
**Inputs:** Geo-fenced hírek, cégprofil  
**Outputs:** CSR tevékenységpajánlatok  
**Tech Stack:**
- `src/agents/LocalCSRBot.ts`: Geo-matching logic
- Google News API integráció

---

### 2. Pénzügyi Modulok

#### 2.1 Pénzügyi Őrszem (Finance Guardian)
**Inputs:** Számlák (PDF/Email), históriális ár adatok  
**Outputs:** Anamáliák, trend riportok  
**Tech Stack:**
- `myai/refiners/finance_auditor.py`: OCR + estrutúra-kivonat
- LanceDB: Price history tracking

**Grade:** 500+ számla/nap

#### 2.2 Pályázatfigyelő (Grant Hunter)
**Inputs:** Jogszabály-hírek, cégprofil (TEÁOR, létszám)  
**Outputs:** Relevancia szűrés, jogosultság check  
**Tech Stack:**
- `myai/tasks/law_harvester.py`: PDF letöltés + OCR
- `src/agents/ComplianceAgent.ts`: Semantic filtering

---

### 3. Értékesítési Modulok

#### 3.1 Automata Ártárgyaló (Negotiation Engine)
**Inputs:** Történeti beszerzések, piaci ár adatok  
**Outputs:** Alkulevél draft, stratégia javaslat  
**Tech Stack:**
- `src/tools/negotiation_engine.ts`: Email generator
- LanceDB: Historical pricing

#### 3.2 Automata Értékesítő Gép (Sales Agent)
**Inputs:** Nyilvános cégjegyzék, LinkedIn adatok  
**Outputs:** Lead lista, teaser email draft  
**Tech Stack:**
- `myai/browser_worker.py`: LinkedIn scraper
- `src/agents/SalesAgent.ts`: CRM integráció

#### 3.3 Dinamikus Árazó & Piaci Hírszerző
**Inputs:** Web, aukciós oldalak, versenytárs adatok  
**Outputs:** Ár javaslat, trend identifikáció  
**Tech Stack:**
- `src/agents/ResearcherAgent.ts`: Market intel
- LanceDB: Price intelligence DB

---

### 4. Logisztikai Modulok

#### 4.1 Logisztikai Diszpécser (Dispatch Agent)
**Inputs:** Tracking ID-k, szállítási adatok  
**Outputs:** Proaktív értesítések, ETA becslés  
**Tech Stack:**
- `myai/browser_worker.py`: Tracking API harvesters
- `src/agents/LogisticsDispatcher.ts`: Alert engine

#### 4.2 Intelligens Tudástár-építő (Knowledge Agent)
**Inputs:** Lezárt projektek metadata  
**Outputs:** Projekt-case studies, RAG index update  
**Tech Stack:**
- `src/agents/KnowledgeBuilder.ts`: Archive analyzer
- LanceDB: Dynamic indexing

---

### 5. Intelligencia Modulok

#### 5.1 Jogszabály-Detektív (Compliance Agent)
**Inputs:** Magyar Közlöny, SEC fájlok  
**Outputs:** Relevancia szűrés, vezetői összefoglalás  
**Tech Stack:**
- `myai/refiners/law_classifier.py`: Topic matching
- `src/agents/ComplianceAgent.ts`: Alert routing

#### 5.2 Projekt-to-Marketing (Content Agent)
**Inputs:** Lezárt projekt metadata  
**Outputs:** Case study, LinkedIn poszt draft  
**Tech Stack:**
- `src/agents/MarketingAgent.ts`: Content generation
- Google Docs API

---

## 🔐 Data Structures & Interfaces

### Központi Event Interface

```typescript
interface EnterpriseEvent {
  module: 'HR' | 'FINANCE' | 'SALES' | 'LOGISTICS' | 'INTELLIGENCE';
  type: string;
  payload: unknown; // Strict type checking required!
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  storedInLanceDB: boolean;
  timestamp: Date;
  requestId: string; // Traceability
}
```

### Module Context Interface

```typescript
interface ModuleContext {
  moduleId: string;
  state: Record<string, unknown>;
  lancedbConnection: LanceDBClient;
  googleWorkspaceClient: GoogleAuthClient;
  retryPolicy: RetryConfig;
}
```

---

## 🔗 Integration Points

| Komponens | Integrációs Pont | Protokoll |
|-----------|-----------------|-----------|
| **Google Workspace** | Gmail, Sheets, Drive API | OAuth 2.0 REST |
| **LanceDB** | Vector DB for memory | HTTP + Python SDK |
| **Robotkéz V2** | Browser automation | Socket.IO |
| **Ollama/Gemini** | LLM backbone | HTTP REST |

---

## 🛡️ Critical Constraints

1. **Type Safety (MUST)**
   - Zero `any` usage in module interfaces
   - Strict Pydantic validation on refiners

2. **Concurrency Safety**
   - LanceDB write locking with retry logic
   - Node.js/Python IPC timeout: 30s

3. **Data Isolation**
   - HR/Finance data only in `_br_temp` (no cloud sync)
   - Encryption at rest for sensitive fields

4. **Error Handling**
   - All modules implement try/finally pattern
   - Graceful degradation (fallback to manual mode)

5. **Performance**
   - Module latency SLA: <2s per action
   - LanceDB query optimization (indexing)

---

## 🧪 Testing Strategy

| Level | Framework | Target |
|-------|-----------|--------|
| Unit | Vitest | >80% per module |
| Integration | E2E scripts | All cross-module flows |
| Load | k6 / Artillery | 100 concurrent events |

---

## 📊 Success Metrics

| Metrika | Cél | Mérés |
|---------|-----|---------|
| **Module Availability** | 99.5% | Uptime monitor |
| **Data Freshness** | <30min | Harvest frequency |
| **Accuracy (Lead Gen)** | >85% relevance | Manual review sampling |
| **Cost Savings** | >20% operational cost | Audit trail |

---

## 🔄 Phased Rollout

1. **Phase 1:** Infrastructure (Week 1-2)
2. **Phase 2:** Sales modules (Week 3-5)
3. **Phase 3:** Finance modules (Week 3-5, parallel)
4. **Phase 4:** HR modules (Week 6-8)
5. **Phase 5:** Logistics & Wiki (Week 9-10)

---

*TechSpec v1.0 | 2026-02-16*
