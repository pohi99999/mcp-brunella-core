# CEAN Phase 2A: D1 Database Setup Guide

**Status:** In Progress  
**Date:** 2026-02-18  
**Phase:** 2A - D1 Database Integration  
**Worker:** `cean-test` (deployed at Phase 2A)

---

## Overview

Phase 2A enables the CEAN Test Worker to test D1 (SQLite) database connectivity. The worker is now deployed with support for:
- ✅ D1 health checks
- ✅ D1 table creation
- ✅ D1 data insertion and querying
- ⏳ D1 binding (manual setup required)

**Current Status:** Worker deployed ✅ | D1 binding ⏳

---

## Current Endpoint Status

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/health` | GET | ✅ | Returns `degraded` (D1 not bound) |
| `/hello` | GET | ✅ | Simple hello world + endpoint list |
| `/test/d1` | POST | ✅ | D1 connectivity test (returns setup instructions) |
| `/test/metrics` | GET | ✅ | Phase 2A status + setup next steps |

---

## Manual D1 Setup Process

### Step 1: Create D1 Database in Cloudflare Dashboard

1. **Go to Cloudflare Dashboard**
   - URL: https://dash.cloudflare.com/
   - Login with your Cloudflare account

2. **Navigate to Workers → D1**
   - Left sidebar → Workers & Pages
   - Scroll down to D1 → Click "D1 SQL Database"

3. **Create Database**
   - Click **"Create Database"** button
   - **Name:** `bas-metadata`
   - **Location:** Default (or select preferred region)
   - Click **"Create"**

4. **Copy Database ID**
   - After creation, you'll see the database details
   - Look for **"Database ID"** (format: `d1_xxxxxxxxxxxxxxxxxxxxx`)
   - **Copy this ID** (you'll need it for wrangler.toml)

---

### Step 2: Update wrangler.toml

Edit `myai/agents/workers/cean-test/wrangler.toml`:

```toml
name = "cean-test"
type = "javascript"
account_id = "YOUR_ACCOUNT_ID"
workers_dev = true
routes = []

[env.production]
routes = []

# D1 Database Binding (NEW in Phase 2A)
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "d1_YOUR_DATABASE_ID_HERE"  # ⚠️ REPLACE WITH YOUR DATABASE ID
```

**Important:** Replace `d1_YOUR_DATABASE_ID_HERE` with the actual Database ID from Step 1.

---

### Step 3: Deploy Updated Worker

```bash
# From project root
cd myai/agents/workers/cean-test

# Build
npm run build

# Deploy with D1 binding
wrangler deploy --env production
```

**Expected output:**
```
✅ Deployed cean-test triggers
https://cean-test.{account}.workers.dev
```

---

### Step 4: Test D1 Connectivity

Once deployed, test the D1 binding:

```bash
# Test D1 connectivity
curl -X POST https://cean-test.{account}.workers.dev/test/d1 \
  -H "Content-Type: application/json" \
  -d '{"action":"check"}'
```

**Expected response (if D1 bound successfully):**
```json
{
  "success": true,
  "test": "basic_connectivity",
  "result": { "ok": 1 },
  "duration_ms": 15,
  "message": "✅ D1 database is responsive"
}
```

**If D1 not bound:**
```json
{
  "success": false,
  "error": "D1 database not bound",
  "message": "To enable D1 testing: ...",
  "instructions": [...]
}
```

---

### Step 5: Test D1 Operations

Once D1 is bound, you can test:

**Create Table:**
```bash
curl -X POST https://cean-test.{account}.workers.dev/test/d1 \
  -H "Content-Type: application/json" \
  -d '{"action":"create_table","table":"test_table"}'
```

**Insert Data:**
```bash
curl -X POST https://cean-test.{account}.workers.dev/test/d1 \
  -H "Content-Type: application/json" \
  -d '{"action":"insert","table":"test_table","data":{"message":"Hello D1!"}}'
```

**Query Data:**
```bash
curl -X POST https://cean-test.{account}.workers.dev/test/d1 \
  -H "Content-Type: application/json" \
  -d '{"action":"query"}'
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "D1 database not found" | Verify Database ID in wrangler.toml matches Cloudflare Dashboard |
| "Database ID is invalid" | Check format is `d1_xxxxx...` and copy-paste from Dashboard |
| "Unauthorized" | Ensure Cloudflare API token has D1 permissions in `.env` |
| "504 Timeout" | D1 may be initializing; wait a few seconds and retry |

---

## Next Steps (Phase 2B+)

- [ ] Phase 2B: Implement Research Agent Worker
- [ ] Phase 2C: Implement Grant Monitor Worker  
- [ ] Phase 2D: Implement Data Harvester Worker
- [ ] Phase 3A: Add R1 Vectorize Vector Database

---

## Files Changed

- ✅ `myai/agents/workers/cean-test/worker.ts` - Added `/test/d1` endpoint
- ✅ `myai/agents/workers/cean-test/worker.js` - Built with D1 support
- ⏳ `myai/agents/workers/cean-test/wrangler.toml` - Needs D1 binding update

---

## Live Endpoints

**Test Worker (Phase 2A):**
```
https://cean-test.peterpohankapersonal.workers.dev
```

**Available endpoints:**
- `GET /health` - Health status
- `GET /hello` - Endpoint listing  
- `POST /test/d1` - D1 connectivity test
- `GET /test/metrics` - Phase 2A metrics
