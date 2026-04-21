# CEAN Orchestrator Worker

Central task orchestration hub for the Cloudflare Edge Agents Network (CEAN).

## Purpose

Manages task queuing, agent scheduling, result aggregation, and error handling for all CEAN agents:
- **Research Agent** - GitHub/HackerNews/arXiv research
- **Grant Monitor** - EU/USA/Tech grant tracking  
- **Data Harvester** - Web scraping & data collection

## Routes

### Health Check
```bash
GET /health
```
Returns worker status and task count.

```json
{
  "status": "healthy",
  "worker": "cean-orchestrator",
  "timestamp": "2026-02-15T12:00:00Z",
  "tasks_total": 42
}
```

### Browser Rendering (Robotkez CF Engine)
```bash
POST /browser
Content-Type: application/json

{
  "action": "navigate",
  "url": "https://www.google.com",
  "options": {
    "waitUntil": "networkidle0",
    "fullPage": true
  }
}
```

**Actions:**
- `navigate` - Load URL (auto-handles consent)
- `click` - Click element by selector
- `type` - Type text into input
- `extract` - Extract text/HTML from element
- `screenshot` - Capture page screenshot
- `wait` - Wait for specified time

**Response:**
```json
{
  "status": "success",
  "url": "https://www.google.com",
  "screenshot": "data:image/png;base64,...",
  "duration_ms": 3421,
  "consoleMessages": ["[log] Page loaded"],
  "networkErrors": []
}
```

**Example - Click & Extract:**
```bash
curl -X POST https://orchestrator.iam-dd1.workers.dev/browser \
  -H "Content-Type: application/json" \
  -d '{
    "action": "click",
    "selector": "button.search",
    "options": { "fullPage": false }
  }'

curl -X POST https://orchestrator.iam-dd1.workers.dev/browser \
  -H "Content-Type: application/json" \
  -d '{
    "action": "extract",
    "extractSelector": "div#results",
    "options": { "fullPage": false }
  }'
```

### Schedule New Task
```bash
POST /schedule/{agent_type}
Content-Type: application/json

{
  "query": "AI safety research",
  "limit": 50,
  "sources": ["github", "hackernews"]
}
```

**Agent Types:** `research`, `grant`, `harvester`

**Response (202 Accepted):**
```json
{
  "success": true,
  "task_id": "task_1707988800000_abc123def",
  "status": "pending",
  "message": "Task queued for research agent"
}
```

### Get Task Status
```bash
GET /task/{task_id}
```

**Response:**
```json
{
  "id": "task_1707988800000_abc123def",
  "agent_type": "research",
  "status": "completed",
  "payload": { "query": "AI safety" },
  "result": { "papers": [...], "total": 15 },
  "created_at": "2026-02-15T12:00:00Z",
  "completed_at": "2026-02-15T12:05:00Z",
  "retry_count": 0,
  "max_retries": 3,
  "error": null
}
```

### Get Statistics
```bash
GET /stats
```

Returns aggregated metrics per agent type.

```json
[
  {
    "agent_type": "research",
    "total_tasks": 100,
    "completed_tasks": 95,
    "failed_tasks": 2,
    "running_tasks": 3
  },
  {
    "agent_type": "grant",
    "total_tasks": 50,
    "completed_tasks": 48,
    "failed_tasks": 1,
    "running_tasks": 1
  }
]
```

## Configuration

### Environment Setup

Update `wrangler.toml` with your D1 database ID:

```toml
[[env.production.d1_databases]]
binding = "DB"
database_name = "cean-core"
database_id = "YOUR_D1_ID_HERE"
```

### Environment Variables (Optional)

Set custom agent endpoints in `.env`:

```env
RESEARCH_AGENT_URL=https://research-agent.iam-dd1.workers.dev
GRANT_MONITOR_URL=https://grant-monitor.iam-dd1.workers.dev
HARVESTER_AGENT_URL=https://harvester-agent.iam-dd1.workers.dev
```

## Database Schema

Uses D1 tables:
- `edge_tasks` - Task queue & status
- `edge_executions` - Execution metrics
- `edge_results` - Result archival

See `../schema/d1_schema.sql` for full schema.

## Deployment

### Production
```bash
wrangler deploy --env production
```

**URL:** `https://orchestrator.iam-dd1.workers.dev`

### Staging
```bash
wrangler deploy --env staging
```

**URL:** `https://orchestrator-staging.iam-dd1.workers.dev`

## Testing

### Test Health
```bash
curl https://orchestrator.iam-dd1.workers.dev/health
```

### Queue a Task
```bash
curl -X POST https://orchestrator.iam-dd1.workers.dev/schedule/research \
  -H "Content-Type: application/json" \
  -d '{"query": "Rust async patterns", "limit": 10}'
```

### Check Task Status
```bash
curl https://orchestrator.iam-dd1.workers.dev/task/task_1707988800000_abc123def
```

### View Stats
```bash
curl https://orchestrator.iam-dd1.workers.dev/stats
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│          CEAN Orchestrator Worker                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  POST /schedule/{agent}  ─→  D1 (insert edge_tasks)    │
│                               ↓                           │
│                      Async: Call Agent API               │
│                               ↓                           │
│                      D1 (update status)                  │
│                                                           │
│  GET /task/{id}  ─→  D1 (query edge_tasks)              │
│  GET /stats      ─→  D1 (aggregate by agent_type)       │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Retry Logic

- **Max Retries:** 3
- **Backoff:** Exponential (2^attempt seconds)
- **Timeout:** 30 seconds per agent call

Failed tasks are logged in `edge_tasks.error` column for analysis.

## Cost Tracking

Each execution is logged with:
- `duration_ms` - Wall clock time
- `cpu_ms` - CPU time
- `memory_mb` - Memory used
- `cost_actual` - Actual cost in credits

Aggregated in `edge_executions` table for capacity planning.

## Next Steps

1. **Deploy:** `wrangler deploy --env production`
2. **Test:** Use curl commands above
3. **Monitor:** Check `/stats` endpoint periodically
4. **Scale:** Add Durable Objects for persistent queues (Phase 3B)

---

**Phase 3A Status:** ✅ Task Orchestrator - COMPLETE
