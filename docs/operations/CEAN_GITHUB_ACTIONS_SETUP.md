# GitHub Actions Secrets Setup - CEAN CI/CD

**File:** `.github/workflows/deploy-edge-agents.yml`  
**Status:** ✅ Created  
**Purpose:** Automate Cloudflare Workers deployment on push to main branch

---

## 🔐 Required GitHub Secrets

Add these to your GitHub repository settings (`Settings → Secrets and variables → Actions`):

### 1. CLOUDFLARE_API_TOKEN
- **Type:** Repository Secret
- **Description:** Cloudflare API Token for authentication
- **How to create:**
  ```
  1. Go to https://dash.cloudflare.com/profile/api-tokens
  2. Create Token → "Edit Cloudflare Workers" (template)
  3. Permissions:
     - Account → Cloudflare Workers Scripts (Edit)
     - Account → Cloudflare Workers KV (Edit)
     - Account → Cloudflare Workers R1 (Edit)
     - Account → Cloudflare Workers D1 (Edit)
  4. Copy token → Paste into GitHub Secrets as CLOUDFLARE_API_TOKEN
  ```
- **Example value:** `v1.0abcdef1234567890...` (keep secret!)

### 2. CLOUDFLARE_ACCOUNT_ID
- **Type:** Repository Secret
- **Description:** Cloudflare Account ID
- **How to find:**
  ```
  1. Run: wrangler whoami
  2. Copy Account ID from output
  ```
- **Example value:** `abc123def456ghi789jkl012`

---

## 🚀 Workflow Behavior

### **On Pull Request:**
1. ✅ Checks out code
2. ✅ Installs dependencies
3. ✅ Builds main project (npm run build)
4. ✅ Runs test suite (npm test)
5. ✅ Validates worker build (wrangler build)
6. ✅ Dry-run deploy (wrangler deploy --dry-run) ← No actual deployment
7. ✅ Reports status

### **On Push to main:**
1. ✅ All PR checks above
2. ✅ **Actually deploys worker** (wrangler deploy)
3. ✅ Waits 30 seconds for propagation
4. ✅ Health check: GET /health endpoint
5. ✅ Creates GitHub deployment annotation

---

## 📋 Workflow Jobs

| Job | Trigger | Purpose |
|-----|---------|---------|
| **build** | PR only | Validate code (dry-run) |
| **deploy** | Push to main | Deploy to Cloudflare |
| **verify** | After deploy | Health check |
| **notify** | Always | Report results |

---

## 🔗 Deployment Endpoints

Once deployed, workers will be accessible at:

```
https://cean-test.YOUR_ACCOUNT_ID.workers.dev

Endpoints:
  GET  /health       → System health status
  POST /test/d1      → D1 connectivity test
  POST /test/r1      → R1 binding test
  GET  /test/metrics → Test metrics
```

---

## 🧪 Testing the Workflow

### Step 1: Set up secrets
```bash
# In GitHub UI: Settings → Secrets and variables → Actions
# Add CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID
```

### Step 2: Create a test PR
```bash
git checkout -b test/ci-setup
echo "# CI/CD test" >> README.md
git add README.md
git commit -m "test: verify CI/CD workflow"
git push -u origin test/ci-setup
```

### Step 3: Open PR and watch workflow
- Go to GitHub → Actions tab
- Click latest "🌐 CEAN - Deploy Edge Agents Network" run
- Watch logs as workflow executes

### Step 4: Merge to main
```bash
# After PR is approved and checks pass
git checkout main
git merge test/ci-setup
git push origin main
```

Result: Worker automatically deployed to Cloudflare! ✅

---

## 🐛 Troubleshooting

| Error | Solution |
|-------|----------|
| "Invalid token" | Check CLOUDFLARE_API_TOKEN in secrets |
| "Account not found" | Verify CLOUDFLARE_ACCOUNT_ID is correct |
| "Worker deploy failed" | Check worker's wrangler.toml is valid |
| "Health check timeout" | Wait 30s after merge, then manually test endpoint |

---

## 📊 Monitoring

View deployment status:
- **GitHub:** Actions tab → Latest run
- **Cloudflare:** https://dash.cloudflare.com → Workers
- **Project:** `conductor/tracks.md` → CEAN Phase 1C status

---

## 🔄 Next Steps

1. ✅ Workflow created
2. ⏭️ Add secrets to GitHub
3. ⏭️ Test with a PR
4. ⏭️ Merge to main → automatic deploy
5. ⏭️ Monitor health endpoint
6. ⏭️ Proceed to Phase 2: Individual Agent Workers
