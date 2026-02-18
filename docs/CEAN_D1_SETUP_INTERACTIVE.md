# CEAN Phase 2A: D1 Database Interactive Setup Guide

> **Status:** Step-by-step manual setup for D1 "bas-metadata" database binding  
> **Date:** 2026-02-18  
> **Estimated Time:** 5-10 minutes  

---

## 📋 Checklist (Begin Here)

Before starting, make sure you have:

- [ ] Cloudflare account access (https://dash.cloudflare.com/)
- [ ] Cloudflare API token in `.env` file (`CLOUDFLARE_API_TOKEN`)
- [ ] Account ID in `.env` file (`CLOUDFLARE_ACCOUNT_ID`)
- [ ] Wrangler CLI installed (`wrangler --version`)
- [ ] Project cloned: `f:\mcp-brunella-core`

---

## 🚀 Step 1: Access Cloudflare Dashboard

**[ACTION]** Open your browser and go to:
```
https://dash.cloudflare.com/
```

**What to do:**
1. Click **"Log In"** (top-right)
2. Enter your Cloudflare email and password
3. Complete MFA if prompted
4. You should see the Cloudflare Dashboard main page

---

## 🔍 Step 2: Navigate to D1 Section

**[ACTION]** Once logged in:

1. In the left sidebar, find **Workers & Pages**
2. Click **"Workers & Pages"** to expand
3. Look for **"D1"** option in the submenu
4. Click **"D1"** to open the D1 SQL Database manager

**Visual Guide:**
```
Cloudflare Dashboard
├── Left Sidebar
│   ├── Websites
│   ├── Workers & Pages  ← Click here
│   │   ├── Overview
│   │   ├── Services
│   │   ├── D1  ← Then click here
│   │   └── ...
```

---

## ✨ Step 3: Create New D1 Database

**[ACTION]** In the D1 section:

1. Click **"Create Database"** button (blue button, top-right)
2. A form will appear:
   - **Database Name:** Enter exactly `bas-metadata`
   - **Location:** Leave as "Default" (or pick your region)
   - Click **"Create"**

3. The database will be created (~10-30 seconds)
4. You'll be redirected to the database details page

---

## 🔐 Step 4: Copy Database ID

**[ACTION]** On the database details page:

1. Look for the **"Database ID"** field
2. It will look like: `d1_3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p`
3. **Click the copy icon** next to it (small clipboard icon)
4. Paste it somewhere safe (Notepad, or save for next step)

**What you need to copy:**
```
d1_3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p
```

---

## ⚙️ Step 5: Update wrangler.toml

**[ACTION]** In your local project:

1. Open file: `myai/agents/workers/cean-test/wrangler.toml`
2. Find section: `[env.production]`
3. Below that, add the D1 binding:

```toml
[env.production]
routes = []

# D1 Database Binding (Phase 2A)
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "YOUR_DATABASE_ID_HERE"
```

4. **Replace** `YOUR_DATABASE_ID_HERE` with the actual ID you copied in Step 4
5. **Example:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "bas-metadata"
database_id = "d1_3a4b5c6d7e8f9g0h1i2j3k4l5m6n7o8p"
```

6. **Save the file** (Ctrl+S)

---

## 🏗️ Step 6: Build and Deploy

**[ACTION]** In PowerShell/Terminal:

```powershell
# Navigate to worker directory
cd f:\mcp-brunella-core\myai\agents\workers\cean-test

# Build
npm run build

# Expected output:
# ✅ dist\worker.js  8.6kb

# Deploy to production
wrangler deploy --env production

# Expected output:
# ✅ Deployed cean-test triggers
# https://cean-test.{account}.workers.dev
```

---

## ✅ Step 7: Test D1 Connectivity

**[ACTION]** Run the test command:

### Option A: PowerShell

```powershell
$uri = "https://cean-test.peterpohankapersonal.workers.dev"
$body = @{ action = "check" } | ConvertTo-Json

$response = Invoke-WebRequest -Uri "$uri/test/d1" `
  -Method POST `
  -Body $body `
  -ContentType "application/json" `
  -ErrorAction SilentlyContinue

$response.Content | ConvertFrom-Json | Format-List
```

### Option B: cURL

```bash
curl -X POST https://cean-test.peterpohankapersonal.workers.dev/test/d1 \
  -H "Content-Type: application/json" \
  -d '{"action":"check"}'
```

### Option C: Manual Browser

Open in browser:
```
(Can't POST via browser directly - use PowerShell or cURL)
```

---

## 🎉 Step 8: Verify Success

**Success Response:**
```json
{
  "success": true,
  "test": "basic_connectivity",
  "result": { "ok": 1 },
  "duration_ms": 15,
  "message": "✅ D1 database is responsive"
}
```

**Failure Response (D1 Not Bound):**
```json
{
  "success": false,
  "error": "D1 database not bound",
  "instructions": [...]
}
```

---

## 🧪 Optional: Test D1 Operations

Once D1 is bound, you can test:

### Create Table
```powershell
$body = @{ 
  action = "create_table"
  table = "test_table" 
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://cean-test.peterpohankapersonal.workers.dev/test/d1" `
  -Method POST -Body $body -ContentType "application/json" | Select-Object Content
```

### Insert Data
```powershell
$body = @{ 
  action = "insert"
  table = "test_table"
  data = @{ message = "Hello D1!" }
} | ConvertTo-Json

Invoke-WebRequest -Uri "https://cean-test.peterpohankapersonal.workers.dev/test/d1" `
  -Method POST -Body $body -ContentType "application/json" | Select-Object Content
```

---

## 🚨 Troubleshooting

| Error | Cause | Solution |
|-------|-------|----------|
| "D1 database not bound" | wrangler.toml not updated | Verify Database ID matches Cloudflare Dashboard |
| "Database ID invalid" | Wrong format copied | Ensure ID starts with `d1_` |
| "Unauthorized" | Invalid API token | Check `.env` file for `CLOUDFLARE_API_TOKEN` |
| "504 Timeout" | D1 initializing | Wait 30 seconds and retry |
| "Deployment failed" | wrangler.toml syntax | Validate TOML syntax (colons in right places) |

---

## ✅ Completion Checklist

Once complete, mark these as done:

- [ ] D1 database "bas-metadata" created in Cloudflare Dashboard
- [ ] Database ID copied
- [ ] wrangler.toml updated with D1 binding
- [ ] Worker rebuilt (`npm run build`)
- [ ] Worker redeployed (`wrangler deploy --env production`)
- [ ] `/test/d1` endpoint tested and returns `success: true`
- [ ] Table creation test passed
- [ ] Data insertion test passed

**When all ✅** → Phase 2A is COMPLETE!

---

## 📝 Next Phase (2B)

After D1 setup is complete, we'll implement:
- **Phase 2B:** Research Agent Worker
- **Phase 2C:** Grant Monitor Worker
- **Phase 2D:** Data Harvester Worker

Stay tuned! 🚀
