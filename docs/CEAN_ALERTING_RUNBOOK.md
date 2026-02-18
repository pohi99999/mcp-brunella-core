# CEAN Alerting Runbook

## Overview
This document provides step-by-step response procedures for each CEAN alert type.

**Alert Severity Levels:**
- 🔴 **CRITICAL** (P1) - Immediate action required, service degradation/outage
- 🟠 **WARNING** (P2) - Investigate within 30 minutes, may lead to issues
- 🔵 **INFO** (P3) - Informational, monitor for patterns

---

## 1. 🔴 CEANHighFailureRate - Pipeline Failure Rate > 10%

**Severity:** CRITICAL  
**Duration:** Alert fires after 5 minutes of > 10% failure rate  
**Impact:** ~90% of pipelines failing = critical service degradation

### Immediate Response (0-5 min)

```bash
# 1. Check Orchestrator health
curl https://cean-orchestrator.{account}.workers.dev/health

# 2. Verify D1 database connectivity
# - Open Cloudflare Dashboard → Workers → cean-orchestrator
# - Check Errors tab for D1 connection timeouts

# 3. Check agent endpoint status
curl https://research-agent.{account}.workers.dev/health
curl https://grant-monitor.{account}.workers.dev/health  
curl https://harvester-agent.{account}.workers.dev/health

# 4. View recent pipeline errors
# Check Grafana dashboard: https://grafana.example.com/d/cean-dashboard
# Filter by: status="failed" in last 5 minutes
```

### Investigation (5-15 min)

**Possible Root Causes:**

| Symptom | Cause | Check |
|---------|-------|-------|
| All agents timing out | D1 database slow | Cloudflare: Workers → Analytics → Performance |
| Specific agent failing | Agent code bug | Check agent worker logs |
| Intermittent failures | Network congestion | Latency high? See [High Latency](#high-latency-p95) |
| task_id generation error | UUID collision | Check task ID format in logs |

**Commands:**

```typescript
// Query recent failures in D1
SELECT id, agent_type, error, created_at 
FROM edge_tasks 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 100;

// Analyze error pattern
SELECT 
  error,
  COUNT(*) as count
FROM edge_tasks
WHERE created_at >= datetime('now', '-5 minutes')
GROUP BY error
ORDER BY count DESC;
```

### Resolution

**If D1 is slow:**
1. Check query performance in Cloudflare Dashboard
2. Review indexes on `edge_tasks` table
3. Consider query optimization (see Phase 4.2 improvements)

**If specific agent is down:**
1. Re-deploy agent: `wrangler deploy -c myai/agents/workers/{agent}/wrangler.toml`
2. Verify deployment succeeded: `wrangler status`

**If orchestrator is returning errors:**
1. Check Cloudflare Tail logs: `wrangler tail --env production`
2. Review recent code changes via `git log --oneline`
3. Hot-fix or rollback as needed

### Prevention

- ✅ Set resource limits on D1 queries
- ✅ Add circuit breaker to agent calls  
- ✅ Implement exponential backoff for retries (max 3)
- ✅ Monitor agent endpoint SLA

---

## 2. 🟠 CEANLowSuccessRate - Success Rate Below 95%

**Severity:** WARNING  
**Duration:** Alert fires after 10 minutes of < 95% success rate  
**Impact:** ~5% of pipelines failing = service quality issue

### Immediate Response (0-5 min)

```bash
# 1. View current success rate
curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json
# Look for: metrics.pipelines.success_rate_pct

# 2. Check error breakdown
SELECT 
  agent_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures
FROM edge_tasks
WHERE created_at >= datetime('now', '-30 minutes')
GROUP BY agent_type;

# 3. Sample failed tasks
SELECT id, error, created_at FROM edge_tasks 
WHERE status = 'failed' 
ORDER BY created_at DESC LIMIT 10;
```

### Investigation (5-20 min)

**Common Causes:**

1. **Specific agent underperforming**
   - Check agent error logs
   - Verify agent endpoint health
   - Review agent timeout settings

2. **D1 rate limiting**
   - Check Cloudflare Analytics → Rate limiting
   - Verify query patterns aren't hammering one table

3. **Cache miss spikes**
   - Check cache hit rate (should be > 85%)
   - If low, agent endpoint lookups failing
   - See [Cache Miss Rate High](#cacheflare-miss-rate-spike) for details

### Resolution

**Step 1: Identify failing agent**
```typescript
SELECT agent_type, COUNT(*) as failures
FROM edge_tasks
WHERE status = 'failed' 
  AND created_at >= datetime('now', '-10 minutes')
GROUP BY agent_type
ORDER BY failures DESC;
```

**Step 2: Remediate**
- If 1 agent: Re-deploy that agent only
- If all agents: Likely orchestrator issue (see [High Failure Rate](#1-cean-high-failure-rate))

**Step 3: Monitor recovery**
- Watch success rate on Grafana
- Target: > 95% within 5 minutes

---

## 3. 🟠 CEANHighLatencyP95 - P95 Latency > 1 Second

**Severity:** WARNING  
**Duration:** Alert fires after 5 minutes of P95 > 1000ms  
**Impact:** ~5% of users experiencing slow responses

### Immediate Response (0-5 min)

```bash
# 1. Check current latency
curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json
# Look for: metrics.latency.p95_ms

# 2. Identify slowest pipelines
SELECT 
  agent_type,
  latency_ms,
  created_at
FROM edge_tasks
WHERE latency_ms > 1000
ORDER BY latency_ms DESC
LIMIT 20;

# 3. Check Cloudflare Analytics
# Dashboard → Workers → Performance tab
# Look for: Requests > 1s, CPU time > cpu-time
```

### Root Cause Analysis

**Common Causes:**

| Symptom | Root Cause | Action |
|---------|-----------|--------|
| All pipelines slow | D1 slow query | Optimize query, check indexes |
| Specific agent slow | Agent endpoint latency | Check agent logs |
| Periodic slowness | D1 connection pool exhaustion | Increase pool size |
| Latency trend up | Cache miss rate increased | Verify cache is working |

### Resolution

**If D1 is slow:**
```typescript
// Find slow queries
SELECT id, latency_ms, payload
FROM edge_tasks
WHERE latency_ms > 1000
ORDER BY latency_ms DESC;

// Optimize indexes
CREATE INDEX idx_tasks_by_status ON edge_tasks(status);
CREATE INDEX idx_tasks_by_agent ON edge_tasks(agent_type);
CREATE INDEX idx_tasks_by_created ON edge_tasks(created_at DESC);
```

**If agent is slow:**
1. Check agent capacity: `wrangler status`
2. Review agent code for blocking operations
3. Check agent database connectivity

**Performance Tuning:**
- Add aggressive caching (Phase 4.2 already implements 5-min TTL)
- Reduce retry delay (currently 100ms per retry)
- Implement request batching

---

## 4. 🔴 CEANVeryHighLatencyP99 - P99 Latency > 3 Seconds

**Severity:** CRITICAL  
**Duration:** Alert fires after 3 minutes of P99 > 3000ms  
**Impact:** ~1% of users experiencing very slow/timeout responses

### Immediate Response (0-2 min)

**ESCALATE immediately to on-call engineer.**

```bash
# 1. Check if orchestrator/agents are responsive
curl -m 5 https://cean-orchestrator.{account}.workers.dev/health
curl -m 5 https://research-agent.{account}.workers.dev/health

# 2. Check Cloudflare incident status
# https://www.cloudflarestatus.com

# 3. Check D1 emergency status
# Cloudflare Dashboard → Workers → D1 Databases
```

### Actions (0-10 min)

- [ ] Page on-call engineer (PagerDuty)
- [ ] Notify stakeholders: #production-incident Slack
- [ ] Start incident log (timestamp, actions taken)
- [ ] Check if scaling is needed (worker CPU/memory)
- [ ] Review last deployment (rollback if recent change)

### Resolution

1. **Check Cloudflare status**
   - Is Cloudflare experiencing outage?
   - Check: https://www.cloudflarestatus.com

2. **Scale workers**
   ```bash
   # Temporarily increase CPU milliseconds per request
   wrangler deploy --env production --compatibility-flags "nodejs_compat"
   ```

3. **Check D1 connection pool**
   - Review database connection limits
   - May need to increase Cloudflare plan

4. **Rollback if needed**
   ```bash
   git log --oneline -5
   git revert <commit> # If recent code change caused slowness
   wrangler deploy --env production
   ```

---

## 5. 🔵 CEANCacheMissRateHigh - Cache Miss Rate > 30%

**Severity:** INFO  
**Duration:** Alert fires after 10 minutes of > 30% miss rate  
**Impact:** More agent endpoint lookups hitting D1

### Possible Causes

1. **Cache TTL expired**
   - Current TTL: 5 minutes
   - If agent URL policy changes frequently, increase TTL

2. **Cache eviction**
   - Max cache size reached
   - Too many unique agent types queried

3. **Agent endpoints changing**
   - New agent deployments
   - Agent URL migration

### Resolution

```typescript
// Check cache stats (would be logged in analytics)
SELECT COUNT(DISTINCT agent_type) as unique_agents
FROM edge_tasks
WHERE created_at >= datetime('now', '-1 hour');

// Increase cache TTL if needed
// In src/index.ts:
// agentCache.set(agentType, endpoint, 600); // 10 minutes instead of 300
```

---

## 6. 🟠 CEANNoPipelineExecution - No Execution in 1 Hour

**Severity:** WARNING  
**Duration:** Alert fires after 1 hour with no new pipelines  
**Impact:** Service appears inactive (may be normal in dev)

### Response

**In Production:**
1. Check if traffic is expected
2. Verify orchestrator is responsive: `curl /health`
3. Check application logs for client-side errors
4. Verify API endpoints are accessible

**In Development/Staging:**
- This is usually normal
- Acknowledge alert, no action needed

### Suppression

If no-execution is normal in your environment:

Edit `docs/CEAN_PROMETHEUS_ALERTS.yml`:

```yaml
- alert: CEANNoPipelineExecution
  expr: increase(cean_pipelines_total[1h]) == 0
  for: 1h
  labels:
    severity: info  # Downgrade from warning to info
    environment: "{{ $externalLabels.environment }}"
  annotations:
    summary: "No pipeline execution in 1 hour (expected in dev)"
```

---

## 7. 🟠 CEANHighDatabaseLoad - D1 Query Rate > 100/sec

**Severity:** WARNING  
**Duration:** Alert fires after 5 minutes of > 100 queries/sec  
**Impact:** Database approaching rate limits

### Investigation

```typescript
// Estimate queries per second
SELECT 
  COUNT(*) as recent_queries
FROM edge_tasks
WHERE created_at >= datetime('now', '-5 minutes');

// If 30,000 queries in 5 min = 100/sec
// This should trigger via metrics

// Check query types
SELECT 
  COUNT(*) as count,
  'pipeline insert' as type
FROM (SELECT 1 FROM edge_tasks LIMIT 1)
UNION ALL
SELECT COUNT(*), 'pipeline update'
FROM edge_executions;
```

### Actions

1. **Check cache effectiveness**
   - If cache hit rate > 85%, D1 load is normal
   - If < 85%, need to increase cache TTL

2. **Optimize queries**
   - Add indexes on frequently filtered columns
   - Use SELECT * only if needed

3. **Scale D1**
   - Upgrade Cloudflare plan for higher limits
   - Consider query batching

---

## 8. 🔵 CEANCostSpike - Daily Cost > $0.01 (30m average)

**Severity:** INFO  
**Duration:** Alert fires after 30 minutes of > $0.01/day estimate  
**Impact:** Increased operating costs (usually harmless if expected)

### Context

Based on Phase 4.2 analysis:
- **Baseline:** $0.000118 per 100 pipelines average
- **$0.01/day:** ~8,500 pipelines
- **$1.00/day:** ~850,000 pipelines

### Response

1. **Verify this is expected load**
   - Check API traffic metrics
   - Review recent marketing campaigns / releases

2. **Check for abuse**
   - Are there unusual query patterns?
   - Is a single client spamming requests?

3. **Optimize if needed**
   - Review Phase 4.2 optimizations (caching, indexes)
   - Consider rate limiting

---

## 9. 🔴 CEANOrchestratorDown - Worker Health Check Failure

**Severity:** CRITICAL  
**Duration:** Alert fires after 2 minutes  
**Impact:** All pipeline requests will fail

### Immediate Actions (0-1 min)

```bash
# 1. Check worker status
wrangler status --env production

# 2. Check Cloudflare Dashboard
# Open: https://dash.cloudflare.com/workers/overview

# 3. View worker logs
wrangler tail --env production --format json

# 4. Try manual health check
curl -v https://cean-orchestrator.{account}.workers.dev/health
```

### Root Cause Analysis

**If 502 Bad Gateway:**
1. D1 database connection failure
2. Worker code error
3. Cloudflare edge issue

**If timeout:**
1. Worker is hanging (infinite loop)
2. D1 is unresponsive
3. Network connectivity issue

### Recovery

**Option 1: Rollback**
```bash
git log --oneline -5
git revert <problematic-commit>
npm run build && wrangler deploy --env production
```

**Option 2: Hot-fix**
```bash
# Edit orchestrator code
# Fix the bug in src/index.ts
npm run build
wrangler deploy --env production

# Verify
curl https://cean-orchestrator.{account}.workers.dev/health
```

**Option 3: Check D1**
```
If D1 is down (rare):
- Check https://www.cloudflarestatus.com
- Wait for Cloudflare to recover
- D1 has global redundancy, so this is extremely rare
```

---

## Escalation Matrix

| Alert | Severity | Owner | Escalate if | Contact |
|-------|----------|-------|------------|---------|
| High Failure Rate | CRITICAL | On-Call Eng | Not resolved in 15 min | #dev-alerts → PagerDuty |
| Very High Latency P99 | CRITICAL | On-Call Eng | Not resolved in 10 min | PagerDuty → VP Eng |
| Orchestrator Down | CRITICAL | On-Call Eng | Not resolved in 5 min | PagerDuty → @all |
| High Latency P95 | WARNING | Dev Team | Not resolved in 30 min | #dev-alerts |
| Low Success Rate | WARNING | Dev Team | Not resolved in 1 hour | #dev-alerts |
| Database Load High | WARNING | Dev Team | > 500 queries/sec | #dev-alerts |
| Other | INFO | Dev Team | See patterns | #dev-alerts weekly |

---

## Testing Alerts

### Trigger a test alert (non-production)

```bash
# Deploy test worker that generates high latency
wrangler deploy --config test-worker-wrangler.toml

# Send test pipelines with artificial latency
curl -X POST https://cean-orchestrator-test.workers.dev/schedule/research \
  -H "Content-Type: application/json" \
  -d '{"delay_ms": 5000}'

# Alert should fire within 5 minutes
# Verify Slack notification received
```

### Disable alert temporarily

```yaml
# In CEAN_PROMETHEUS_ALERTS.yml
- alert: CEANHighFailureRate
  expr: up{job="cean-orchestrator"} == 0  # Disable by impossible condition
  # Original: (cean_pipelines_failed / cean_pipelines_total) > 0.1
```

---

## Alert Tuning

### Too many false positives?

1. **Increase duration threshold**
   ```yaml
   for: 5m   # Increase to 10m or 15m
   ```

2. **Adjust threshold value**
   ```yaml
   expr: cean_pipeline_success_rate < 95  # Increase to 90 for less noise
   ```

3. **Add environment filter**
   ```yaml
   expr: (cean_pipelines_failed / cean_pipelines_total) > 0.1
         and environment == "production"
   ```

### Alert not firing?

1. Verify Prometheus is scraping metrics
   - Check: `http://prometheus:9090/targets`
   - All targets should be `UP` (green)

2. Check for typos in alert rule
   ```bash
   promtool check rules CEAN_PROMETHEUS_ALERTS.yml
   ```

3. Verify metric query works
   ```bash
   curl http://prometheus:9090/api/v1/query?query=cean_pipelines_total
   ```

---

## References

- **Metrics Endpoint:** https://cean-orchestrator.{account}.workers.dev/metrics
- **Grafana Dashboard:** https://grafana.example.com/d/cean-dashboard
- **Prometheus Alerts:** `docs/CEAN_PROMETHEUS_ALERTS.yml`
- **Notification Channels:** `docs/CEAN_NOTIFICATION_CHANNELS.json`
- **Cost Analysis:** `docs/CEAN_COST_OPTIMIZATION.md` (Phase 4.2)
- **Performance Tuning:** `docs/CEAN_PHASE_43_E2E_TESTING.md`

---

**Last Updated:** 2026-02-18  
**Version:** 1.0  
**Owner:** DevOps Team (@devops-team)
