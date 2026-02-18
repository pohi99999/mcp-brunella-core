# CEAN Troubleshooting Guide

**Version:** 1.0  
**Last Updated:** 2026-02-18  
**Audience:** DevOps engineers, SREs, on-call engineers

---

## Table of Contents

1. [Diagnostic Tools](#diagnostic-tools)
2. [Common Issues & Solutions](#common-issues--solutions)
3. [Debugging Techniques](#debugging-techniques)
4. [Performance Issues](#performance-issues)
5. [Data Issues](#data-issues)
6. [Log Analysis](#log-analysis)

---

## Diagnostic Tools

### Essential Commands

```bash
# 1. Check worker status
wrangler status --env production

# 2. View real-time logs
wrangler tail --env production --format json

# 3. Test service health
curl -v https://cean-orchestrator.{account}.workers.dev/health

# 4. Get current metrics
curl https://cean-orchestrator.{account}.workers.dev/metrics

# 5. Query D1 database
wrangler d1 execute bas-metadata --command "SELECT COUNT(*) FROM edge_tasks;"

# 6. Check Prometheus targets
curl http://prometheus:9090/api/v1/targets

# 7. Query Prometheus metrics
curl "http://prometheus:9090/api/v1/query?query=cean_pipelines_total"
```

### Grafana Debugging

```
1. Open https://grafana.example.com/d/cean-dashboard
2. Check panel data source:
   - Click data source dropdown
   - Run test query: cean_pipelines_total
   - Verify results are populated
3. Check time range (top right):
   - Select "Last 1 hour" for recent data
   - Select "Last 24h" for trends
```

---

## Common Issues & Solutions

### Issue 1: "Worker Not Responding" (502 Bad Gateway)

**Symptoms:**
```
curl https://cean-orchestrator.{account}.workers.dev/health
> HTTP/502 Bad Gateway
```

**Diagnosis:**

```bash
# Check if worker is deployed
wrangler status --env production
# Look for: "Uploads" and "Latest Account ID"

# View error logs
wrangler tail --env production
# Look for: error, exception, timeout messages

# Check D1 connection
# (via Cloudflare Dashboard → D1 Databases → Connection errors)
```

**Solutions:**

| Root Cause | Fix |
|-----------|-----|
| Worker code error | Revert last commit: `git revert` + re-deploy |
| D1 connection timeout | Increase timeout: edit `index.ts` + re-deploy |
| D1 rate limit exceeded | Wait 60 seconds for rate limit to reset |
| Cloudflare edge issues | Wait 5 min, check status.cloudflare.com |

**Recovery:**

```bash
# Option 1: Hot-fix in code
# Edit myai/agents/workers/orchestrator/src/index.ts
# Fix the bug
npm run build
wrangler deploy --env production

# Option 2: Rollback
git log --oneline | head -5
git revert <bad-commit>
npm run build
wrangler deploy --env production
```

---

### Issue 2: High Pipeline Failure Rate (> 10%)

**Symptoms:**
```
- CEANHighFailureRate alert fires
- Grafana shows red on success rate
- #dev-alerts Slack notification
```

**Diagnosis:**

```bash
# Get failure breakdown by agent
SELECT agent_type, COUNT(*) as failures
FROM edge_tasks
WHERE status = 'failed' AND created_at >= datetime('now', '-1 hour')
GROUP BY agent_type;

# Sample error messages
SELECT error, COUNT(*) as count
FROM edge_tasks
WHERE status = 'failed'
GROUP BY error
ORDER BY count DESC
LIMIT 5;

# Check specific agent health
curl https://research-agent.{account}.workers.dev/health
curl https://grant-monitor.{account}.workers.dev/health
```

**Common Errors & Fixes:**

| Error | Cause | Fix |
|-------|-------|-----|
| "Agent timeout" | Agent slow or down | Re-deploy agent: `wrangler deploy --config agent/wrangler.toml` |
| "D1 connection timeout" | Too many concurrent requests | Implement connection pooling or backoff |
| "Invalid JSON response" | Agent returning wrong format | Check agent code, verify API contract |
| "Retry limit exceeded" | Multiple cascading failures | Check if D1 or agent is down |

---

### Issue 3: High Latency (P95 > 1000ms)

**Symptoms:**
```
- CEANHighLatencyP95 alert
- Grafana latency graph spiking
- User complaints of slow responses
```

**Diagnosis:**

```bash
# Identify slow pipelines
SELECT 
  agent_type, 
  latency_ms, 
  created_at
FROM edge_tasks
WHERE latency_ms > 1000
ORDER BY latency_ms DESC
LIMIT 10;

# Check D1 query performance log
PRAGMA stats;  # Shows I/O statistics

# Monitor system metrics during latency spike
# Cloudflare Dashboard → Workers → Analytics → Performance
```

**Solutions:**

```bash
# 1. Identify which agent is slow
SELECT agent_type, AVG(latency_ms) as avg_latency
FROM edge_tasks
WHERE created_at >= datetime('now', '-5 minutes')
GROUP BY agent_type
ORDER BY avg_latency DESC;

# 2. Check agent directly
curl -w "Time: %{time_total}s" https://research-agent.{account}.workers.dev/health

# 3. If agent slow: re-deploy or check logs
wrangler tail --config research-agent/wrangler.toml

# 4. If D1 slow: optimize queries
# Add indexes:
CREATE INDEX idx_tasks_status ON edge_tasks(status);
CREATE INDEX idx_tasks_created ON edge_tasks(created_at DESC);
```

---

### Issue 4: Metrics Not Updating

**Symptoms:**
```
- Grafana shows "No data"
- Metrics endpoint returns empty results
- No new data points in time-series database
```

**Diagnosis:**

```bash
# 1. Check if metrics endpoint is accessible
curl https://cean-orchestrator.{account}.workers.dev/metrics | head -5

# 2. Verify Prometheus is scraping
curl http://prometheus:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job == "cean-orchestrator")'

# 3. Check scrape status
# Open http://prometheus:9090/targets
# Look for cean-orchestrator job
# Check "Last Scrape" timestamp

# 4. Test metric query in Prometheus UI
# Open http://prometheus:9090/graph
# Enter: cean_pipelines_total
# Check if any results returned
```

**Solutions:**

| Issue | Fix |
|-------|-----|
| Prometheus target DOWN (red) | Re-check Prometheus config, verify URL is correct |
| 404 Not Found on /metrics | Deploy new orchestrator: metrics endpoint missing |
| Authentication errors | Check auth headers in Prometheus config |
| Metrics stale ( > 5 min old) | Check if pipelines are being executed |

---

### Issue 5: D1 Database Errors

**Symptoms:**
```json
{
  "error": "database is locked",
  "code": "D1_ERROR"
}
```

**Diagnosis:**

```bash
# Check D1 status
wrangler d1 info bas-metadata

# Count current connections
# (Note: D1 doesn't expose this directly)
# Estimate from recent queries
SELECT COUNT(*) as queries_in_flight FROM edge_tasks 
WHERE created_at >= datetime('now', '-10 seconds');

# Check if table is corrupted
PRAGMA integrity_check;

# Find large tables consuming space
SELECT name, SUM(pgsize) as size 
FROM dbstat 
GROUP BY name 
ORDER BY size DESC;
```

**Solutions:**

```bash
# 1. If "database is locked":
#   - Wait 30 seconds for lock to release
#   - Increase D1 timeout: 
#       const db = env.DB;
#       db.timeout = 30000; // 30 seconds

# 2. If disk full:
#   - Archive old data:
DELETE FROM edge_tasks WHERE created_at < datetime('now', '-60 days');
VACUUM;

# 3. If corrupted:
#   - Contact Cloudflare support for restore
#   - Provide database ID: 1c4e7d00-7b09-4ddf-88b4-8df42e1123ab

# 4. If slow queries:
#   - Add indexes (see Issue 3)
#   - Use EXPLAIN QUERY PLAN to analyze
```

---

### Issue 6: Authentication/Permissions Errors

**Symptoms:**
```
"error": "unauthorized", "code": 403
"error": "invalid_token", "code": 401
```

**Diagnosis:**

```bash
# Check Cloudflare API token
wrangler whoami

# Expected output:
# ✅ Successfully authenticated with Cloudflare!

# List workers to verify permissions
wrangler workers list

# Check D1 access
wrangler d1 list
```

**Solutions:**

```bash
# 1. Re-authenticate
wrangler login
# Follow browser-based auth flow

# 2. Verify Cloudflare token
wrangler whoami

# 3. Check account ID in wrangler.toml
cat myai/agents/workers/orchestrator/wrangler.toml | grep account_id
# Should be: dd107933ac970dac857f27cee7a7ff46
```

---

## Debugging Techniques

### 1. Add Temporary Debug Logs

```typescript
// In orchestrator/src/index.ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);
    console.log(`[DEBUG] ${url.pathname} - ${request.method}`);
    
    // Your code...
    
    console.log(`[DEBUG] Response status: ${response.status}`);
  }
};
```

Then view logs:
```bash
wrangler tail --env production --format json | grep DEBUG
```

### 2. Trace Specific Pipeline

```bash
# Find pipeline ID
curl https://cean-orchestrator.{account}.workers.dev/health | jq '.timestamp'

# Query its status in D1
SELECT * FROM edge_tasks WHERE id = 'task_xxxxx';

# View its execution log
SELECT * FROM edge_executions WHERE task_id = 'task_xxxxx';

# Check result
SELECT * FROM edge_results WHERE task_id = 'task_xxxxx';
```

### 3. Performance Profiling

```bash
# Add timing to HTTP request
curl -w "
  Total time: %{time_total}s
  Connect time: %{time_connect}s
  Starttransfer: %{time_starttransfer}s
" https://cean-orchestrator.{account}.workers.dev/health

# Breakdown:
# connect = network latency
# starttransfer = processing time (worker code execution)
# total = download time
```

### 4. Compare Behavior (Staging vs Production)

```bash
# Get metrics from both
curl https://cean-orchestrator-staging.workers.dev/metrics > metrics_staging.json
curl https://cean-orchestrator.{account}.workers.dev/metrics > metrics_prod.json

# Diff metrics
diff metrics_staging.json metrics_prod.json

# Or side-by-side in Excel:
jq -r '[.] | @csv' metrics_staging.json > staging.csv
jq -r '[.] | @csv' metrics_prod.json > prod.csv
```

---

## Performance Issues

### Cache Hit Rate Too Low (< 85%)

**Diagnosis:**

```bash
# Check metrics
curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json | jq '.metrics.cache'

# If hit_rate < 85%, investigate:
# 1. How many unique agents are being queried?
# 2. Is cache TTL sufficient?
# 3. Are there cache evictions?
```

**Solutions:**

```typescript
// In orchestrator/src/index.ts
// Increase cache TTL from 300s to 600s (10 minutes)
agentCache.set(agentType, endpoint, 600);

// Or increase cache size
class AgentCache {
  private cache = new Map<string, ...>();
  private maxSize = 100; // Increase from default
  
  set(agentType: string, url: string, ttlSeconds = 600) {
    if (this.cache.size > this.maxSize) {
      // Remove oldest entry
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    // ... set cache
  }
}
```

### Query Performance Degradation

**Diagnosis:**

```bash
# Identify slow queries in EXPLAIN output
EXPLAIN QUERY PLAN 
SELECT * FROM edge_tasks WHERE status = 'running' AND agent_type = 'research';

# Output example:
# 0|0|0|SEARCH TABLE edge_tasks USING FULL SCAN
# ↑ FULL SCAN is slow - need index
```

**Solution:**

```sql
-- Add index before WHERE clause columns
CREATE INDEX idx_tasks_status_agent ON edge_tasks(status, agent_type);

-- Verify index usage
EXPLAIN QUERY PLAN 
SELECT * FROM edge_tasks WHERE status = 'running' AND agent_type = 'research';
-- Should now show: SEARCH TABLE edge_tasks USING INDEX
```

---

## Data Issues

### Corrupted or Missing Data

**Diagnosis:**

```bash
# Check referential integrity
SELECT COUNT(*) FROM edge_tasks WHERE id IS NULL;  # Should be 0
SELECT COUNT(DISTINCT id) FROM edge_tasks;  # Count unique

# Check for orphaned records
SELECT * FROM edge_executions WHERE task_id NOT IN (
  SELECT id FROM edge_tasks
);
```

**Recovery:**

```bash
# If missing tasks:
# 1. Check backup
# 2. Restore from D1 snapshot (contact Cloudflare)

# If orphaned records:
# Delete them
DELETE FROM edge_executions WHERE task_id NOT IN (
  SELECT id FROM edge_tasks
);
```

### Inconsistent State

**Example:** Task marked completed but no results stored

```bash
# Find inconsistent tasks
SELECT id, status FROM edge_tasks 
WHERE status = 'completed' 
  AND id NOT IN (SELECT DISTINCT task_id FROM edge_results);

# Manually check and fix
SELECT * FROM edge_tasks WHERE id = 'task_xxxxx';
# If stuck in 'running': update to 'completed' or 'failed'
UPDATE edge_tasks SET status = 'failed', error = 'manual fix' 
WHERE id = 'task_xxxxx';
```

---

## Log Analysis

### Common Log Patterns

```
[ERROR] D1 connection timeout
→ Action: Increase timeout, check D1 connection pool

[WARN] Agent not responding (408 timeout)
→ Action: Check agent worker, maybe re-deploy

[INFO] Task completed successfully
→ Action: Normal operation, no action needed

[ERROR] Retry limit exceeded: 3 retries
→ Action: Check underlying error, may need backoff adjustment
```

### Parse Logs

```bash
# Get structured logs from wrangler
wrangler tail --env production --format json > logs.json

# Filter errors
jq '.[] | select(.level == "error")' logs.json

# Count log severity
jq -r '.level' logs.json | sort | uniq -c

# Get logs for specific URL
jq '.[] | select(.request.url | contains("/schedule"))' logs.json
```

---

## Quick Troubleshooting Checklist

When something breaks:

- [ ] **Health Check**: `curl /health` → is 200 OK?
- [ ] **Recent Changes**: `git log -5` → was there a recent deployment?
- [ ] **Metrics**: `curl /metrics` → are metrics being updated?
- [ ] **Database**: `SELECT COUNT(*) FROM edge_tasks` → can we query D1?
- [ ] **Agents**: Curl each agent `/health` → are they up?
- [ ] **Alerts**: Check Grafana → any critical alerts?
- [ ] **Logs**: `wrangler tail` → what error is showing?
- [ ] **External**: Check status.cloudflare.com → any incidents?

**If still stuck:**
1. Ask in #dev-alerts Slack channel
2. Check `/docs/CEAN_ALERTING_RUNBOOK.md` for your specific alert
3. Check `/docs/CEAN_PRODUCTION_RUNBOOK.md` for operational procedures
4. Contact DevOps lead (@devops-lead)

---

## References

- **Production Runbook:** `/docs/CEAN_PRODUCTION_RUNBOOK.md`
- **Alerting Guide:** `/docs/CEAN_ALERTING_RUNBOOK.md`
- **Metrics Setup:** `/docs/CEAN_GRAFANA_SETUP.md`
- **GitHub Repo:** https://github.com/pohi99999/mcp-brunella-core

---

**Last Reviewed:** 2026-02-18  
**Maintainer:** DevOps Team (@devops-lead)
