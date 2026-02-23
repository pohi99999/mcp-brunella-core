# CEAN Phase 2A: D1 Database Manual Setup Guide

**Date:** 2026-02-23  
**Status:** ⏸️ Paused - Manual Action Required  
**Assignee:** Pohánka Péter + Claude Code

---

## 🎯 Objective

Create `bas-metadata` D1 database in Cloudflare and configure wrangler binding for the `cean-test` worker.

---

## 📋 Prerequisites

✅ Cloudflare Account: `peterpohankapersonal@gmail.com`  
✅ Account ID: `1bf6118df97f0e12f3592a89d90deb1e`  
✅ D1 Schema Ready: `myai/agents/workers/schema/d1_schema.sql`  
✅ Test Worker Deployed: `cean-test` (Phase 1D)

---

## 🛠️ Manual Setup Steps

### Step 1: Create D1 Database (Cloudflare Dashboard)

**Direct Link:** [Cloudflare D1 Dashboard](https://dash.cloudflare.com/1bf6118df97f0e12f3592a89d90deb1e/workers/d1)

1. Click **"Create"** button
2. **Database Name:** `bas-metadata`
3. **Location:** Automatic (defaults to optimal region)
4. Click **"Create"**
5. **Copy the Database ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

**Expected Output:**
```
Database Name: bas-metadata
Database ID: [COPY THIS - will look like: 5a1f2b3c-4d5e-6f7g-8h9i-0j1k2l3m4n5o]
Status: Created
```

---

### Step 2: Apply D1 Schema

Once the database is created, run this command to apply the schema:

```powershell
# Navigate to project root
cd f:\mcp-brunella-core

# Set database ID (replace with actual ID from Step 1)
$DB_ID = "YOUR_DATABASE_ID_HERE"

# Apply schema
wrangler d1 execute bas-metadata --file=myai/agents/workers/schema/d1_schema.sql --remote
```

**Expected Output:**
```
🌀 Executing on remote database bas-metadata (YOUR_DATABASE_ID_HERE):
🌀 Uploading myai/agents/workers/schema/d1_schema.sql
🚣 Executed 12 commands in X.XXXms
✅ Schema applied successfully
```

---

### Step 3: Update wrangler.toml Binding

**File:** `myai/agents/workers/cean-test/wrangler.toml`

Add the D1 binding:

```toml
name = "cean-test"
main = "dist/worker.js"
compatibility_date = "2024-12-01"
workers_dev = true

# D1 Database Binding (PHASE 2A)
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "YOUR_DATABASE_ID_HERE"  # Replace with actual ID from Step 1
```

**⚠️ Important:** Replace `YOUR_DATABASE_ID_HERE` with the actual Database ID copied in Step 1.

---

### Step 4: Redeploy Worker

After updating `wrangler.toml`, redeploy the worker:

```powershell
cd myai/agents/workers/cean-test
npm run build
wrangler deploy --env production
```

**Expected Output:**
```
✨ Built successfully
⛅️ wrangler 4.66.0
───────────────────
Total Upload: X.XX KiB / gzip: X.XX KiB
Uploaded cean-test (X.XX sec)
Deployed cean-test triggers (X.XX sec)
  https://cean-test.peterpohankapersonal.workers.dev
Current Version ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
✅ Redeployment successful
```

---

### Step 5: Verify D1 Connectivity

Test the D1 endpoint:

```powershell
# Test D1 write
curl -X POST https://cean-test.peterpohankapersonal.workers.dev/test/d1 `
  -H "Content-Type: application/json" `
  -d '{"test_id": "cean-test-1", "data": "Hello D1!"}'

# Expected Response:
# {
#   "success": true,
#   "message": "D1 connectivity test passed",
#   "test_id": "cean-test-1",
#   "rows_inserted": 1,
#   "database": "bas-metadata"
# }

# Test D1 read
curl https://cean-test.peterpohankapersonal.workers.dev/test/d1/read

# Expected Response:
# {
#   "success": true,
#   "message": "D1 read test passed",
#   "total_rows": 1,
#   "sample_rows": [...]
# }
```

---

## 📊 Validation Checklist

After completing all steps, verify:

- [ ] D1 database `bas-metadata` exists in Cloudflare Dashboard
- [ ] Database ID copied to `wrangler.toml`
- [ ] Schema applied successfully (12 tables created)
- [ ] Worker redeployed with D1 binding
- [ ] `POST /test/d1` endpoint returns `success: true`
- [ ] `GET /test/d1/read` endpoint returns test data
- [ ] No errors in Cloudflare Workers logs

---

## 🔍 Troubleshooting

### Issue: "Database not found"
**Solution:** Verify the Database ID in `wrangler.toml` matches the ID from Step 1.

### Issue: "Authentication error"
**Solution:** 
1. Check `.env` file has `CLOUDFLARE_API_TOKEN`
2. Verify token permissions at: https://dash.cloudflare.com/profile/api-tokens
3. Required permissions: `D1:Edit`, `Workers:Edit`

### Issue: "Schema apply failed"
**Solution:** 
1. Check SQL syntax in `d1_schema.sql`
2. Try applying schema manually via Cloudflare Dashboard → D1 → Query Console

### Issue: "Worker deployment failed"
**Solution:**
1. Run `npm run build` first
2. Check `wrangler.toml` syntax (valid TOML)
3. Verify all required files exist in `dist/`

---

## 📁 Related Files

**Schema:**
- `myai/agents/workers/schema/d1_schema.sql` - 12 tables (edge_tasks, edge_executions, etc.)

**Worker:**
- `myai/agents/workers/cean-test/wrangler.toml` - Worker configuration
- `myai/agents/workers/cean-test/worker.ts` - D1 test endpoints
- `myai/agents/workers/cean-test/package.json` - Dependencies

**Documentation:**
- `docs/CEAN_STATUS_REPORT.md` - Overall CEAN progress
- `docs/CEAN_PHASE_2A_D1_SETUP.md` - Technical details
- `docs/CEAN_D1_SETUP_INTERACTIVE.md` - User guide

---

## ✅ Completion Criteria

Phase 2A is **COMPLETE** when:

1. ✅ D1 database `bas-metadata` created
2. ✅ Schema applied (12 tables)
3. ✅ `wrangler.toml` updated with database_id
4. ✅ Worker redeployed successfully
5. ✅ Both D1 test endpoints working
6. ✅ Documentation updated

---

## 🚀 Next Steps (Phase 2B)

After Phase 2A completion:

- **Phase 2B:** Research Agent Worker implementation
- **Phase 2C:** Grant Watcher Agent deployment
- **Phase 3A:** R1 Vectorize integration

---

## 📞 Support

If stuck, check:
1. Cloudflare D1 Documentation: https://developers.cloudflare.com/d1/
2. Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/
3. CEAN Track Spec: `conductor/tracks/archive/cloudflare_edge_agents_network_20260215/spec.md`

---

**Status:** ⏸️ Awaiting manual D1 database creation (Step 1)  
**Estimated Time:** 5-10 minutes (manual) + 5 minutes (automation)  
**Total Phase 2A Duration:** ~15-20 minutes
