# Cloudflare Workers Migration — Technikai Specifikáció

**Track:** cloudflare_workers_migration_20260226
**Státusz:** COMPLETED
**Prioritás:** HIGH

---

## Architektúra áttekintés

```
┌─────────────────────────────────────────────────────────────────────┐
│                    BRUNELLA EDGE ARCHITEKTÚRA V2                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Felhasználó / Dashboard (5173)                                     │
│          │                                                          │
│          ▼                                                          │
│  Brunella Express :3000  ←──── Cloudflare Tunnel ────────────┐     │
│          │                         (publikus URL)            │     │
│          ▼                                                    │     │
│  EdgeProxyAgent.ts                                            │     │
│  + CloudflareWorkerProxy.ts                                   │     │
│          │                                                    │     │
│          ▼                                                    │     │
│  ┌───────────────────────────────────────────────────┐       │     │
│  │  brunella-orchestrator-v2.workers.dev             │       │     │
│  │  POST /dispatch                                   │       │     │
│  │  {agent: "LeadMiningAgent", task: "...", ctx: {}} │◄──────┘     │
│  └──────────────────┬────────────────────────────────┘             │
│                     │ Routing tábla (D1)                           │
│          ┌──────────┼──────────────────────────────┐              │
│          ▼          ▼                    ▼          ▼              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │brunella-lead │ │brunella-intel│ │brunella  │ │brunella      │  │
│  │-agent        │ │-agent        │ │-browser  │ │-finance      │  │
│  │(Lead+Sales)  │ │(Market+Trend)│ │-agent    │ │-agent        │  │
│  └──────┬───────┘ └──────┬───────┘ └────┬─────┘ └──────┬───────┘  │
│         │                │              │               │           │
│    ┌────┴────┐     ┌─────┴──┐    ┌──────┴──────┐  ┌────┴────┐     │
│    │D1 Cache │     │Vectorize│    │CF Browser   │  │D1 Store │     │
│    └─────────┘     └────────┘    │Rendering API│  └─────────┘     │
│                                  └─────────────┘                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Orchestrator Worker v2

### wrangler.toml (brunella-orchestrator-v2)

```toml
name = "brunella-orchestrator-v2"
main = "workers/orchestrator/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "1c4e7d00-7b09-4ddf-88b4-8df42e1123ab"

[[kv_namespaces]]
binding = "KV"
id = "b6718ab359ac401bb24da7c34c24f11b"

[vars]
BAS_VERSION = "2.0"
```

### Worker API kontrakt

```
POST /dispatch
X-BAS-API-Key: <CEAN_API_KEY>
Content-Type: application/json

{
  "agent": "LeadMiningAgent",
  "task": "Find B2B leads in logistics sector in Hungary",
  "context": { "limit": 10, "industry": "logistics" },
  "requestId": "uuid-v4"
}

Response 200:
{
  "requestId": "uuid-v4",
  "status": "dispatched" | "completed" | "fallback",
  "workerUrl": "brunella-lead-agent.workers.dev",
  "result": { ... },
  "latencyMs": 230
}

POST /task-status/:requestId  → task állapot D1-ből
GET  /workers                 → 16 Worker health lista
GET  /routing                 → aktuális routing tábla
```

### D1 séma kiegészítés

```sql
-- Worker task tracking
CREATE TABLE IF NOT EXISTS worker_tasks (
  id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL,
  worker_url TEXT NOT NULL,
  task TEXT NOT NULL,
  context TEXT,  -- JSON
  status TEXT DEFAULT 'pending',  -- pending|running|completed|failed
  result TEXT,   -- JSON
  error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME
);

-- Worker routing table
CREATE TABLE IF NOT EXISTS worker_routing (
  agent_name TEXT PRIMARY KEY,
  worker_url TEXT NOT NULL,
  is_healthy INTEGER DEFAULT 1,
  last_health_check DATETIME,
  avg_latency_ms INTEGER
);
```

---

## Phase 2 — Agent Worker sablon

Minden agent Worker ugyanazt a sablont követi:

```typescript
// workers/agents/lead-agent/index.ts
import { LeadMiningAgent } from './LeadMiningAgent.js';
import { SalesHunterAgent } from './SalesHunterAgent.js';

interface Env {
  DB: D1Database;
  KV: KVNamespace;
  AI: Ai;
  GEMINI_API_KEY: string;
  GITHUB_PAT: string;
  BAS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Auth
    const key = request.headers.get('X-BAS-API-Key');
    if (key !== env.BAS_API_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    const { agent, task, context, requestId } = await request.json();

    // Agent routing
    const agents: Record<string, any> = {
      'LeadMiningAgent': new LeadMiningAgent(env),
      'SalesHunterAgent': new SalesHunterAgent(env),
    };

    const agentInstance = agents[agent];
    if (!agentInstance) {
      return Response.json({ error: 'Agent not found in this worker' }, { status: 404 });
    }

    // Execute
    const startTime = Date.now();
    const result = await agentInstance.execute(task, context);

    // Log to D1
    await env.DB.prepare(
      'INSERT INTO worker_tasks (id, agent_name, worker_url, task, status, result, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(requestId, agent, 'brunella-lead-agent.workers.dev', task, 'completed', JSON.stringify(result), new Date().toISOString()).run();

    return Response.json({
      requestId,
      status: 'completed',
      result,
      latencyMs: Date.now() - startTime
    });
  }
};
```

---

## Phase 3 — Browser Rendering Worker

```typescript
// workers/agents/browser-agent/index.ts
interface Env {
  BROWSER: Fetcher;  // Cloudflare Browser Rendering binding
  DB: D1Database;
  BAS_API_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { task, url, action, selector } = await request.json();

    // Cloudflare Browser Rendering API
    const response = await env.BROWSER.fetch(
      'https://api.cloudflare.com/client/v4/accounts/<ACCOUNT_ID>/browser-rendering/screenshot',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, width: 1280, height: 800 })
      }
    );

    const { screenshot } = await response.json();

    // GPT-4o Vision → selector generálás (GitHub Models)
    // ... vision analysis ...

    return Response.json({ screenshot, selector, action_result: '...' });
  }
};
```

---

## Phase 4 — Helyi EdgeProxyAgent frissítés

```typescript
// src/agents/cloudflare/CloudflareWorkerProxy.ts (ÚJ)

const WORKER_ROUTING: Record<string, string> = {
  'LeadMiningAgent': 'https://brunella-lead-agent.workers.dev',
  'MarketIntelAgent': 'https://brunella-intel-agent.workers.dev',
  // ... mind a 26 agent
};

export class CloudflareWorkerProxy {
  async dispatch(agentName: string, task: string, context?: any): Promise<any> {
    const workerUrl = WORKER_ROUTING[agentName];

    if (!workerUrl) {
      throw new Error(`No Worker route for ${agentName}`);
    }

    const response = await fetch(`${workerUrl}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-BAS-API-Key': process.env.CEAN_API_KEY!,
      },
      body: JSON.stringify({ agent: agentName, task, context, requestId: crypto.randomUUID() })
    });

    return response.json();
  }
}
```

---

## CI/CD — GitHub Actions (meglévő workflow frissítése)

`.github/workflows/deploy-edge-agents.yml` kiegészítése:

```yaml
- name: Deploy all 16 Agent Workers
  run: |
    for worker in lead-agent intel-agent grant-agent law-agent email-agent \
                  finance-agent logistics-agent sales-agent hr-agent \
                  research-agent dev-agent innovation-agent browser-agent \
                  csr-agent knowledge-agent orchestrator-v2; do
      echo "Deploying brunella-${worker}..."
      cd workers/agents/${worker}
      npx wrangler deploy
      cd ../../..
    done
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Success Criteria (részletes)

| # | Kritérium | Mért |
|---|-----------|------|
| 1 | Orchestrator Worker /dispatch < 200ms | latencyMs |
| 2 | Mind 16 Worker URL 200-t ad vissza | wrangler health check |
| 3 | Browser Rendering: Google keresés screenshot | manuális teszt |
| 4 | EdgeProxyAgent fallback: Worker offline → local | unit teszt |
| 5 | D1 worker_tasks tábla íródik minden task-ra | SQL query |
| 6 | Dashboard CloudflareOrchestrator panel él | manuális ellenőrzés |
| 7 | npm test PASS + wrangler deploy PASS | CI/CD zöld |
| 8 | brunella edge status CLI parancs < 3mp | CLI teszt |
