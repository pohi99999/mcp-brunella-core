# CEAN Production Runbook

**Version:** 1.0  
**Last Updated:** 2026-02-18  
**Owner:** DevOps Team (@devops-team)  
**Status:** Production Ready

---

## Table of Contents

1. [Quick Links](#quick-links)
2. [System Overview](#system-overview)
3. [Deployment Checklist](#deployment-checklist)
4. [Daily Operations](#daily-operations)
5. [Incident Response](#incident-response)
6. [Scaling & Performance](#scaling--performance)
7. [Cost Management](#cost-management)
8. [Backup & Recovery](#backup--recovery)

---

## Quick Links

| Resource | URL | Purpose |
|----------|-----|---------|
| Orchestrator Health | https://cean-orchestrator.{account}.workers.dev/health | Check service status |
| Metrics (Prometheus) | https://cean-orchestrator.{account}.workers.dev/metrics | Monitoring data |
| Metrics (JSON) | https://cean-orchestrator.{account}.workers.dev/metrics?format=json | API format |
| Grafana Dashboard | https://grafana.example.com/d/cean-dashboard | Visual monitoring |
| Prometheus UI | http://prometheus:9090 | Metric queries |
| Alerting Rules | /docs/CEAN_PROMETHEUS_ALERTS.yml | Alert definitions |
| Alerting Runbook | /docs/CEAN_ALERTING_RUNBOOK.md | Incident response |
| Cost Analysis | /docs/CEAN_COST_OPTIMIZATION.md | Billing info |
| GitHub Repo | https://github.com/pohi99999/mcp-brunella-core | Source code |

---

## System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  API Client                                             │
│  (External or internal service)                         │
└────────────────┬────────────────────────────────────────┘
                 │ POST /schedule/{agent_type}
                 ↓
┌─────────────────────────────────────────────────────────┐
│  CEAN Orchestrator (Cloudflare Worker)                  │
│  ├─ Task Queue (D1 SQLite)                              │
│  ├─ Agent Cache (5-min TTL, Phase 4.2 optimization)     │
│  ├─ Metrics Collection (Prometheus format)              │
│  └─ Analytics Engine Integration                        │
└────┬────────────────┬────────────────┬──────────────────┘
     │                │                │
     ↓                ↓                ↓
┌──────────┐  ┌──────────────┐  ┌──────────────────┐
│Research  │  │Grant Monitor │  │Harvest Agent     │
│Agent     │  │Agent         │  │(Future)          │
└──────────┘  └──────────────┘  └──────────────────┘
     │                │                │
     └────────────────┴────────────────┘
              │
              ↓
    ┌────────────────────┐
    │  D1 Database       │
    │  (metadata/results)│
    └────────────────────┘
```

### Metrics Flow

```
Worker /metrics endpoint
    ↓
Prometheus format (text/plain)
    ↓
Prometheus scraper (15s interval)
    ↓
Time-series database (30-day retention)
    ↓
Grafana dashboard (visual monitoring)
    ↓
Alert rules (5m evaluation)
    ↓
Notification channels (Slack, Email, PagerDuty, OpsGenie)
```

### Key Components

| Component | Type | Purpose | Status |
|-----------|------|---------|--------|
| Orchestrator | Worker | Dispatch & schedule | ✅ Production |
| Research Agent | Worker | Query research APIs | ✅ Production |
| Grant Monitor | Worker | Grant funding tracking | ✅ Production |
| Harvest Agent | Worker | Data collection | ✅ Production |
| D1 Database | SQLite | Task queue & results | ✅ Production |
| Analytics Engine | CAE | Real-time event logging | ✅ Production |
| Prometheus | Time-series DB | Metrics storage | ⏳ Staging |
| Grafana | Visualization | Dashboards & alerts | ⏳ Staging |

---

## Deployment Checklist

### Pre-Deployment (0-30 min)

- [ ] Code review: 2+ approvers
- [ ] All tests passing: `npm test` (✅ 655/679)
- [ ] Build successful: `npm run build` (0 errors)
- [ ] No breaking changes to API contracts
- [ ] Backup D1 database snapshot
- [ ] Review recent commits: `git log --oneline -10`
- [ ] Verify staging environment same as production

### Deployment (0-15 min)

```bash
# 1. Build artifacts
npm run build

# 2. Deploy orchestrator
wrangler deploy --env production \
  --config myai/agents/workers/orchestrator/wrangler.toml

# 3. Deploy agent workers (in parallel)
wrangler deploy --env production \
  --config myai/agents/workers/research-agent/wrangler.toml &
wrangler deploy --env production \
  --config myai/agents/workers/grant-monitor/wrangler.toml &
wrangler deploy --env production \
  --config myai/agents/workers/harvest-agent/wrangler.toml &
wait  # Wait for all deploys

# 4. Verify deployments
wrangler status --env production
```

### Post-Deployment (0-10 min)

- [ ] Check health endpoints
  ```bash
  curl https://cean-orchestrator.{account}.workers.dev/health
  curl https://research-agent.{account}.workers.dev/health
  ```

- [ ] Verify metrics endpoint
  ```bash
  curl https://cean-orchestrator.{account}.workers.dev/metrics | head -20
  ```

- [ ] Monitor error rate (5 min)
  - Check Grafana: should stay < 5%
  - Check Slack: no critical alerts

- [ ] Test sample pipeline
  ```bash
  curl -X POST https://cean-orchestrator.{account}.workers.dev/schedule/research \
    -H "Content-Type: application/json" \
    -d '{"query":"AI agents"}'
  ```

- [ ] Confirm deployment in git
  ```bash
  git log --oneline -1  # Should show your commit
  ```

### Rollback (if issues detected)

```bash
# 1. Identify problematic commit
git log --oneline --grep="deployment" -5

# 2. Revert recent changes
git revert <commit-hash>
npm run build
wrangler deploy --env production

# 3. Restore from backup (if data corruption)
# Contact Cloudflare support for D1 point-in-time recovery
```

---

## Daily Operations

### Morning Checklist (9:00 AM)

```bash
# 1. Check overnight alerts
# - Open https://grafana.example.com/alerts
# - Review any warning/critical alerts
# - Check Slack #dev-alerts channel

# 2. Verify system health
curl https://cean-orchestrator.{account}.workers.dev/health
# Expected: { status: "healthy", tasks_total: N, timestamp: ... }

# 3. Check metrics baseline
curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json
# Expected: success_rate > 95%, latency < 500ms avg

# 4. Review D1 table sizes
# (via Cloudflare Dashboard → D1 Databases)
# Alert if total size > 1GB (nearing limit)
```

### Throughout the Day

**Monitoring Frequency:**
- **Every 5 min:** Grafana dashboard (automated alerts)
- **Every 30 min:** Check #dev-alerts Slack channel
- **Every 4 hours:** Review cost metrics
- **Daily:** Check D1 table sizes and query performance

**Manual Checks:**

```bash
# Query metrics
curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json | jq .metrics.pipelines

# Check error rate
curl https://cean-orchestrator.{account}.workers.dev/stats | jq '.[] | select(.agent_type)'

# View recent errors
# (via D1 SQL)
SELECT error, COUNT(*) as count
FROM edge_tasks
WHERE status = 'failed' AND created_at >= datetime('now', '-1 hour')
GROUP BY error;
```

### Weekly Maintenance (Friday)

- [ ] **Review metrics trends**
  - Success rate: should be stable > 95%
  - Latency: should be stable < 500ms avg
  - Cost: validate against budget

- [ ] **Cleanup old tasks**
  ```sql
  DELETE FROM edge_tasks
  WHERE created_at < datetime('now', '-30 days')
  AND status IN ('completed', 'failed');
  ```

- [ ] **Review cache hit rate**
  - Target: > 85%
  - If < 85%: increase TTL or add more agents

- [ ] **Test disaster recovery**
  - Verify backup availability
  - Team should be able to restore in < 1 hour

### Monthly Maintenance (1st of month)

- [ ] **Capacity planning**
  - Analyze 30-day trends
  - Project next month's usage
  - Budget next quarter

- [ ] **Security audit**
  - Review access logs
  - Verify D1 encryption is enabled
  - Check API key rotation schedule

- [ ] **Documentation update**
  - Update runbooks if procedures changed
  - Review and update team training materials
  - Document any new incident learnings

---

## Incident Response

### Severity Levels & Response Time

| Level | Definition | First Response | Full Resolution |
|-------|-----------|-----------------|-----------------|
| P1 - Critical | Service down, > 50% errors | 5 min | < 1 hour |
| P2 - Warning | Degraded service, 5-50% errors | 30 min | < 4 hours |
| P3 - Info | Minor issue, < 5% impact | 4 hours | < 1 day |

### Incident Response Flowchart

```
Alert received
    ↓
[P1?] ──YES→ Page on-call engineer (PagerDuty)
↓ NO         Slack #dev-alerts notification
[P2?] ──YES→ Create incident ticket
↓ NO         Slack #dev-alerts mention
[P3?] ──YES→ Log for weekly review
↓
Start investigation
    ↓
Identify root cause
    ↓
Implement fix/workaround
    ↓
Verify recovery
    ↓
Post-incident review (P1/P2 only)
```

### Common Incidents & Responses

See `/docs/CEAN_ALERTING_RUNBOOK.md` for detailed procedures:

- [High Failure Rate](../CEAN_ALERTING_RUNBOOK.md#1-cean-high-failure-rate)
- [Low Success Rate](../CEAN_ALERTING_RUNBOOK.md#2-cean-low-success-rate)
- [High Latency](../CEAN_ALERTING_RUNBOOK.md#3-cean-high-latency-p95)
- [Worker Down](../CEAN_ALERTING_RUNBOOK.md#9-cean-orchestrator-down)
- [Database Issues](../CEAN_ALERTING_RUNBOOK.md#7-cean-high-database-load)

### Post-Incident Review (P1/P2)

Within 24 hours:

1. **Timeline** - Document exact timeline of incident
2. **Root Cause** - What actually happened (not symptoms)
3. **Impact** - How many users/pipelines affected
4. **Detection Time** - How long before we noticed
5. **Resolution** - What we did to fix
6. **Prevention** - What we'll do to prevent recurrence

Template:
```markdown
## Incident Report: [Date] [Incident Name]

### Timeline
- 15:23 - Alert fired: High failure rate
- 15:27 - On-call investigated
- 15:31 - Root cause identified: D1 connection timeout
- 15:45 - Deployed fix: retry logic increased
- 16:00 - Service fully recovered

### Root Cause
D1 connection pool was exhausted due to a slow network issue
causing requests to hang and block the pool.

### Impact
- Duration: 22 minutes
- Affected pipelines: 245 (5% of baseline)
- Users impacted: ~3-5 customers

### Prevention
1. Implement circuit breaker pattern for D1 calls
2. Add connection pool monitoring
3. Increase pool size to 50 (from 20)
```

---

## Scaling & Performance

### When to Scale

| Metric | Threshold | Action |
|--------|-----------|--------|
| Pipelines/sec > 100/sec | Add worker CPU | Upgrade Cloudflare plan |
| D1 queries > 1,000/sec | Optimize queries | Add indexes, cache |
| P95 latency > 1s | Analyze slow queries | See [Optimization](#optimization) |
| Cost > 2x forecast | Reduce load or optimize | Review [Cost](#cost-management) |

### Optimization

**Phase 4.2 optimizations already deployed:**
- ✅ Agent URL caching (5-min TTL, ~85% hit rate)
- ✅ D1 indexes on high-cardinality columns
- ✅ Connection pooling (10 connections)
- ✅ Request batching for D1 writes

**Further optimizations if needed:**
1. **Increase cache TTL**: 300s → 600s (if agent endpoints stable)
2. **Implement query batch writes**: Insert 100 records in one D1 call
3. **Add Redis cache layer**: For frequently accessed agent URLs
4. **Implement query result caching**: Cache agent response for 10s

### Database Optimization

```sql
-- Check index usage
PRAGMA index_list(edge_tasks);

-- Find missing indexes
EXPLAIN QUERY PLAN SELECT * FROM edge_tasks WHERE status = 'running';

-- Add if not present
CREATE INDEX IF NOT EXISTS idx_tasks_status ON edge_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON edge_tasks(created_at DESC);

-- Vacuum database (consolidates space)
VACUUM;
```

---

## Cost Management

### Budget Tracking

**2026 Target:** < $30 USD/month

**Breakdown:**
- Cloudflare Workers: ~$10-15/month (execution cost)
- D1 Database: ~$5-10/month (storage + queries)
- Prometheus/Grafana: Free tier (self-hosted)
- Bandwidth/data: ~$0-5/month

### Cost Per Operation

Based on Phase 4.2 analysis:

- **Per pipeline**: ~$0.000118 ÷ 100 = $0.00000118
- **Per 1,000 pipelines**: $0.00118
- **Per 1M pipelines/month**: $1.18

### Reducing Costs

1. **Increase cache hit rate** (current: 85%)
   - Target: 90%+
   - Benefit: Save 5% on D1 queries

2. **Optimize D1 queries**
   - Use SELECT specific columns (not SELECT *)
   - Add WHERE clauses to limit rows
   - Batch writes: 100 tasks per request

3. **Reduce pipeline frequency**
   - Evaluate if polling is necessary
   - Consider event-driven triggers

4. **Archive old data**
   - Delete completed tasks > 30 days old
   - Keep failures for 90 days (audit trail)

---

## Backup & Recovery

### Backup Strategy

| Component | Frequency | Retention | Method |
|-----------|-----------|-----------|--------|
| D1 Database | Daily (automatic) | 7 days | Cloudflare snapshots |
| Source Code | On commit | ∞ | Git (GitHub) |
| Metrics | 30 days | 30 days | Prometheus TSDB |
| Config files | On change | ∞ | Git + docs/ folder |

### Manual Backup

```bash
# 1. Export D1 schema
wrangler d1 execute bas-metadata --command "SELECT sql FROM sqlite_master WHERE type='table';" > backup_schema.sql

# 2. Export data (limited to 1000 rows per table)
# This may require custom script due to D1 API limitations
# Contact Cloudflare support for bulk export

# 3. Backup code
git push  # Ensure all commits pushed to GitHub

# 4. Backup configs
cp -r docs/ backup/docs/
cp -r myai/agents/workers/*/wrangler.toml backup/wrangler/
```

### Recovery Procedure

#### Scenario 1: Corrupted D1 Data

```bash
# 1. Identify when data became corrupted
# From git log or monitoring alerts

# 2. Restore from Cloudflare backup
# Contact Cloudflare support:
# - Provide database ID: 1c4e7d00-7b09-4ddf-88b4-8df42e1123ab
# - Request point-in-time recovery to [date/time]
# - ETA: 1-4 hours

# 3. Verify data integrity
SELECT COUNT(*) as total_tasks FROM edge_tasks;
SELECT SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM edge_tasks;
```

#### Scenario 2: Worker Code Corruption

```bash
# 1. Identify problematic commit
git log --oneline | head -10

# 2. Revert to last known good
git revert [bad-commit]
npm run build

# 3. Redeploy
wrangler deploy --env production

# 4. Verify
curl https://cean-orchestrator.{account}.workers.dev/health
```

#### Scenario 3: Complete Outage (All workers down)

```bash
# 1. Check Cloudflare status
# https://status.cloudflare.com

# 2. Check if edge failures are global
# Manually curl from different regions

# 3. If isolated to specific region:
#   - Cloudflare usually routes around it automatically
#   - No action needed

# 4. If all workers down:
#   - Check source code is still in GitHub
#   - Redeploy all workers from scratch
#   - Restore D1 from backup if needed
#   - ETA: 30 minutes to full recovery
```

---

## Contacts & Escalation

### On-Call Schedule
- **Mon-Fri 9AM-5PM:** Primary on-call + secondary (backup)
- **Nights/Weekends:** On-call engineer (on-rotation)

### Team
- **DevOps Lead:** @devops-lead (#dev-alerts)
- **Backend Lead:** @backend-lead (#dev-infrastructure)
- **Incident Commander:** @ic-on-rotation (P1 incidents)

### External Escalation
- **Cloudflare Support:** support@cloudflare.com (Enterprise level)
- **PagerDuty:** Critical incidents auto-paged
- **Slack:** #dev-alerts channel for all alerts

---

## References

- **Alerting:** `/docs/CEAN_ALERTING_RUNBOOK.md`
- **Troubleshooting:** `/docs/CEAN_TROUBLESHOOTING_GUIDE.md`
- **Metrics:** `/docs/CEAN_GRAFANA_SETUP.md`
- **Cost Analysis:** `/docs/CEAN_COST_OPTIMIZATION.md` (Phase 4.2)
- **Test Results:** `/docs/CEAN_PHASE_43_E2E_TESTING.md`

---

**Last Reviewed:** 2026-02-18  
**Next Review:** 2026-03-18  
**Approved By:** DevOps Lead, Backend Lead
