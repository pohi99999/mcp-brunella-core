# Cloudflare Infrastructure - Master Documentation

**Owner:** Brunella Core Team
**Last Updated:** 2026-02-16
**Status:** Active Development (CEAN: 5% complete)

---

## 🎯 ÁTTEKINTÉS (Overview)

A Brunella Agent System **teljes Cloudflare integrációja**, amely globális edge computing-ot, AI gateway-t, vector storage-ot és browser rendering-et használ.

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE NETWORK                      │
│                                                                 │
│  ┌─────────────────────┐        ┌──────────────────────────┐  │
│  │   6 DEPLOYED        │        │  5 PLANNED (CEAN)        │  │
│  │   WORKERS           │        │  AGENT WORKERS           │  │
│  ├─────────────────────┤        ├──────────────────────────┤  │
│  │ • llm-chat-app      │        │ • research-agent         │  │
│  │ • agents-api        │        │ • grant-monitor          │  │
│  │ • saas-admin        │        │ • data-harvester         │  │
│  │ • brunella-cf       │        │ • data-extractor         │  │
│  │ • bas-orchestrator  │        │ • builder-agent          │  │
│  │ • throbbing-fire    │        │ (+ orchestrator)         │  │
│  └─────────────────────┘        └──────────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             INFRASTRUCTURE COMPONENTS                     │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ ✅ Tunnel       - Public URL for localhost               │  │
│  │ ✅ AI Gateway   - LLM routing (@cf/meta/llama-3.1-8b)    │  │
│  │ ✅ Browser API  - Playwright automation (siTRHomo1G_...)  │  │
│  │ ⏳ R2 Storage   - Object storage (NOT R1 vector!)         │  │
│  │ ⏳ D1 Database  - SQLite edge database (CEAN tasks)       │  │
│  │ ⏳ KV Storage   - Key-value store (caching)               │  │
│  │ ⏳ Vectorize    - Vector embeddings (CEAN research)       │  │
│  │ ⏳ Durable Obj. - Stateful workers (orchestration)        │  │
│  │ ❌ Pages        - Static site hosting (2 deployed)        │  │
│  │ ❌ Domain       - Custom domain (nem tervezett még)       │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**Jelölések:**
- ✅ Aktív és használatban
- ⏳ Konfigurálva de nincs kihasználva / CEAN-re vár
- ❌ Nem használt / Nem tervezett

---

## 📊 DEPLOYED WORKERS (Jelenlegi)

### 1. **llm-chat-app-template**
- **URL:** `llm-chat-app-template.iam-dd1.workers.dev`
- **Cél:** Chat interface template Cloudflare Workers AI-val
- **Státusz:** ✅ Deployed
- **Kapcsolódó fájlok:** N/A (external template)

### 2. **agents-api** (valószínű név)
- **Cél:** MCP agent API proxy a Cloudflare Edge-en
- **Státusz:** ✅ Deployed
- **Kapcsolódó:** `src/agents/EdgeProxyAgent.ts`

### 3. **saas-admin**
- **Cél:** Admin dashboard vagy SaaS management worker
- **Státusz:** ✅ Deployed

### 4. **brunella-cf**
- **Cél:** Brunella core API edge proxy
- **Státusz:** ✅ Deployed

### 5. **bas-orchestrator**
- **URL:** `https://bas-orchestrator.iam-dd1.workers.dev`
- **Cél:** Central orchestrator for agent delegation
- **Státusz:** ✅ Deployed
- **Kapcsolódó:** `src/agents/AgentManager.ts` (delegálás edge-re)
- **Config:** `.env` → `CLOUDFLARE_WORKER_URL`

### 6. **throbbing-fire** (random CF-generated név)
- **Cél:** Ismeretlen (audit szükséges)
- **Státusz:** ✅ Deployed

---

## 🚀 PLANNED WORKERS (CEAN - Cloudflare Edge Agents Network)

**Track:** `conductor/tracks/cloudflare_edge_agents_network_20260215`
**Progress:** 5% (Specification done, implementation not started)
**Target Completion:** 2026-03-15 (4 weeks)

### Architecture Overview

```mermaid
graph TD
    A[GitHub Webhook] -->|push event| B[Orchestrator Worker]
    B --> C[Research Agent]
    B --> D[Grant Monitor]
    B --> E[Data Harvester]
    B --> F[Builder Agent]

    C -->|results| G[D1 Database]
    D -->|grants| G
    E -->|raw data| G
    F -->|build logs| G

    G -->|structured data| H[Data Extractor]
    H -->|embeddings| I[Vectorize R1]

    I --> J[Dashboard UI]
    G --> J

    K[Cron Triggers] -->|daily/nightly| B
```

### 1. **Research Agent Worker**
- **URL:** `research-agent.iam-dd1.workers.dev` (planned)
- **Cél:** Napi scraping GitHub/HackerNews/arXiv AI trends
- **Schedule:** Nightly 2 AM UTC
- **Cost:** ~$0.00075/run (50ms CPU)
- **Output:** Top 10 research papers + metadata → D1 + Vectorize

### 2. **Grant Monitor Worker**
- **URL:** `grant-monitor.iam-dd1.workers.dev` (planned)
- **Cél:** EU/USA/Tech pályázat tracker, relevancia scoring
- **Schedule:** Daily 6 AM UTC
- **Cost:** ~$0.006/run (200ms CPU)
- **Output:** Matching grants (score > 0.8) → Slack notification

### 3. **Data Harvester Worker**
- **URL:** `data-harvester.iam-dd1.workers.dev` (planned)
- **Cél:** Playwright web scraper, dynamic content extraction
- **Schedule:** On-demand (via Orchestrator)
- **Cost:** ~$0.00003-0.00012/run (500-2000ms CPU)
- **Output:** Raw HTML/JSON → D1 queue for Extractor

### 4. **Data Extractor Worker**
- **URL:** `data-extractor.iam-dd1.workers.dev` (planned)
- **Cél:** LLM-based structured data extraction + embedding
- **Schedule:** Queued after Harvester (batch processing)
- **Cost:** ~$0.00001-0.00002/run (100-300ms CPU)
- **Output:** JSON schema + embeddings → Vectorize R1

### 5. **Builder Agent Worker**
- **URL:** `builder-agent.iam-dd1.workers.dev` (planned)
- **Cél:** CI/CD pipeline monitor, build log analyzer, auto-fix PR creator
- **Schedule:** GitHub webhook + nightly rebuild
- **Cost:** ~$0.00005-0.0003/run (1000-5000ms CPU)
- **Output:** Build analysis + suggested fixes → GitHub PR

### 6. **CEAN Orchestrator** (upgraded bas-orchestrator)
- **Routes:**
  - `POST /schedule/{agent_type}` - Queue new task
  - `GET /task/{task_id}` - Get task status
  - `POST /webhook/github` - GitHub event trigger
  - `GET /stats` - Usage/cost dashboard
- **Responsibilities:**
  - Cron trigger scheduling
  - Task queue management (D1)
  - Error handling + retry logic
  - Cost tracking + quota management (100k req/mo limit)

---

## 🗄️ INFRASTRUCTURE COMPONENTS

### ✅ **Cloudflare Tunnel**
- **Purpose:** Expose localhost:3000 to public internet (webhook testing)
- **Current URL:** `https://accidents-experimental-unwrap-feeding.trycloudflare.com` (temporary)
- **Status:** ✅ Active
- **Config:** `.env` → `CLOUDFLARE_TUNNEL_URL`
- **Start:** `cloudflared tunnel --url http://localhost:3000`
- **Note:** URL változik újraindításkor! Production-höz: Named tunnel szükséges.

### ✅ **AI Gateway**
- **Purpose:** LLM routing, caching, analytics
- **URL:** `https://gateway.ai.cloudflare.com/v1/dd107933ac970dac857f27cee7a7ff46/brunella-gateway/compat`
- **Model:** `@cf/meta/llama-3.1-8b-instruct` (Cloudflare Workers AI)
- **Config:** `.env` → `AI_GATEWAY_URL`, `AI_GATEWAY_ENABLED=true`
- **Status:** ✅ Configured
- **Health Check:** `curl http://localhost:3000/api/health` → `services.cloudflare`
- **Token:** `CF_API_TOKEN=siTRHomo1G_NxHczgcyljlVj6D5OXeiwpqSLD1m8` (Workers AI scope)

### ✅ **Browser Rendering API**
- **Purpose:** Playwright/Puppeteer automation on Cloudflare Edge
- **Token:** `siTRHomo1G_NxHczgcyljlVj6D5OXeiwpqSLD1m8` (Workers AI token has Browser Rendering scope)
- **Status:** ✅ Configured
- **Usage:** CEAN Data Harvester Worker-ben lesz használva
- **Kapcsolódó:** `src/utils/browserRendering.ts`

### ⏳ **R2 Object Storage**
- **Purpose:** File storage (képek, dokumentumok, build artifacts)
- **Account ID:** `dd107933ac970dac857f27cee7a7ff46`
- **Access Key:** `CF_R2_ACCESS_KEY_ID=b45279e704938a04ccd2701a25354209`
- **Status:** ⏳ Configured but not actively used
- **Note:** **NEM Vectorize R1!** Külön szolgáltatás.

### ⏳ **D1 Database (SQLite Edge)**
- **Purpose:** CEAN task queue, execution logs, results
- **Database Name:** `cean-tasks` (production), `cean-tasks-dev` (development)
- **Status:** ⏳ Schema designed, DB creation pending
- **Schema:** `myai/agents/workers/schema/d1_schema.sql` (terv szerint)
- **Wrangler Config:** `wrangler.toml` → `[[d1_databases]]`
- **Tables:**
  - `edge_tasks` - Task queue (pending/running/completed/failed)
  - `edge_executions` - Worker execution logs (duration, CPU, memory, cost)
  - `edge_results` - Result archival + metadata

### ⏳ **Vectorize (R1 Vector DB)**
- **Purpose:** Embeddings for research papers, grants, harvested data
- **Index Name:** `cean-embeddings`
- **Status:** ⏳ Configured in wrangler.toml, not created yet
- **Binding:** `EMBEDDINGS` (worker environment variable)
- **Models:**
  - `text-embedding-3-small` (1536 dim) - Research papers, grants
  - `text-embedding-3-large` (3072 dim) - Harvested data
- **Wrangler Config:** `wrangler.toml` → `[[vectorize]]`

### ⏳ **KV Namespace (Key-Value Store)**
- **Purpose:** Caching, rate limiting, session state
- **Namespace:** `cean-cache`
- **Status:** ⏳ Planned, not created
- **Wrangler Config:** `wrangler.toml` → `[[kv_namespaces]]`

### ⏳ **Durable Objects**
- **Purpose:** Stateful worker coordination (orchestrator state, browser sessions)
- **Class Name:** `CEANOrchestrator`
- **Status:** ⏳ Planned, not implemented
- **Wrangler Config:** `wrangler.toml` → `[[durable_objects.bindings]]`

### ❌ **Cloudflare Pages**
- **Purpose:** Static site hosting
- **Status:** ❌ 2 deployed (nem dokumentált), CEAN-hez nem szükséges

### ❌ **Custom Domain**
- **Status:** ❌ Nem tervezett rövid távon
- **Note:** Jelenleg `*.workers.dev` és `*.trycloudflare.com` URL-ek

---

## 💰 COST MODEL (Monthly Estimate)

### Free Tier Limits (Cloudflare Workers)
| Resource | Free Tier | Current Usage | CEAN Estimate |
|----------|-----------|---------------|---------------|
| **Workers Requests** | 100,000/month | ~10,000 | ~30,000 |
| **CPU Time** | 10ms/invocation | Variable | Avg 500ms |
| **Durable Objects** | 30 min/month | 0 | ~1 hour |
| **D1 Reads** | 5M/month | 0 | ~50k |
| **D1 Writes** | 100k/month | 0 | ~5k |
| **R2 Reads** | 10M/month | 0 | ~10k |
| **KV Reads** | 100k/month | 0 | ~20k |
| **Vectorize** | 30M queries/mo | 0 | ~10k |

### Estimated CEAN Monthly Cost
```
Research Agent (daily):       30 runs × 50ms = $0.00075
Grant Monitor (daily):        30 runs × 200ms = $0.006
Data Harvester (on-demand):   1000 runs × 1000ms = $1.00
Data Extractor (batched):     5000 runs × 200ms = $1.00
Builder Agent (weekly):       4 runs × 3000ms = $0.024

Subtotal CPU: ~$2.03
D1/KV/Vectorize operations: ~$0.50
R2 storage: ~$0.10

**TOTAL: ~$2.63/month (well within free tier)**
```

**Overage Cost (if >100k req/mo):** +$0.50/million requests

---

## 🔧 DEPLOYMENT & MANAGEMENT

### Tools
- **Wrangler CLI:** `wrangler deploy --env production`
- **Config File:** `wrangler.toml` (root)
- **GitHub Actions:** CI/CD pipeline (planned)
- **Dashboard:** Cloudflare dashboard @ https://dash.cloudflare.com

### Key Files
```
F:\mcp-brunella-core\
├── wrangler.toml                          # Main Wrangler config
├── .env                                   # Cloudflare tokens + account IDs
├── cloudflare/
│   └── src/
│       └── edge-coordinator.ts            # Edge coordination logic
├── myai/agents/workers/
│   ├── cean-test/wrangler.toml            # Test worker config
│   └── schema/d1_schema.sql               # D1 database schema (planned)
├── src/
│   ├── agents/EdgeProxyAgent.ts           # Edge proxy agent
│   ├── utils/cloudflareClient.ts          # CF API client
│   ├── utils/browserRendering.ts          # Browser API wrapper
│   └── server/routes/cloudflare.ts        # CF routes
└── conductor/tracks/
    └── cloudflare_edge_agents_network_20260215/  # CEAN track
```

### Environment Variables (.env)
```bash
# Cloudflare Account
CF_ACCOUNT_ID=dd107933ac970dac857f27cee7a7ff46
CLOUDFLARE_ACCOUNT_ID=1bf6118df97f0e12f3592a89d90deb1e  # Duplicate?
CF_EMAIL=peterpohankapersonal@gmail.com

# API Tokens
CF_API_TOKEN=siTRHomo1G_NxHczgcyljlVj6D5OXeiwpqSLD1m8      # Workers AI + Browser
CF_TOKEN=siTRHomo1G_NxHczgcyljlVj6D5OXeiwpqSLD1m8          # Same token
CLOUDFLARE_API_TOKEN=siTRHomo1G_NxHczgcyljlVj6D5OXeiwpqSLD1m8  # Same token
CF_GLOBAL_API_KEY=3d477d3095d6174dd1f904c710c22763f7655  # Global key (unused?)

# Workers
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.iam-dd1.workers.dev

# Tunnel
CLOUDFLARE_TUNNEL_URL=https://accidents-experimental-unwrap-feeding.trycloudflare.com
CLOUDFLARE_TUNNEL_ENABLED=true

# AI Gateway
AI_GATEWAY_ENABLED=true
AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/dd107933ac970dac857f27cee7a7ff46/brunella-gateway/compat
AI_GATEWAY_WORKERS_AI_MODEL=workers-ai/@cf/meta/llama-3.1-8b-instruct

# R2 Storage
CF_R2_ACCESS_KEY_ID=b45279e704938a04ccd2701a25354209
CF_R2_SECRET_ACCESS_KEY=f5dd01860123a025f3c83bf8a8dcf038a2ffae6b79c9c3812e0e5da938511a35
S3_API=https://dd107933ac970dac857f27cee7a7ff46.r2.cloudflarestorage.com

# Edge Config
EDGE_ENABLED=true
EDGE_FALLBACK_TO_LOCAL=true
EDGE_HEALTH_CHECK_INTERVAL=30000
```

---

## 🧪 HEALTH CHECK & MONITORING

### Health Check Command
```bash
curl http://localhost:3000/api/health | python -m json.tool
```

### Expected Output (Cloudflare section)
```json
{
  "services": {
    "cloudflare": {
      "status": "healthy",
      "latencyMs": 136,
      "error": null
    }
  }
}
```

### Troubleshooting
**HTTP 401 (Unauthorized):**
- ❌ Token invalid or expired
- ❌ Server nem töltötte be az új .env-t
- ✅ Fix: Restart Node.js backend (`npm run dev`)

**HTTP 502 (Bad Gateway):**
- ❌ AI Gateway URL rossz
- ❌ Worker nem válaszol
- ✅ Fix: Check `CLOUDFLARE_WORKER_URL` és worker deploy status

**"unhealthy" despite valid token:**
- ❌ Token scope nem tartalmazza a Workers AI-t
- ✅ Fix: Új token generálás a Cloudflare dashboard-ban (Workers AI + Scripts + Account Settings scope)

### Token Verification
```bash
curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer siTRHomo1G_NxHczgcyljlVj6D5OXeiwpqSLD1m8" | python -m json.tool
```

Expected:
```json
{
  "result": {
    "status": "active",
    "expires_on": "2027-06-02T23:59:59Z"
  },
  "success": true,
  "messages": [{"message": "This API Token is valid and active"}]
}
```

---

## 📈 ROADMAP & NEXT STEPS

### ✅ Completed (Archived Tracks)
- `cloudflare_edge_integration_20260202` - Basic edge integration (100%)
- `cloudflare-chat-integration-20260211` - Chat integration (100%)
- `cloudflare-iteration-2-20260212` - Iteration 2 improvements (100%)

### 🚧 In Progress (Active)
- `cloudflare_edge_agents_network_20260215` - CEAN (5%)
  - [x] Spec written
  - [x] Infrastructure audit
  - [ ] D1/Vectorize/KV creation
  - [ ] 5 agent workers implementation
  - [ ] Orchestrator upgrade
  - [ ] Dashboard integration
  - [ ] Testing & optimization

### 🔮 Future (Proposed)
- Custom domain binding (`api.brunella.dev`)
- Multi-region deployment optimization
- Advanced monitoring + Prometheus integration
- Cost optimization (LLM caching, batch operations)

---

## 📚 TOVÁBBI DOKUMENTÁCIÓ

- **CEAN Spec:** `conductor/tracks/cloudflare_edge_agents_network_20260215/spec.md`
- **CEAN Plan:** `conductor/tracks/cloudflare_edge_agents_network_20260215/plan.md`
- **Wrangler Config:** `wrangler.toml`
- **D1 Schema:** `myai/agents/workers/schema/d1_schema.sql` (planned)
- **EdgeProxyAgent:** `src/agents/EdgeProxyAgent.ts`
- **Cloudflare Routes:** `src/server/routes/cloudflare.ts`

---

## 🤝 KAPCSOLÓDÓ RENDSZEREK

### Node.js Backend Integration
- **AgentManager:** Delegálás edge-re (`src/agents/AgentManager.ts`)
- **EdgeHealthMonitor:** Worker health tracking (`src/core/edgeHealthMonitor.ts`)
- **CloudflareClient:** API wrapper (`src/utils/cloudflareClient.ts`)

### Python Backend Integration
- **Browser Worker:** Playwright automation (`myai/browser_worker.py`)
- **Data Refiner:** LLM-based data cleaning (`myai/refiner_logic.py`)

### Dashboard Integration
- **EdgePanel:** Real-time worker status (`src/dashboard/components/dashboard/EdgePanel.tsx`)
- **Cloudflare Chat Provider:** Chat routing (`src/dashboard/lib/chat/providers/cloudflareChatProvider.ts`)

---

**Frissítve:** 2026-02-16 - Cloudflare Workers AI token konfigurálva, health check dokumentálva
**Következő frissítés:** CEAN Phase 1A completion
