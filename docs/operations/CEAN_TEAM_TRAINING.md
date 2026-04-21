# CEAN Team Training Guide

**Version:** 1.0  
**Last Updated:** 2026-02-18  
**Audience:** New team members, on-boarding engineers

---

## Welcome to CEAN! 🚀

**CEAN** = Cloudflare Edge Agent Network

A distributed system for running AI agents (research, grants, harvesting) in production on **Cloudflare Workers** with real-time monitoring and alerting.

---

## Learning Path

### Day 1: High-Level Overview

**Duration:** 2-3 hours

#### 1. System Architecture (30 min)
- Watch: [Cloudflare Workers Introduction](https://www.cloudflare.com/learning/serverless/what-is-serverless/)
- Read: [`docs/CEAN_INFRASTRUCTURE_SNAPSHOT.md`](../CEAN_INFRASTRUCTURE_SNAPSHOT.md)
- Understand: Orchestrator → Agents → D1 Database flow

#### 2. Deployment & Operations (1 hour)
- Read: [`docs/CEAN_PRODUCTION_RUNBOOK.md`](../CEAN_PRODUCTION_RUNBOOK.md) (Sections 1-3)
- Try: Deploy test worker to staging
  ```bash
  wrangler deploy --env staging --config myai/agents/workers/orchestrator/wrangler.toml
  ```
- Verify: `curl https://cean-orchestrator-staging.workers.dev/health`

#### 3. Monitoring Setup (30 min)
- Read: [`docs/CEAN_GRAFANA_SETUP.md`](../CEAN_GRAFANA_SETUP.md) (Quick Start section)
- Login to Grafana: https://grafana.example.com
- View CEAN dashboard: https://grafana.example.com/d/cean-dashboard

**Checkpoint:** Can you access health endpoint and view metrics? ✅

---

### Day 2: Alerting & Troubleshooting

**Duration:** 3-4 hours

#### 1. Alerting Rules (1 hour)
- Read: [`docs/CEAN_ALERTING_RUNBOOK.md`](../CEAN_ALERTING_RUNBOOK.md)
- Understand alert severity levels:
  - 🔴 **CRITICAL (P1)** - Page on-call immediately
  - 🟠 **WARNING (P2)** - Create incident ticket
  - 🔵 **INFO (P3)** - Log for weekly review
- Identify your alert ownership
  - Example: "I own alerts for Research Agent"

#### 2. Common Incidents (1 hour)
Read incident response procedures:

| Alert | Time | Read |
|-------|------|------|
| High Failure Rate | 15 min | [Section 1](../CEAN_ALERTING_RUNBOOK.md#1-cean-high-failure-rate) |
| High Latency | 30 min | [Section 3](../CEAN_ALERTING_RUNBOOK.md#3-cean-high-latency-p95) |
| Worker Down | 5 min | [Section 9](../CEAN_ALERTING_RUNBOOK.md#9-cean-orchestrator-down) |

#### 3. Troubleshooting (1-2 hours)
- Read: [`docs/CEAN_TROUBLESHOOTING_GUIDE.md`](../CEAN_TROUBLESHOOTING_GUIDE.md)
- Try:
  ```bash
  # Check health
  curl https://cean-orchestrator.{account}.workers.dev/health
  
  # View metrics
  curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json | jq '.metrics'
  
  # Query D1
  wrangler d1 execute bas-metadata --command "SELECT COUNT(*) FROM edge_tasks;"
  
  # View logs
  wrangler tail --env production
  ```

**Checkpoint:** Can you respond to a sample incident? ✅

---

### Week 1-2: Hands-On Operations

**Duration:** 40 hours (ongoing)

#### 1. On-Call Rotation (5-8 hours)
- Shadow an experienced on-call engineer
- Be primary on-call for low-traffic hours (2-4 AM)
- Handle alerts and document your responses

#### 2. Code Review (5-10 hours)
- Review PRs to CEAN components
- Understand code patterns:
  - Agent implementations
  - Metrics collection
  - Error handling
- Ask questions in PRs, learn the patterns

#### 3. Deployment Practice (5-10 hours)
- Deploy to staging 3+ times
- Practice rollback procedure
- Deploy to production under supervision
- Understand deployment checklist in [`CEAN_PRODUCTION_RUNBOOK.md`](../CEAN_PRODUCTION_RUNBOOK.md#deployment-checklist)

#### 4. Exploratory Debugging (5-10 hours)
- Fix non-critical bugs
- Optimize D1 queries
- Improve monitoring/dashboard
- Contribute to troubleshooting docs

#### 5. Documentation (5-10 hours)
- Update runbooks with new learnings
- Document new debugging techniques
- Create runbooks for edge cases
- Add Q&A section to training guide

---

## Key Concepts

### 1. Cloudflare Workers

**What:** Serverless compute platform (like Lambda, but on the edge)

**Key points:**
- Run code in 200+ data centers globally
- Automatic scaling (no capacity planning)
- Pay per request (very cheap)
- Cold start < 1ms

**Resources:**
- [Cloudflare Workers Overview](https://www.cloudflare.com/learning/serverless/what-is-serverless/)
- [Workers Documentation](https://developers.cloudflare.com/workers/)

### 2. D1 Database

**What:** SQLite database running on Cloudflare edges

**Key points:**
- SQL queries (like PostgreSQL but simpler)
- Replication across regions
- 7-day point-in-time recovery
- Rate limits: 1,000 queries/sec per database

**Usage:**
```typescript
const db = env.DB as D1Database;
const result = await db
  .prepare('SELECT * FROM edge_tasks WHERE id = ?')
  .bind(taskId)
  .first<EdgeTask>();
```

### 3. Metrics & Monitoring

**What:** Real-time tracking of system health

**Pipeline:**
```
Worker (Prometheus format) 
  → Prometheus (scrape every 15s)
  → Time-series data
  → Grafana (dashboards)
  → Alert rules
  → Notifications (Slack, Email, PagerDuty)
```

**Key metrics:**
- **Success rate:** % of pipelines that completed successfully
- **Latency (P95):** 95th percentile response time
- **Cache hit rate:** % of queries served from cache
- **Cost:** Estimated daily operating cost

### 4. Alerting

**What:** Automated notifications when thresholds are exceeded

**Severity:**
- **P1 Critical:** Call someone immediately (success rate < 90%, latency > 3s)
- **P2 Warning:** Create ticket (success rate < 95%, latency > 1s)
- **P3 Info:** Log and review (informational metrics)

**Example:**
```yaml
- alert: CEANHighFailureRate
  expr: (cean_pipelines_failed / cean_pipelines_total) > 0.1
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "10%+ pipelines failing for 5+ minutes"
```

---

## Tools & Access

### Required Tools

| Tool | Purpose | Installation |
|------|---------|--------------|
| **git** | Version control | `brew install git` / `winget install Git.Git` |
| **Node.js 20+** | Runtime/build | `nvm install 20` |
| **wrangler** | Cloudflare CLI | `npm install -g @cloudflare/wrangler` |
| **curl** | HTTP testing | Built-in on Mac/Linux |
| **jq** | JSON processing | `brew install jq` / `winget install jqlang.jq` |

### Access Setup

```bash
# 1. Clone repository
git clone https://github.com/pohi99999/mcp-brunella-core.git
cd mcp-brunella-core

# 2. Install dependencies
npm install

# 3. Login to Cloudflare
wrangler login
# Follow browser auth (Gmail/SSO)

# 4. Configure credentials
# Edit ~/.wrangler/wrangler.toml or export CLOUDFLARE_API_TOKEN

# 5. Verify access
wrangler status
wrangler d1 list
```

### Dashboards & Portals

| Service | URL | Credentials |
|---------|-----|-------------|
| Cloudflare Dashboard | https://dash.cloudflare.com | SSO (Gmail) |
| Grafana | https://grafana.example.com | LDAP / OAuth |
| Prometheus | http://prometheus:9090 | No auth (internal) |
| GitHub | https://github.com/pohi99999/mcp-brunella-core | GitHub account |
| PagerDuty | https://pagerduty.example.com | SAML / Email |

---

## Common Tasks

### Task 1: Check System Status

```bash
# 1. Health endpoint
curl https://cean-orchestrator.{account}.workers.dev/health

# 2. Metrics
curl https://cean-orchestrator.{account}.workers.dev/metrics

# 3. Grafana dashboard
open https://grafana.example.com/d/cean-dashboard

# 4. Check for alerts
# Grafana → Alerting → Alerts (top menu)
```

**Expected Output:**
- Health: `{ status: "healthy", tasks_total: 1234 }`
- Metrics: Prometheus format with all metrics populated
- Dashboard: All panels showing data (no "No data" messages)
- Alerts: No red/critical alerts

### Task 2: Investigate a Failed Pipeline

```bash
# 1. Find the task ID from error message/logs
# Example: "task_abc123xyz"

# 2. Query D1 database
wrangler d1 execute bas-metadata --command "
  SELECT * FROM edge_tasks WHERE id = 'task_abc123xyz';
"

# 3. Check for result data
wrangler d1 execute bas-metadata --command "
  SELECT * FROM edge_results WHERE task_id = 'task_abc123xyz';
"

# 4. Check for execution log
wrangler d1 execute bas-metadata --command "
  SELECT * FROM edge_executions WHERE task_id = 'task_abc123xyz';
"

# 5. If needed, check agent logs
wrangler tail --config myai/agents/workers/research-agent/wrangler.toml
```

### Task 3: Deploy a Worker

```bash
# 1. Make code changes
# Edit myai/agents/workers/orchestrator/src/index.ts

# 2. Build
npm run build

# 3. Test locally (if applicable)
npm test

# 4. Deploy to staging (safe testing environment)
wrangler deploy --env staging --config myai/agents/workers/orchestrator/wrangler.toml

# 5. Verify staging
curl https://cean-orchestrator-staging.workers.dev/health

# 6. Deploy to production
wrangler deploy --env production --config myai/agents/workers/orchestrator/wrangler.toml

# 7. Monitor for errors
wrangler tail --env production --format json | grep -i error
```

### Task 4: Respond to High Latency Alert

```bash
# 1. Read alert: CEANHighLatencyP95
# https://grafana.example.com/d/cean-dashboard → Look for red panels

# 2. Get current metrics
curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json | jq '.metrics.latency'
# Example: { "avg_ms": 450, "p95_ms": 1200 }

# 3. Identify slow agent
wrangler d1 execute bas-metadata --command "
  SELECT agent_type, AVG(latency_ms) as avg_latency
  FROM edge_tasks
  WHERE created_at >= datetime('now', '-5 minutes')
  GROUP BY agent_type
  ORDER BY avg_latency DESC;
"

# 4. Check which agent is slow
curl https://research-agent.{account}.workers.dev/health
curl https://grant-monitor.{account}.workers.dev/health

# 5. If timeout: re-deploy the agent
wrangler deploy --env production --config myai/agents/workers/research-agent/wrangler.toml

# 6. Monitor recovery
watch -n 5 'curl https://cean-orchestrator.{account}.workers.dev/metrics?format=json | jq ".metrics.latency.p95_ms"'
# Should return to < 1000ms within 5 minutes
```

---

## Q&A

### Q: How do I know if CEAN is working?
A: Check `/health` endpoint returns 200 OK and success rate > 95% in Grafana.

### Q: How do I deploy code safely?
A: Always deploy to staging first, verify it works, then deploy to production during business hours.

### Q: What should I do if an alert fires?
A: Follow the runbook in `/docs/CEAN_ALERTING_RUNBOOK.md` for your specific alert.

### Q: How do I fix a broken deployment?
A: Use `git revert` to rollback the code, rebuild, and redeploy.

### Q: Where can I ask questions?
A: Slack channel `#dev-alerts` or ask your manager/mentor.

### Q: How long does a deployment take?
A: 2-5 minutes (build 1 min, deploy 1 min, propagate 1-3 min globally).

### Q: What's the difference between staging and production?
A: Staging = test environment (safe to break), Production = customer-facing (must be stable).

### Q: How do I monitor the system 24/7?
A: Alerts are automated. Check Slack `#dev-alerts` for notifications. On-call engineer handles critical issues.

### Q: How much does CEAN cost to run?
A: ~$10-15 USD/month (based on Phase 4.2 analysis).

### Q: Can I scale CEAN if needed?
A: Yes, Cloudflare Workers auto-scales. If D1 becomes bottleneck, upgrade Cloudflare plan.

### Q: How do I contribute to improving CEAN?
A: Submit PRs with improvements, document learnings, optimize queries, improve monitoring.

---

## Next Steps

1. **Complete Day 1 & 2 training** ✅
2. **Shadow on-call engineer** (2-3 shifts)
3. **Be primary on-call** (low-traffic hours, 2-4 AM)
4. **Handle first incident** (respond to alert, document)
5. **Deploy a change to production** (code + monitoring setup)
6. **Optimize something** (query, cache, alert threshold)
7. **Mentor next person** (pass knowledge forward)

---

## Resources

### Documentation
- [Production Runbook](../CEAN_PRODUCTION_RUNBOOK.md)
- [Alerting Guide](../CEAN_ALERTING_RUNBOOK.md)
- [Troubleshooting Guide](../CEAN_TROUBLESHOOTING_GUIDE.md)
- [Cost Analysis](../CEAN_COST_OPTIMIZATION.md) (Phase 4.2)
- [Infrastructure](../CEAN_INFRASTRUCTURE_SNAPSHOT.md)

### External Learning
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [D1 Database Guide](https://developers.cloudflare.com/d1/)
- [Prometheus Setup](https://prometheus.io/docs/prometheus/latest/getting_started/)
- [Grafana Basics](https://grafana.com/docs/grafana/latest/)

### Internal Contacts
- **Manager/Tech Lead:** @tech-lead
- **DevOps Lead:** @devops-lead
- **On-Call Engineer:** PagerDuty (rotates weekly)
- **Slack:** #dev-alerts (all alerts), #dev-infrastructure (team chat)

---

## Feedback

How can we improve this training guide?

- Found a gap? → Document it and submit PR
- Spent too long on something? → Let us know, we'll clarify
- Learned something cool? → Share in #dev-infrastructure Slack

**Welcome to the team! 🎉**

---

**Last Reviewed:** 2026-02-18  
**Maintained By:** DevOps Team
