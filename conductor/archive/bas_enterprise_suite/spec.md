# BAS Enterprise Suite - Technical Specification

## System Architecture

### Core Components

#### 1. Unified Event System

**TypeScript Interface:**
```typescript
// src/types/enterprise.ts
export interface EnterpriseEvent {
  module: 'HR' | 'FINANCE' | 'SALES' | 'LOGISTICS' | 'INTELLIGENCE';
  type: string;
  payload: ModulePayload;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  storedInLanceDB: boolean;
  timestamp: string;
  userId?: string;
}

export type ModulePayload = 
  | HRPayload 
  | FinancePayload 
  | SalesPayload 
  | LogisticsPayload 
  | IntelligencePayload;

interface HRPayload {
  type: 'recruitment' | 'conflict_analysis' | 'csr_opportunity';
  data: unknown;
}

interface FinancePayload {
  type: 'invoice_processing' | 'grant_eligibility' | 'procurement_negotiation';
  data: unknown;
}

interface SalesPayload {
  type: 'lead_generation' | 'market_intel' | 'campaign_automation';
  data: unknown;
}

interface LogisticsPayload {
  type: 'shipment_tracking' | 'complaint_generation';
  data: unknown;
}

interface IntelligencePayload {
  type: 'competitor_analysis' | 'law_monitoring' | 'trend_detection';
  data: unknown;
}
```

#### 2. Enterprise Orchestrator Agent

**Path:** `src/agents/EnterpriseOrchestrator.ts`

**Responsibilities:**
- Recognize enterprise events from user input
- Assign priority based on context (e.g., invoice due date → CRITICAL)
- Route to appropriate specialized agent
- Maintain execution history in LanceDB

**Key Methods:**
```typescript
class EnterpriseOrchestratorAgent extends OrchestratorAgent {
  async parseEnterpriseIntent(input: string): Promise<EnterpriseEvent>;
  async routeToModule(event: EnterpriseEvent): Promise<AgentResponse>;
  async monitorExecution(eventId: string): Promise<ExecutionStatus>;
}
```

#### 3. Dynamic Refiner Factory (Python)

**Path:** `myai/refiners/factory.py`

**Purpose:** Validate and structure incoming data based on module type

```python
from pydantic import BaseModel, ValidationError
from typing import Union

class InvoiceData(BaseModel):
    invoice_number: str
    amount: float
    currency: str
    due_date: str
    vendor_name: str

class LeadData(BaseModel):
    company_name: str
    contact_person: str
    linkedin_url: str | None
    email: str | None

class RefinerFactory:
    @staticmethod
    def get_refiner(module_type: str) -> BaseModel:
        refiners = {
            'invoice': InvoiceData,
            'lead': LeadData,
            # Add all 18 module types
        }
        return refiners.get(module_type, BaseModel)
```

---

## Module Specifications

### Phase 2: Sales & Profit Modules

#### Sales Hunter Agent

**Path:** `src/agents/SalesHunterAgent.ts`

**Capabilities:**
- LinkedIn profile scraping (via Robotkez)
- Email draft generation using company profile
- CRM integration (Google Sheets)

**Input:**
```typescript
interface SalesTarget {
  industry: string;
  location: string;
  companySize: 'startup' | 'sme' | 'enterprise';
  keywords: string[];
}
```

**Output:**
```typescript
interface SalesResult {
  leads: {
    companyName: string;
    decisionMaker: string;
    contactInfo: string;
    linkedinUrl: string;
    score: number; // 0-100 relevance
  }[];
  draftEmails: string[];
  sheetsUrl: string; // Link to generated CRM sheet
}
```

**Tools:**
- `linkedin_scraper` (myai/workers/linkedin_agent.py)
- `email_generator` (src/tools/email_drafting.ts)
- `sheets_writer` (src/tools/googleWorkspace.ts)

**Constraints:**
- Rate limiting: Max 50 LinkedIn profiles/hour
- Email drafts require human approval before sending
- Store lead data in encrypted LanceDB table

---

#### Market Intel Agent

**Path:** `src/agents/MarketIntelAgent.ts`

**Function:** Monitor competitor pricing and market trends

**Workflow:**
1. Receive product category (e.g., "industrial valves")
2. Scrape competitor websites (browser-use)
3. Extract prices and store in LanceDB
4. Generate trend report with charts (chart.js)
5. Alert if price drop > 10%

**Python Worker:** `myai/workers/price_scraper.py`

```python
from browser_use import Agent, BrowserConfig

async def scrape_competitor_prices(category: str) -> list[dict]:
    agent = Agent(task=f"Find prices for {category} from top 5 suppliers")
    results = await agent.run()
    return validated_results
```

**LanceDB Schema:**
```typescript
// src/utils/rag.ts
const marketIntelSchema = {
  product_name: 'string',
  competitor_name: 'string',
  price: 'float',
  currency: 'string',
  scraped_at: 'timestamp',
  source_url: 'string'
};
```

---

#### Auto-Negotiator (Procurement Agent)

**Path:** `src/agents/ProcurementAgent.ts`

**Logic:**
1. Fetch historical supplier prices from LanceDB
2. Compare with current market prices (from Market Intel)
3. If market price is 5%+ lower, select negotiation strategy:
   - `loyalty_ask`: "We've been loyal customers..."
   - `bulk_discount`: "We can increase order volume..."
   - `competitor_match`: "Competitor X offers..."
4. Generate email draft with cited sources

**Critical Constraint:** NO hallucinations - every price claim must link to `source_url`

**Validation Function:**
```typescript
function validateNegotiationEmail(draft: string, sources: string[]): boolean {
  const priceRegex = /\d+[\.,]\d+/g;
  const prices = draft.match(priceRegex);
  return prices.every(price => sources.some(s => s.includes(price)));
}
```

---

### Phase 3: Finance & Admin Modules

#### Financial Guard Agent

**Path:** `src/agents/FinanceAgent.ts`

**Input:** PDF invoice (from Gmail attachment)

**Process:**
1. Extract text via OCR (`myai/refiners/ocr_handler.py` using Tesseract or Google Vision)
2. Parse with Pydantic `InvoiceData` model
3. Detect duplicates (compare `invoice_number` in LanceDB)
4. Flag anomalies (price > 2x average for vendor)
5. Export to Google Sheets with color-coding

**Output:**
```typescript
interface InvoiceProcessingResult {
  status: 'processed' | 'duplicate' | 'anomaly';
  extractedData: InvoiceData;
  sheetRow: number;
  alerts?: string[];
}
```

**Data Flow:**
```
Gmail → NodeJS Webhook → Python OCR → Pydantic Validation 
→ LanceDB Check → Sheets Export → Dashboard Alert
```

---

#### Email Triage Agent (Digital Office Manager)

**Path:** `src/agents/EmailTriageAgent.ts`

**Function:** Auto-sort and respond to emails

**Classification:**
- URGENT: Contains "invoice", "deadline", "complaint"
- CUSTOMER: From known client domains
- SPAM: Low sender reputation score
- INFO: Newsletters, updates

**Auto-Response Templates:** Stored in `data/email_templates/`

**Example Template:**
```markdown
# data/email_templates/invoice_ack.md
Tisztelt {sender_name}!

Köszönjük a számlát ({invoice_number}). 
Feldolgozás alatt, várható fizetés: {due_date}.

Üdvözlettel,
{company_name} Pénzügy Osztály
```

**Integration:** Gmail API + LanceDB for sender history

---

#### Grant Watcher Agent

**Path:** `src/agents/GrantMonitorAgent.ts`

**Sources:**
- Magyar Közlöny (daily PDF scrape)
- EU H2020, Horizon Europe portals
- National Business Agency (palyazat.gov.hu)

**Matching Logic:**
```typescript
interface CompanyProfile {
  teaor_code: string;
  employee_count: number;
  annual_revenue: number;
  location: string;
}

interface GrantOpportunity {
  title: string;
  eligibility: {
    teaor_codes: string[];
    max_employees?: number;
    regions?: string[];
  };
  deadline: string;
  funding_amount: number;
}

function isEligible(company: CompanyProfile, grant: GrantOpportunity): boolean {
  return grant.eligibility.teaor_codes.includes(company.teaor_code)
    && (!grant.eligibility.max_employees || company.employee_count <= grant.eligibility.max_employees)
    && (!grant.eligibility.regions || grant.eligibility.regions.includes(company.location));
}
```

**Alert:** Dashboard notification + summary in Google Doc

---

### Phase 4: HR & Soft Skills

#### Digital Headhunter Agent

**Path:** `src/agents/RecruitmentAgent.ts`

**Workflow:**
1. Parse job description → extract required skills
2. Scan uploaded CVs (PDF/DOCX) via Python OCR
3. Score candidates (0-100) based on:
   - Skills match (40%)
   - Experience years (30%)
   - Education relevance (20%)
   - Cultural fit (10%, based on cover letter sentiment)
4. Generate interview questions using LLM

**Output:**
```typescript
interface CandidateRanking {
  name: string;
  score: number;
  highlights: string[];
  concerns: string[];
  interviewQuestions: string[];
}
```

**GDPR Compliance:**
- CV data stored locally in `_br_temp/recruitment/`
- Auto-delete after 30 days
- No external API calls with personal data

---

#### Conflict Mediator Agent

**Path:** `src/agents/ConflictAnalysisAgent.ts`

**Input:** Internal chat/email thread (anonymized)

**Analysis:**
1. Sentiment scoring per message (positive/negative/neutral)
2. Detect escalation patterns (increasing negativity)
3. Identify trigger words ("always", "never", "incompetent")
4. Suggest de-escalation phrases

**Output:**
```typescript
interface ConflictReport {
  severity: 'low' | 'medium' | 'high';
  participants: string[]; // Anonymized IDs
  triggerPoints: string[];
  suggestions: string[];
}
```

**Ethics Note:** This is a **suggestion tool**, not a surveillance system. Requires HR manager explicit request.

---

#### Local CSR Agent

**Path:** `src/agents/CSRAgent.ts`

**Function:** Find local community engagement opportunities

**Data Sources:**
- Local news websites (geo-fenced by company location)
- NGO event calendars
- Municipality announcements

**Matching:** Company values + event type (e.g., environmental → tree planting)

**Output:** Weekly digest with actionable opportunities

---

### Phase 5: Logistics & Knowledge

#### Logistics Dispatcher Agent

**Path:** `src/agents/LogisticsAgent.ts`

**Integration:**
- GLS API
- DPD API
- Magyar Posta API

**Workflow:**
1. Extract tracking ID from email/dashboard input
2. Poll tracking status hourly
3. If status = "DELAYED", generate complaint email draft
4. Store delivery data in LanceDB for route optimization insights

**Proactive Alerts:**
- "Shipment stuck in customs > 48h"
- "Delivery failure (3rd attempt)"

---

#### Knowledge Base Builder Agent

**Path:** `src/agents/KnowledgeIndexerAgent.ts`

**Trigger:** Project folder in Google Drive marked "Completed"

**Process:**
1. Scan folder recursively
2. Extract metadata: client name, project duration, KPIs achieved
3. Generate summary document (markdown)
4. Index all documents into LanceDB RAG
5. Tag by keywords

**Output:** Auto-generated internal wiki entry

---

### Phase 6: Advanced Modules

#### Law Detective Agent

**Path:** `src/agents/ComplianceAgent.ts`

**Daily Routine:**
1. Download latest Magyar Közlöny PDF
2. OCR + semantic search for keywords: TEÁOR code, company type, deadlines
3. If match found, generate executive summary
4. Display on Dashboard with **disclaimer**: "Kérjük, ügyvéddel konzultáljon!"

---

#### Project-to-Marketing Pipeline

**Path:** `src/agents/MarketingAutomationAgent.ts`

**Trigger:** Drive folder status change to "Archive"

**Workflow:**
1. Extract project metadata
2. Generate 3 variations:
   - LinkedIn thought leadership post
   - Facebook customer story
   - Case study PDF
3. Create drafts in Google Docs
4. Dashboard approval screen (Human-in-the-Loop)

---

#### Digital Archivist

**Path:** `src/agents/DriveCleanupAgent.ts`

**Function:** Auto-organize Google Drive

**Naming Convention:** `YYYY_MM_PARTNER_TYPE.pdf`

**Classification:**
- INVOICE: Keywords "számla", "invoice", price patterns
- CONTRACT: Keywords "szerződés", "megállapodás"
- OFFER: Keywords "ajánlat", "quote"

**Safety:** Move to "Trash_Review" folder, manual final deletion

---

## Data Storage Schema

### LanceDB Tables

#### 1. market_intel
```typescript
{
  id: 'uuid',
  product_name: 'string',
  competitor: 'string',
  price: 'float',
  scraped_at: 'timestamp',
  source_url: 'string',
  vector: 'embedding' // For semantic search
}
```

#### 2. lead_database
```typescript
{
  id: 'uuid',
  company_name: 'string',
  contact_name: 'string',
  last_contact: 'timestamp',
  status: 'new' | 'contacted' | 'negotiating' | 'closed',
  notes: 'string',
  vector: 'embedding'
}
```

#### 3. knowledge_base
```typescript
{
  id: 'uuid',
  project_name: 'string',
  client: 'string',
  completion_date: 'date',
  summary: 'string',
  file_paths: 'string[]',
  tags: 'string[]',
  vector: 'embedding'
}
```

---

## Security & Compliance

### Data Handling Rules

1. **HR Data (Recruitment, Conflict):**
   - Local storage only: `_br_temp/hr/`
   - Encrypted at rest (AES-256)
   - Auto-delete after 30 days
   - No logging of personal identifiers

2. **Financial Data (Invoices, Negotiation):**
   - LanceDB tables with encryption
   - Access restricted to FinanceAgent + Orchestrator
   - Audit log for all modifications

3. **Sales Data (Leads, Market Intel):**
   - LanceDB storage
   - Regular backups to R2
   - Source URL must be stored for every data point

### API Rate Limits

| Service | Limit | Mitigation |
|---------|-------|-----------|
| Google Workspace APIs | 100 req/min | Batch operations, caching |
| LinkedIn (scraping) | 50 profiles/hour | Random delays, session rotation |
| Tracking APIs | 500 req/day | Request aggregation |

---

## Testing Strategy

### Unit Tests
- Each agent's `execute()` method
- Refiner factory validation logic
- Email/document parsers

### Integration Tests
- End-to-end: Email → Invoice processing → Sheets
- Multi-agent: Market Intel → Auto-Negotiator → Gmail draft

### Validation Gates
```bash
npm run build   # Must succeed
npm test        # All tests pass
brunella health # All agents registered
```

### Manual Validation
- Phase 2: Process 10 real invoices
- Phase 3: Generate 20 sales leads
- Phase 4: Test with anonymized HR data

---

## Performance Requirements

- **Response Time:** < 2 seconds for text-only tasks
- **Throughput:** 100 concurrent events
- **Data Processing:** 1000 documents/day
- **Uptime:** 99.5% (excluding planned maintenance)

---

## Deployment Checklist

- [ ] All 18 agents implemented in `src/agents/`
- [ ] Python workers deployed in `myai/workers/`
- [ ] LanceDB tables created with correct schemas
- [ ] Google Workspace API scopes approved
- [ ] Dashboard updated with module status widgets
- [ ] Documentation generated (`conductor/tracks/bas_enterprise_suite/USER_GUIDE.md`)
- [ ] User acceptance testing completed
- [ ] Production environment variables configured
- [ ] Monitoring dashboard (Prometheus + Grafana) deployed

---

**Specification Version:** 1.0  
**Last Updated:** 2026-02-16  
**Maintained By:** BAS Orchestrator Team
