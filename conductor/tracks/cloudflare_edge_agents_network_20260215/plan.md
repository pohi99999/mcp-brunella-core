# CEAN Implementation Plan

**Track:** cloudflare_edge_agents_network_20260215  
**Last Updated:** 2026-02-15

---

## FÁZIS 1: FOUNDATION & INFRASTRUCTURE (Hét 1)

### 1A: Cloudflare Asset Audit (Nap 1-2)

**Tasks:**

1. **Inventory current workers** (15 min)
   ```bash
   cd /bas-cloudflare-orchestrator
   wrangler deployments list
   # Collect: llm-chat-app, agents, saas-admin, brunella-cf, bas-orch, throbbing-fire
   ```

2. **Check R1 availability** (10 min)
   - Verify Vectorize API access
   - Check quota (should be 5 MB free)
   - Test connection from worker

3. **Check D1 availability** (10 min)
   - List existing databases (`wrangler d1 list`)
   - Verify SQLite support
   - Check quota (100 MB free)

4. **Verify CLI setup** (5 min)
   - `wrangler --version`
   - `wrangler whoami`
   - Test deploy: `wrangler deploy` (dummy worker)

5. **Document infrastructure** (20 min)
   - Create: `docs/CEAN_INFRASTRUCTURE_SNAPSHOT.md`
   - Screenshot: Dashboard (you provided this!)
   - Record: R1/D1 IDs, Worker endpoints

**Deliverable:** `docs/CEAN_INFRASTRUCTURE_SNAPSHOT.md` + audit checklist

---

### 1B: Schema Design (Nap 2-3)

**Tasks:**

1. **Create D1 schema file** (30 min)
   ```bash
   # File: myai/agents/workers/schema/d1_schema.sql
   # Contains: edge_tasks, edge_executions, edge_results tables
   ```

2. **Generate migration script** (20 min)
   ```bash
   wrangler d1 execute YOUR_DB --file=myai/agents/workers/schema/d1_schema.sql
   ```

3. **Design R1 vector schema** (20 min)
   - Create: `docs/CEAN_R1_VECTOR_MAPPINGS.md`
   - Define: research_papers, grants, harvested_data collections
   - Specify: embedding model + dimensions

4. **Create TypeScript types** (30 min)
   ```typescript
   // src/types/cean.ts
   export type EdgeTask = { id: UUID; agent_type: string; ... }
   export type EdgeExecution = { ... }
   // etc.
   ```

5. **Test D1 + R1 connectivity** (20 min)
   - Deploy test worker
   - Insert sample data
   - Verify query/retrieval

**Deliverable:** schema.sql + types + test worker

---

### 1C: GitHub Actions CI/CD Setup (Nap 3-4)

**Tasks:**

1. **Create workflow file** (30 min)
   ```yaml
   # .github/workflows/deploy-edge-agents.yml
   on: [push, pull_request]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: wrangler deploy --dry-run
     deploy:
       if: github.ref == 'refs/heads/main'
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v3
         - run: wrangler deploy
   ```

2. **Configure secrets** (10 min)
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

3. **Test CI/CD** (20 min)
   - Push dummy branch
   - Verify build passes
   - Merge to main → verify deploy

**Deliverable:** `.github/workflows/deploy-edge-agents.yml`

---

## FÁZIS 2: INDIVIDUAL AGENT WORKERS (Hét 2-3)

### 2A: Research Agent Worker (Nap 5-7)

**File:** `myai/agents/workers/research-agent/src/index.ts`

**Template:**
```typescript
import { Env } from '../types';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    if (url.pathname === '/query' && request.method === 'POST') {
      const payload = await request.json();
      const { query, sources = ['github', 'hackernews'], limit = 50 } = payload;
      
      // 1. Fetch from sources (parallel)
      const results = await Promise.all([
        fetchGitHub(query, limit),
        fetchHackerNews(query, limit),
        fetchArxiv(query, limit),
      ]);
      
      // 2. LLM analyze (call Claude/Gemini)
      const analyzed = await analyzeSources(results, env);
      
      // 3. Store in D1 + R1
      await storeToDB(analyzed, env);
      
      // 4. Return top 10
      return new Response(JSON.stringify(analyzed.slice(0, 10)), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
  
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // Daily nightly run (cron)
    console.log('Research agent daily run');
    // Similar logic but without request context
  }
};
```

**Subtasks:**
1. GitHub API integration (20 min)
2. HackerNews scraper (15 min)
3. arXiv API integration (20 min)
4. LLM analysis (Claude/Gemini API call) (30 min)
5. D1 insert logic (15 min)
6. R1 embedding + storage (20 min)
7. Tests (30 min)

**Deliverable:** Deployed `research-agent.iam-dd1.workers.dev` + tests passing

---

### 2B: Grant Monitor Worker (Nap 7-10)

**File:** `myai/agents/workers/grant-monitor/src/index.ts`

**Key features:**
- EU CORDIS API fetch
- NIH/NSF API integration
- LLM scoring (relevance × budget × deadline)
- Slack notification on match >0.8

**Subtasks:**
1. CORDIS API integration (25 min)
2. NIH/NSF scraper (20 min)
3. Schema parsing (15 min)
4. LLM relevance scoring (30 min)
5. Slack webhook integration (20 min)
6. D1 logging (15 min)
7. Tests (30 min)

**Deliverable:** Deployed `grant-monitor.iam-dd1.workers.dev` + Slack notifications working

---

### 2C: Data Harvester Worker (Nap 10-13)

**File:** `myai/agents/workers/data-harvester/src/index.ts`

**Key challenge:** Browser automation (Playwright/Puppeteer) → Durable Objects needed

**Subtasks:**
1. Durable Object browser stub (30 min)
2. Playwright integration (30 min)
3. Selector-based extraction (20 min)
4. Pagination logic (20 min)
5. D1 raw data storage (15 min)
6. Queue result for Extractor (15 min)
7. Tests + error handling (30 min)

**Note:** This is the most complex. May need to use `@playwright/test` or cloud browser service.

**Deliverable:** Deployed `data-harvester.iam-dd1.workers.dev` + extraction working

---

### 2D: Data Extractor Worker (Nap 13-15)

**File:** `myai/agents/workers/data-extractor/src/index.ts`

**Key features:**
- LLM structured extraction (JSON schema)
- Batch processing (100 tasks/sec)
- R1 embedding + storage

**Subtasks:**
1. LLM structured output (JSON mode) (20 min)
2. Schema validator (20 min)
3. Batch processor (25 min)
4. R1 embedding + storage (25 min)
5. D1 result logging (15 min)
6. Tests (30 min)

**Deliverable:** Deployed `data-extractor.iam-dd1.workers.dev` + batch processing tested

---

### 2E: Builder Agent Worker (Nap 15-17)

**File:** `myai/agents/workers/builder-agent/src/index.ts`

**Key features:**
- GitHub webhook listening
- Log parsing + error analysis
- PR generation with fixes
- Deploy monitoring

**Subtasks:**
1. GitHub webhook handler (20 min)
2. Build log parser (25 min)
3. LLM error diagnosis (30 min)
4. Automated fix generation (30 min)
5. PR creation via GitHub API (25 min)
6. Deploy monitoring (20 min)
7. Tests (30 min)

**Deliverable:** Deployed `builder-agent.iam-dd1.workers.dev` + PR generation tested

---

## FÁZIS 3: ORCHESTRATION & PIPELINE (Hét 3-4)

### 3A: Task Orchestrator Worker (Nap 18-20)

**File:** `myai/agents/workers/orchestrator/src/index.ts`

**Responsibilities:**
```typescript
// POST /schedule/{agent_type}
// → Create edge_task in D1
// → Trigger appropriate worker
// → Return task_id

// GET /task/{task_id}
// → Fetch from D1
// → Return status + result

// POST /webhook/github
// → Parse GitHub event
// → Queue Research Agent (nightly)
// → Queue Grant Monitor (daily)
// → etc.

// GET /stats
// → Cost breakdown
// → Success rates
// → Monthly quota usage
```

**Subtasks:**
1. Cron trigger setup (20 min)
2. Queue management (D1 updates) (25 min)
3. Error handling + retry logic (30 min)
4. Cost tracking (25 min)
5. Webhook routing (25 min)
6. Stats aggregation (20 min)
7. Tests (40 min)

**Deliverable:** Deployed `orchestrator.iam-dd1.workers.dev` fully functional

---

### 3B: Dashboard Integration (Nap 20-21)

**Files:**
- `src/dashboard/components/edge/EdgeAgentsMonitor.tsx`
- `src/server/routes/edgeAgents.ts` (API wrapper)

**Components:**
- Worker status cards (active/idle)
- Cost breakdown chart
- Task history table
- Top findings card

**Subtasks:**
1. API wrapper (15 min)
2. React components (40 min)
3. Real-time updates (Socket.IO) (20 min)
4. Styling + responsive (20 min)
5. Tests (20 min)

**Deliverable:** Dashboard showing live edge agent metrics

---

## FÁZIS 4: TESTING & OPTIMIZATION (Hét 4)

### 4A: Load Testing (Nap 22-24)

**Goal:** Simulate 100k monthly requests, profile performance

**Tasks:**
1. `artillery` or `k6` load test script (30 min)
2. Run test: 100k req distribution (60 min) → observe results
3. Profile each agent (which is slowest?) (30 min)
4. Identify bottlenecks + document (30 min)

**Deliverable:** Performance report + bottleneck list

---

### 4B: Cost Optimization (Nap 24-26)

**Optimizations to try:**
1. LLM request caching (KV) → save 10-20% API calls
2. Batch D1 writes (50 req/batch) → reduce overhead
3. Parallel worker execution → reduce total time
4. R1 embedding deduplication → reduce vector DB size

**Subtasks:**
1. Implement caching (20 min)
2. Batch write refactor (20 min)
3. Parallel execution (20 min)
4. Measure cost reduction (30 min)

**Deliverable:** Cost reduced, new estimate documented

---

### 4C: E2E Testing (Nap 26-28)

**Scenario:** GitHub push → All agents triggered → Results aggregated → Notifications sent

**Tasks:**
1. Setup test GitHub repo (10 min)
2. Push trigger orchestrator (10 min)
3. Monitor all agents execute (manual + log checking) (30 min)
4. Verify D1 + R1 data flowing (15 min)
5. Check Slack notifications arrived (5 min)
6. Document full flow (20 min)

**Deliverable:** E2E test documented + passing

---

## ⏱️ TIMELINE

| Week | Phases | Days | Goal |
|------|--------|------|------|
| **W1** | 1A + 1B + 1C | 1-7 | Foundation ready |
| **W2** | 2A + 2B | 8-14 | Research + Grant agents deployed |
| **W3** | 2C + 2D + 3A | 15-21 | Harvester + Extractor + Orchestrator |
| **W4** | 2E + 3B + 4A/B/C | 22-28 | Builder + Dashboard + Testing |

**Target:** 2026-03-15 (all phases complete)

---

## 👥 OWNER RESPONSIBILITIES

- [ ] Approve spec (before starting)
- [ ] Provide: GitHub token (for Builder agent)
- [ ] Provide: LLM API keys (OpenAI/Gemini)
- [ ] Configure: Slack webhook (for notifications)
- [ ] Review: Each phase deliverable before proceeding

---

## 🚨 BLOCKERS & RISKS

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Playwright in Workers? | HIGH | Use cloud service or DO alternative |
| Rate limits (GitHub/arXiv) | MEDIUM | Implement caching + backoff |
| R1 vector embedding latency | MEDIUM | Batch + async queueing |
| LLM API costs | MEDIUM | Cache + fallback to local models |
| GitHub webhook secret management | LOW | Use Cloudflare Vault |

---

**Next Step:** Get approval on spec.md → Start Phase 1A tomorrow
