# Technical Specification: Real Estate Sales Campaign

**Track ID:** `real_estate_sales_campaign_20260216`  
**Status:** `pending_approval`  
**Last Updated:** 2026-02-16  

---

## 📖 Context

Egy komplett **ingatlan értékesítési pipeline** automatizálása. A felhasználó feltölt dokumentumokat (térképek, tulajdoni lapok, közműrajzok), a rendszer elvégzi az értékbecslést, piaci kutatást, és pályázótarget listát generál.

**Két Ügynök Szinergia:**
1. **Asset Analyst** – Tulajdoni adat → Valuation
2. **Corporate Hunter** – Lokáció → CEO/Expander azonosítás → Teaser

---

## 🏗️ System Architecture

### Komponens Diagram

```
┌─────────────────────────────────────────────────────┐
│  Dashboard Chat Input (File Upload)                │
├─────────────────────────────────────────────────────┤
│  OrchestratorAgent (Intent: "Real Estate Sales")   │
├──────────────────────┬──────────────────────────────┤
│   Asset Analyst      │    Corporate Hunter         │
│   (Sequential)       │    (Parallel after Phase 1) │
├──────────────────────┼──────────────────────────────┤
│  Gemini Vision OCR   │  LinkedIn + Cégjegyzék      │
│  LanceDB Property DB │  Opten + Cégadatok          │
│  Google Sheets API   │  Gmail API (Draft Sender)   │
└──────────────────────┴──────────────────────────────┘
```

---

## 📋 Data Structures & Interfaces

### Asset Analyst Output (TypeScript)

```typescript
interface PropertyAsset {
  id: string;
  type: 'industrial' | 'agricultural' | 'commercial';
  location: {
    address: string;
    gps: [number, number];
    hrs: string; // Helyrajzi szám
    municipality: string;
  };
  specs: {
    area_sqm: number;
    utilities: string[]; // ['víz', 'gáz', 'ipari áram']
    zoning_classification: string;
    building_condition: 'new' | 'renovated' | 'needs_work';
  };
  documents: {
    map_url: string;
    deed_url: string;
    utility_url: string;
    photos: string[];
  }[];
  valuation: {
    estimated_price_huf: number;
    price_range_min: number;
    price_range_max: number;
    confidence_score: number; // 0-1
    rationale: string;
    comparable_properties: string[]; // URLs
  };
  metadata: {
    extracted_at: Date;
    source: 'chat_upload' | 'google_drive';
  };
}
```

### Corporate Hunter Output (TypeScript)

```typescript
interface TargetCompany {
  company_name: string;
  industry: string;
  expansion_probability: 'High' | 'Medium' | 'Low';
  location: string;
  decision_makers: DecisionMaker[];
  relevant_news: string[];
  interaction_log: InteractionEvent[];
  teaser_email_draft: string;
  email_status: 'draft' | 'approved' | 'sent' | 'bounced';
}

interface DecisionMaker {
  name: string;
  role: string;
  linkedin_url: string;
  email_guess: string | null; // Csak ha validat sources-ből
  confidence: 'high' | 'medium' | 'low';
}
```

---

## 🔌 Integration Points

| Integrációs Pont | Tech Stack | Célja |
|------------------|-----------|-------|
| **Gemini Vision 1.5 Pro** | `myai/core/vision_worker.py` | OCR + dokument értelmezés |
| **Google Drive API** | `src/tools/googleWorkspace.ts` | Fájl feltöltés + Sheets export |
| **LanceDB** | `src/utils/rag.ts` | Property memory + comparable search |
| **LinkedIn API / Browser-use** | `myai/browser_worker.py` | Decision maker research |
| **Opten API** | `src/agents/ResearcherAgent.ts` | Cégjegyzék adatok (HU) |
| **Gmail API** | `src/tools/googleWorkspace.ts` | Draft email mentés |

---

## 🔐 Data Processing Flow

### Phase 1: Asset Recognition
```
1. User uploads PDF/Image
2. ChatInterface → OrchestratorAgent detects intent
3. PropertyAnalystAgent spawned
4. Gemini Vision extracts: HRS, métrage, utilities, zoning
5. Result → PropertyAsset interface
6. Validation: HRS format check, area >0, GPS valid
7. Storage: LanceDB property_valuations table
```

### Phase 2: Market Research
```
1. PropertyAnalystAgent triggers ResearcherAgent
2. Researcher searches: ingatlan.com, iparterulet.hu, local brokers
3. Collects 40+ comparable properties
4. CPython refiner normalizes prices (m²-re lebontás)
5. LanceDB stores market intelligence
6. Valuation algorithm: weighted average + confidence score
```

### Phase 3: Sales Plan Generation
```
1. Valuation ready → googleWorkspace tool activates
2. Template: Sales_Action_Plan_YYYY_HH.mm.ss.xlsx
3. Sections:
   - Property overview
   - Market analysis
   - Target market
   - Sales roadmap (8-12 wks)
   - Teendolista + felelősök
   - Performance KPIs (views, inquiries, offers)
4. Google Sheets batch write API (single atomic operation)
```

### Phase 4: Corporate Hunter Launch
```
1. PropertyAsset location data → hunter.py
2. Search: "Logistics/Manufacturing companies <50km radius"
3. LinkedIn API queries (limited) + browser-use fallback
4. Decision maker identification:
   - CEO/COO/VP Expansion/VP Logistics
   - Email guessing (company pattern matching)
5. Content generation:
   - Teaser PDF (kedvcsináló, no price)
   - Email draft (3 languages: HU, EN, DE)
6. Draft → Gmail Drafts folder (Human review needed!)
7. CRM: Lead created in SQLite
```

### Phase 5: CRM Tracking
```
1. Lead status in Sheets → SQLite sync
2. If user marks "Interested" → automated follow-up scheduled
3. Email open tracking (via Gmail read receipts)
4. Interaction log populated
5. Reporting: conversion rate, time-to-offer metrics
```

---

## 🛡️ Security & Compliance

### GDPR Handling
- **Felelős adatok:** Személynevek, emailcímek, CV-k
- **Tiltott:** Ezek nem kerülhetnek production logokba
- **Megengedett:** Only in-memory або `_br_temp` local storage
- **Audit:** Every harvest logged to SQLite audit_log

### Email Safety Guard
```typescript
if (!email.includes('@') || !emailValidator(email)) {
  return { status: 'draft', error: 'Invalid email - manual review required' };
}
```

---

## 🧪 Testing Strategy

| Test Level | Scope | Tools |
|-----------|-------|-------|
| **Unit** | Pydantic models, PropertyAsset validation | Pytest |
| **Integration** | Gemini API + LanceDB | Vitest + Mock |
| **E2E** | Full pipeline: upload → Sheets → CRM | Playwright |
| **Security** | PII redaction, SQL injection | OWASP scanner |

---

## 📊 Success Metrics

| Metrika | Cél | Mérés |
|---------|-----|---------|
| **Valuation Accuracy** | ±10% vs. expert | Manual sampling |
| **Targets Found** | 50+ /property | Lead count |
| **Email Validity** | >95% valid emails | Bounce rate |
| **Time Saved** | 40h/project → 4h | Manual vs. automation |

---

## 📋 Critical Constraints

1. **Type Safety:** `PropertyAsset` teljes TypeScript typizálás (NO `any`)
2. **API Quotas:** Google Sheets batch writes, LinkedIn throttling
3. **Email Validation:** Strictly validated before sending
4. **HRS Uniqueness:** Duplicate detection before valuation
5. **Confidence Scores:** Always calculated, never hardcoded

---

## 🔄 Human-in-the-Loop Checkpoints

| Pont | Akcó | Felelős |
|------|------|---------|
| **Valuation Review** | ±15% range override | Sales Manager |
| **Target List Review** | Relevance check (quality >85%) | Recruitment |
| **Email Draft Review** | Grammar + tone check | Marketing |
| **CRM Sync** | Manual confirmation first 5 leads | CRM Owner |

---

*TechSpec v1.0 | 2026-02-16*
