# CEAN Phase 1D: Test Worker Deployment & Verification

**Track ID:** `cloudflare_edge_agents_network_20260215`  
**Phase:** 1D (Test Deployment)  
**Status:** Planning  
**Estimated Duration:** 2-3 hours  
**Assignee:** Claude Code  

---

## 🎯 Objectives

Phase 1D focuses on **deploying the test worker to live Cloudflare infrastructure** and verifying all endpoints work correctly.

### Deliverables:
- ✅ Test worker deployed to Cloudflare (production environment)
- ✅ All 4 endpoints tested and verified
- ✅ Health check passing continuously
- ✅ Database connectivity confirmed (D1 + R1)
- ✅ GitHub Actions CI/CD operational
- ✅ Updated infrastructure snapshot with live deployment info

---

## 📋 Implementation Plan

### Task 1: GitHub Secrets Setup (15 min)

**Objective:** Configure GitHub repository with required Cloudflare credentials.

**Steps:**
1. Navigate to repository Settings → Secrets and variables → Actions
2. Create secret: `CLOUDFLARE_API_TOKEN`
   - Value: Your Cloudflare API token (from dash.cloudflare.com/profile/api-tokens)
   - Permissions required:
     - Account → Cloudflare Workers Scripts (Edit)
     - Account → Cloudflare Workers KV (Edit)
     - Account → Cloudflare Workers R1 (Edit) ← NEW
     - Account → Cloudflare Workers D1 (Edit)
3. Create secret: `CLOUDFLARE_ACCOUNT_ID`
   - Value: Your account ID (from `wrangler whoami`)
4. Verify both secrets appear in Actions secrets list

**Validation:**
```bash
# Verify locally (will use secrets from .env or CLI auth)
wrangler whoami  # Should show account ID and email
```

**Deliverable:** GitHub Actions can now authenticate with Cloudflare

---

### Task 2: Create Test Deployment (20 min)

**Objective:** Trigger the CI/CD pipeline to deploy test worker.

**Steps:**
1. Create a new test branch:
   ```bash
   git checkout -b test/deploy-verification
   ```

2. Make a small change to test the workflow:
   ```bash
   echo "# Test deployment" >> docs/CEAN_DEPLOYMENT_TEST.md
   git add docs/CEAN_DEPLOYMENT_TEST.md
   git commit -m "test: trigger CI/CD deployment workflow"
   ```

3. Push the branch and create a PR:
   ```bash
   git push -u origin test/deploy-verification
   # Then create PR on GitHub
   ```

4. Watch the build job (PR validation):
   - ✅ npm install (caching)
   - ✅ npm run build (main project)
   - ✅ npm test (validation)
   - ✅ wrangler deploy --dry-run (config validation)
   - Should complete in ~5 minutes

5. Merge the PR to main:
   ```bash
   # Via GitHub UI, or:
   git checkout main
   git merge test/deploy-verification
   git push origin main
   ```

6. Watch the deploy job (production deployment):
   - ✅ wrangler deploy (actual deployment to Cloudflare)
   - ✅ Should complete in ~2 minutes
   - ✅ Worker URL appears in logs

**Validation:**
```bash
# Check deployment status in GitHub Actions UI
# Actions → Latest run → deploy job → logs
```

**Deliverable:** Test worker deployed to Cloudflare

---

### Task 3: Endpoint Verification (20 min)

**Objective:** Test all 4 worker endpoints to verify connectivity and functionality.

**Endpoints to test:**
1. `/health` - System health status
2. `/test/d1` - D1 database connectivity
3. `/test/r1` - R1 vector store connectivity
4. `/test/metrics` - Test metrics tracker

**Steps:**

#### 3a. Get worker URL
```bash
# From GitHub Actions deploy job logs, or:
wrangler deployments list --name cean-test
# Look for the production deployment URL format:
# https://cean-test.YOUR_ACCOUNT_ID.workers.dev
```

#### 3b. Test /health endpoint
```bash
WORKER_URL="https://cean-test.YOUR_ACCOUNT_ID.workers.dev"

curl -v "${WORKER_URL}/health"
# Expected:
#   HTTP/1.1 200 OK
#   {
#     "status": "healthy",
#     "timestamp": "2026-02-15T...",
#     "version": "1.0.0"
#   }
```

#### 3c. Test /test/d1 endpoint
```bash
curl -v -X POST "${WORKER_URL}/test/d1" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create_table",
    "table": "test_table",
    "columns": {
      "id": "TEXT PRIMARY KEY",
      "name": "TEXT",
      "created_at": "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
    }
  }'

# Expected:
#   HTTP/1.1 200 OK
#   {
#     "success": true,
#     "message": "Table created successfully",
#     "action": "create_table"
#   }
```

#### 3d. Test /test/r1 endpoint
```bash
curl -v -X POST "${WORKER_URL}/test/r1" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "put",
    "key": "test_key",
    "value": {
      "text": "Hello from test worker!",
      "timestamp": "2026-02-15T..."
    }
  }'

# Expected:
#   HTTP/1.1 200 OK
#   {
#     "success": true,
#     "message": "Object stored in R1",
#     "action": "put"
#   }
```

#### 3e. Test /test/metrics endpoint
```bash
curl -v "${WORKER_URL}/test/metrics"
# Expected:
#   HTTP/1.1 200 OK
#   {
#     "total_requests": 4,
#     "successful": 4,
#     "failed": 0,
#     "avg_latency_ms": 145.25
#   }
```

**All tests should pass with 200 OK responses.**

---

### Task 4: Database Connectivity Verification (15 min)

**Objective:** Confirm D1 and R1 data can be accessed from live worker.

**Steps:**

1. Verify D1 access:
   ```bash
   # Via your Cloudflare dashboard:
   # 1. Go to Workers → your-account → D1
   # 2. Click your database → Query console
   # 3. SELECT * FROM cean_workers_status;
   # Should show at least the test worker record
   ```

2. Verify R1 access:
   ```bash
   # Via your Cloudflare dashboard:
   # 1. Go to Workers → your-account → R2
   # 2. Browse your bucket
   # 3. Should see at least one object (from /test/r1)
   ```

3. Optional: Direct database query
   ```bash
   # Deploy a temporary query endpoint in test worker
   # Or use Cloudflare dashboard query console
   ```

**Validation:** Both D1 and R1 show recent test data

---

### Task 5: CI/CD Verification (10 min)

**Objective:** Confirm automated deployment is working end-to-end.

**Steps:**

1. Create another test change:
   ```bash
   git checkout -b test/second-deploy
   echo "# Second test" >> README.md
   git add README.md
   git commit -m "test: verify CI/CD re-deployment"
   git push -u origin test/second-deploy
   # Create PR
   ```

2. Watch build job pass (should take ~5 min)

3. Merge PR to main

4. Watch deploy job:
   - Should see "Worker deployed successfully"
   - Timestamp should be recent (within ~2 minutes of merge)

5. Test health endpoint again:
   ```bash
   curl "${WORKER_URL}/health"
   # Should still return 200 OK (uptime uninterrupted)
   ```

**Validation:** Zero-downtime redeployment confirmed

---

### Task 6: Documentation & Snapshot Update (20 min)

**Objective:** Update infrastructure snapshot with deployment results.

**Steps:**

1. Update `docs/CEAN_INFRASTRUCTURE_SNAPSHOT.md`:
   - Add "Phase 1D: Test Worker Deployment" section
   - Record live worker URL
   - Document endpoint test results
   - Note deployment timestamp and GitHub Actions run ID

2. Create `docs/CEAN_DEPLOYMENT_RESULTS.md`:
   - Deployment summary (timestamp, duration, size)
   - Endpoint test results (latency, status codes)
   - Database connectivity confirmation
   - Health check history

3. Commit changes:
   ```bash
   git add docs/CEAN_*.md
   git commit -m "docs(cean): Phase 1D - Test Worker Deployment Results"
   git push origin main
   ```

**Deliverable:** Updated infrastructure documentation

---

## 📊 Success Criteria

All items must be ✅ for Phase 1D to be considered COMPLETE:

- ✅ GitHub Secrets configured (CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID)
- ✅ Test worker deployed to Cloudflare (cean-test.ACCOUNT_ID.workers.dev)
- ✅ /health endpoint returns 200 OK
- ✅ /test/d1 endpoint works (create, insert, query)
- ✅ /test/r1 endpoint works (put, get operations)
- ✅ D1 database accessible from worker
- ✅ R1 storage accessible from worker
- ✅ GitHub Actions workflow runs successfully on PR and main push
- ✅ Zero-downtime redeployment confirmed
- ✅ Infrastructure documentation updated

---

## 🔗 References

- `.github/workflows/deploy-edge-agents.yml` - CI/CD workflow
- `docs/CEAN_GITHUB_ACTIONS_SETUP.md` - Secrets configuration
- `docs/CEAN_WRANGLER_ENVIRONMENTS.md` - Environment setup
- `myai/agents/workers/cean-test/worker.ts` - Test worker code
- `myai/agents/workers/cean-test/wrangler.toml` - Worker configuration

---

## 🎯 Next Phase

Once Phase 1D is complete:
→ **Phase 2A: Research Agent Worker** - Build first of 5 agent workers
