# Cloudflare Edge Agents Network (CEAN)

**Track ID:** `cloudflare_edge_agents_network_20260215`  
**Owner:** Brunella AI  
**Status:** `planning` (Specification Phase)  
**Start Date:** 2026-02-15  
**Target Completion:** 2026-03-15 (4 weeks)  
**Current Progress:** 5% (Spec draft, infrastructure audit)

---

## 🎯 CÉL (Objectives)

Felépíteni egy **globális szétszórt ügynök hálózatot** a Cloudflare Edge-en, amely az alábbi automatikus rendszereket futtatja:

1. **Kutató Ügynök (Research Agent)** - Napi szkenner GitHub/HackerNews/arXiv-ből, LLM analyzis
2. **Pályázat Figyelő (Grant Monitor)** - EU/USA/Tech pályázat tracker, értesítés + scoring
3. **Adatgyűjtő (Data Harvester)** - Playwright/Puppeteer-es web scraper, D1 storage
4. **Adatkinyerő (Data Extractor)** - Strukturált adat → JSON → R1 vector DB → Embedding
5. **Építő Workers (Builder Agents)** - CI/CD pipeline, build artifact analyzer, deploy orchestration
6. **Ügyfél-specifikus Workers** - Custom business logic (project-specifikus)

**Végcél:**
```
100% globális edge-on futó                        1 millió+ operáció/hó
│
├─ Kutatás (GitHub AI trends)
├─ Pályázat monitoring (EU grants)
├─ Web scraping (data collection)
├─ Data processing (extraction/embedding)
├─ Build orchestration (CI/CD)
└─ Analytics/Reporting (D1 + R1)

Teljes költség: €0 (100k req/hó ingyen)
```

---

## 📊 FÁZISOK (Implementation Phases)

### **FÁZIS 1: Foundation & Infrastructure** (Hét 1)

**Cél:** Infrastruktúra audit, schema design, CI/CD pipeline alapítás.

**Subphases:**

#### 1A: Cloudflare Asset Audit
- [x] Workers: 6 existente (llm-chat, agents, saas-admin, brunella-cf, bas-orch, throbbing-fire)
- [x] R1: Readiness check (Workers KV + Durable Objects)
- [x] D1: SQLite databases (task logging, metadata)
- [x] CLI: `wrangler` telepítve + configured
- [ ] Deploy pipeline: GitHub Actions (dev/staging/prod)

**Deliverable:** Audit report + infrastructure diagram

---

#### 1B: Schema Design (D1 + R1)

**D1 Schema (SQLite):**
```sql
-- Task Queue
CREATE TABLE edge_tasks (
  id UUID PRIMARY KEY,
  agent_type TEXT (research|grant|harvester|extractor|builder),
  status TEXT (pending|running|completed|failed),
  payload JSON,
  result JSON,
  created_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INT,
  cost_estimate DECIMAL(10,4)
);

-- Execution Log
CREATE TABLE edge_executions (
  id UUID PRIMARY KEY,
  task_id UUID,
  worker_name TEXT,
  duration_ms INT,
  cpu_ms INT,
  memory_mb INT,
  cost_actual DECIMAL(10,4),
  FOREIGN KEY (task_id) REFERENCES edge_tasks(id)
);

-- Results Archival
CREATE TABLE edge_results (
  id UUID PRIMARY KEY,
  task_id UUID,
  data_type TEXT (research|grant|harvested|extracted),
  content JSON,
  embedding_dimension INT,
  FOREIGN KEY (task_id) REFERENCES edge_tasks(id)
);
```

**R1 (Vector DB):**
```
Embeddings: {
  "research_papers": {
    "model": "text-embedding-3-small",
    "dimension": 1536,
    "documents": 10000+,
    "index": "hnsw"
  },
  "grants": {
    "model": "text-embedding-3-small",
    "dimension": 1536
  },
  "harvested_data": {
    "model": "text-embedding-3-large",
    "dimension": 3072
  }
}
```

**Deliverable:** schema.sql + R1 configuration

---

### **FÁZIS 2: Individual Agent Workers** (Hét 2-3)

Worker template + deployment pipeline.

#### 2A: Research Agent Worker
```
Worker: research-agent.iam-dd1.workers.dev

Inputs:
  - query: string (e.g., "LLM inference optimization")
  - sources: ["github", "hackernews", "arxiv"]
  - limit: 50

Process:
  1. Fetch from sources (parallel)
  2. LLM analyze: relevance + technical depth scoring
  3. Store in D1 + R1 embedding
  4. Return: top 10 results + metadata

Running Schedule:
  - Daily nightly (2 AM UTC)
  - On-demand via HTTP trigger

Cost per run: ~50 ms CPU = ~$0.000003
```

#### 2B: Grant Monitor Worker
```
Worker: grant-monitor.iam-dd1.workers.dev

Inputs:
  - categories: ["AI/ML", "European Union", "Startups"]
  - keywords: ["LLM", "transformer", "agent"]

Process:
  1. Fetch from EU CORDIS, NIH, NSF APIs
  2. Parse deadline + budget + eligibility
  3. LLM score: match_relevance vs own research
  4. Store + notify via Slack/email if match > 0.8
  5. Auto-create "apply" todo if human reviews

Running Schedule:
  - Daily (6 AM UTC)
  - High-priority re-scan on funding announcement

Cost per run: ~200 ms CPU = ~$0.00001
```

#### 2C: Data Harvester Worker
```
Worker: data-harvester.iam-dd1.workers.dev

Inputs:
  - url: string
  - selector_schema: JSON (CSS selectors + extractors)
  - paginate: bool

Process:
  1. Playwright/Puppeteer (via Durable Objects)
  2. Navigate + wait for dynamic content
  3. Extract via selectors
  4. Store in D1 (task_id reference)
  5. Queue for Extractor

Running Schedule:
  - Per-request (from Orchestrator)
  - Retry on dynamic rendering failure

Cost: ~500-2000 ms = ~$0.00003-0.00012
```

#### 2D: Data Extractor Worker
```
Worker: data-extractor.iam-dd1.workers.dev

Inputs:
  - raw_html: string OR d1_task_id: UUID
  - schema: JSON (field definitions)

Process:
  1. Fetch from D1 if task_id provided
  2. LLM structured extraction (JSON schema)
  3. Validate + standardize
  4. Generate embedding (R1)
  5. Store result in edge_results

Running Schedule:
  - Queued after Harvester
  - Batch processing (100 tasks/sec)

Cost: ~100-300 ms (depends on LLM) = ~$0.00001-0.00002
```

#### 2E: Builder Agent Worker
```
Worker: builder-agent.iam-dd1.workers.dev

Inputs:
  - repo_url: string (GitHub)
  - event: "push" | "pr" | "schedule"

Process:
  1. Clone + analyze build logs
  2. Parse errors via LLM
  3. Suggest fixes + run automated tests
  4. Create PR with fixes
  5. Monitor deployment

Running Schedule:
  - On GitHub webhook
  - Daily nightly rebuild (all repos)

Cost: ~1000-5000 ms (includes git ops) = ~$0.00005-0.0003
```

**Deliverable:** 5x worker templates + test suite

---

### **FÁZIS 3: Orchestration & Pipeline** (Hét 3-4)

#### 3A: Task Orchestrator
```
Worker: orchestrator.iam-dd1.workers.dev

Responsibilities:
  1. Schedule agents via Cron Trigger
  2. Queue management (D1 edge_tasks table)
  3. Error handling + retry logic
  4. Cost tracking + quota management
  5. Result aggregation + notifications
  
Routes:
  POST /schedule/{agent_type} — Queue new task
  GET  /task/{task_id}        — Get task status
  POST /webhook/github        — GitHub event trigger
  GET  /stats                 — Usage/cost dashboard
```

#### 3B: Pipeline DAG
```
GitHub Push Event
    ↓
Orchestrator (webhook)
    ├─ Research Agent (nightly) ─→ D1 logging
    ├─ Grant Monitor (daily)   ─→ Slack notify
    ├─ Data Harvester         ─→ D1 raw data
    │   ↓
    └─ Data Extractor (queued) ─→ R1 embeddings
                              ↓
                        Results aggregated
                              ↓
                        Dashboard + Reports
```

#### 3C: Dashboard Integration
```
src/dashboard/components/edge/EdgeAgentsMonitor.tsx

Displays:
  - Real-time worker status (active/idle)
  - Monthly cost + quota usage (100k req limit)
  - Task history + success rates
  - Top findings (research, grants, data)
  - Cost per agent type breakdown
```

**Deliverable:** Orchestrator worker + Pipeline DAG diagram

---

### **FÁZIS 4: Testing & Optimization** (Hét 4)

#### 4A: Load Testing
- Simulate 100k monthly requests distribution
- Profile CPU time per agent type
- Identify bottlenecks

#### 4B: Cost Optimization
- Minimize LLM API calls (caching)
- Batch D1/R1 writes
- Parallel worker execution

#### 4C: E2E Testing
- Full pipeline: GitHub push → all agents → notifications
- Failure recovery tests

**Deliverable:** Test suite + performance report + cost model

---

## 🔧 CLOUDFLARE RESOURCES

| Resource | Current | Max | Cost (Free) |
|----------|---------|-----|-----------|
| **Workers** | 6 deployed | ∞ | 100k req/mo |
| **R1 DB** | 1 | ∞ | 5 MB free |
| **D1 DB** | 2 | ∞ | 100 MB free |
| **KV** | Yes | ∞ | 1 GB free |
| **Durable Objects** | Maybe | ∞ | 30 min free |
| **Pages** | 2 | ∞ | ∞ free |

---

## 📈 COST MODEL (Monthly Estimate)

```
Assuming 100,000 free requests/month distribution:

Research agent (daily):       30 runs × 50ms × $0.0000005/ms = $0.00075
Grant monitor (daily):        30 runs × 200ms × $0.000001/ms = $0.006
Data harvester (per-request): 1000 req × 1000ms × $0.000001/ms = $1.00
Data extractor (batched):     5000 req × 200ms × $0.000001/ms = $1.00
Builder agent (weekly):       4 runs × 3000ms × $0.000002/ms = $0.024

Subtotal CPU: ~$2.03
KV/D1/R1 operations: <$0.50
Overage (if >100k req): +$0.50/million req

**TOTAL: <$3/month (well within free tier)**
```

---

## 🎓 DEPENDENCIES & BLOCKERS

- [ ] Durable Objects enabled (for async browser worker)
- [ ] Cloudflare API token (from CLI)
- [ ] GitHub webhook secret configured
- [ ] LLM API keys (OpenAI/Gemini for research + grant scoring)
- [ ] (Optional) Slack webhook for notifications

---

## ✅ SUCCESS CRITERIA

- [ ] All 5 agent workers deployed + passing tests
- [ ] D1/R1 schemas created + data flowing
- [ ] 30-day uptime >99.9%
- [ ] Cost <$5/month
- [ ] Monthly report: 10k+ research findings, 50+ qualifying grants, 100k+ data points harvested
- [ ] Dashboard shows real-time status + cost breakdown

---

## 📝 NOTES

- **Existing Workers audit needed** - some may need refactoring to fit CEAN pipeline
- **Managed by `wrangler`** - all deployments via CLI
- **GitHub Actions CI/CD** - needed for automated worker builds
- **Monitoring dashboard** - integrate with Prometheus (if available)

---

**Phase Status Summary:**
```
FÁZIS 1 (Foundation):           ░░░░░░░░░░ 0% (Not started)
FÁZIS 2 (Agents):               ░░░░░░░░░░ 0% (Not started)
FÁZIS 3 (Orchestration):        ░░░░░░░░░░ 0% (Not started)
FÁZIS 4 (Testing/Optimization): ░░░░░░░░░░ 0% (Not started)

CEAN Overall Progress: ░░░░░░░░░░ 5% (Spec draft)
```

---

**Next Action:** Approve spec → Create detailed plan.md → Begin Phase 1A (Infrastructure Audit)
