# CEAN API Key Setup Guide

**Purpose:** Configure API key authentication for all CEAN workers  
**Phase:** 6.3 - Security Audit (Critical Fix)  
**Status:** Required for Production Go-Live  

---

## 🔑 What is CEAN_API_KEY?

The `CEAN_API_KEY` is a secret token used to authenticate requests to all CEAN worker endpoints (except `/health` and `/metrics`).

**Why It's Required:**
- Prevents unauthorized access to task scheduling, data queries, and load testing endpoints
- Protects production infrastructure from malicious actors
- Enables audit trails (track which API key was used)

---

## 📝 Setting Up API Key

### Method 1: Cloudflare Dashboard (Recommended)

1. **Open Cloudflare Dashboard:**
   - Navigate to: https://dash.cloudflare.com/
   - Select your account: `dd107933ac970dac857f27cee7a7ff46`

2. **Go to Workers & Pages:**
   - Click "Workers & Pages" in the left sidebar

3. **Select Worker:**
   - Click `cean-orchestrator`

4. **Add Environment Variable:**
   - Go to "Settings" tab
   - Scroll to "Environment Variables"
   - Click "Add variable"
   - Name: `CEAN_API_KEY`
   - Value: `<your-secure-api-key>` (see generation below)
   - Type: **Secret** (encrypted)
   - Environment: **Production** (and **Staging** if applicable)
   - Click "Save"

5. **Redeploy Worker:**
   ```bash
   cd myai/agents /workers/orchestrator
   npx wrangler deploy --env production
   ```

---

### Method 2: Wrangler CLI (Alternative)

```bash
cd myai/agents/workers/orchestrator

# Set API key for production
npx wrangler secret put CEAN_API_KEY --env production
# Prompt:  Enter a secret value: <paste your API key>
# Output: ✅ Creating the secret for the Worker "cean-orchestrator"

# Set API key for staging (optional)
npx wrangler secret put CEAN_API_KEY --env staging
```

---

## 🛡️ Generating a Secure API Key

**Option 1: OpenSSL (Linux/Mac/WSL):**
```bash
openssl rand -hex 32
# Output: a1b2c3d4e5f6... (64 characters)
```

**Option 2: Node.js:**
```javascript
require('crypto').randomBytes(32).toString('hex');
// Output: a1b2c3d4e5f6... (64 characters)
```

**Option 3: PowerShell (Windows):**
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
# Output: aB3fG9... (32 characters)
```

**Option 4: Manual (Not Recommended):**
- Use a password manager (1Password, Bitwarden, LastPass)
- Generate 32+ character random string
- **DO NOT** use weak keys like `password123` or `cean-api-key`

**Recommended Key Format:**
- Length: 32-64 characters
- Characters: `a-z`, `A-Z`, `0-9` (hex or alphanumeric)
- Example: `7f3e9a2b5c8d1f4e6a9c0b2d5e8f1a3c4b7e0d92`

---

## 🧪 Testing API Key Authentication

### Test 1: Endpoint Without API Key (Should Fail)

```bash
curl -X POST https://cean-orchestrator.iam-dd1.workers.dev/schedule/research \
  -H "Content-Type: application/json" \
  -d '{"query": "test"}'

# Expected Response (401 Unauthorized):
{
  "status": "error",
  "error": "Unauthorized",
  "message": "Missing X-CEAN-API-Key header",
  "hint": "Include X-CEAN-API-Key header with your request"
}
```

### Test 2: Endpoint With Invalid API Key (Should Fail)

```bash
curl -X POST https://cean-orchestrator.iam-dd1.workers.dev/schedule/research \
  -H "Content-Type: application/json" \
  -H "X-CEAN-API-Key: wrong-api-key" \
  -d '{"query": "test"}'

# Expected Response (401 Unauthorized):
{
  "status": "error",
  "error": "Unauthorized",
  "message": "Invalid API key"
}
```

### Test 3: Endpoint With Valid API Key (Should Succeed)

```bash
curl -X POST https://cean-orchestrator.iam-dd1.workers.dev/schedule/research \
  -H "Content-Type: application/json" \
  -H "X-CEAN-API-Key: 7f3e9a2b5c8d1f4e6a9c0b2d5e8f1a3c4b7e0d92" \
  -d '{"query": "test"}'

# Expected Response (200 OK):
{
  "status": "success",
  "task_id": "task_1708284000_abc123",
  "message": "Task scheduled successfully"
}
```

### Test 4: Public Endpoint (No API Key Required)

```bash
curl https://cean-orchestrator.iam-dd1.workers.dev/health

# Expected Response (200 OK):
{
  "status": "healthy",
  "worker": "cean-orchestrator",
  "timestamp": "2026-02-18T22:30:00.000Z",
  "tasks_total": 15234
}
```

---

## 📋 Checklist for All Workers

The following workers require `CEAN_API_KEY` configuration:

- [ ] **research-agent** - `wrangler secret put CEAN_API_KEY --env production`
- [ ] **orchestrator** - `wrangler secret put CEAN_API_KEY --env production`
- [ ] **grant-monitor** - `wrangler secret put CEAN_API_KEY --env production`
- [ ] **harvest-agent** - `wrangler secret put CEAN_API_KEY --env production`
- [ ] **extract-agent** - `wrangler secret put CEAN_API_KEY --env production`
- [ ] **builder-agent** - `wrangler secret put CEAN_API_KEY --env production`

**Note:** Use the **same API key** for all workers to allow inter-worker communication.

---

## 🔄 Key Rotation Policy

**Recommendation:** Rotate API keys every 90 days for security best practices.

**Rotation Procedure:**
1. Generate new API key (see generation section above)
2. Add new key to Cloudflare dashboard as `CEAN_API_KEY_V2`
3. Update worker code to accept both `CEAN_API_KEY` and `CEAN_API_KEY_V2`
4. Update all clients to use new key
5. After 7 days, remove old `CEAN_API_KEY`
6. Rename `CEAN_API_KEY_V2` to `CEAN_API_KEY`

**Next Rotation:** 2026-05-18 (90 days from Phase 6 launch)

---

## 🚨 API Key Security Best Practices

### DO ✅
- Generate keys with high entropy (32+ characters)
- Store keys as Cloudflare Secrets (encrypted)
- Rotate keys every 90 days
- Use different keys for production vs. staging
- Audit logs for unauthorized access attempts

### DON'T ❌
- Hardcode keys in source code
- Commit keys to Git
- Use weak keys like `password`, `admin`, `12345`
- Share keys via email or Slack
- Store keys in browser localStorage

### Key Storage Recommendations:
- **Production:** Cloudflare Dashboard (encrypted secrets)
- **Local Development:** `.env` file (gitignored)
- **CI/CD:** GitHub Actions secrets (`CEAN_API_KEY_PRODUCTION`)
- **Team Access:** Password manager (1Password, Bitwarden)

---

## 📞 Support

If you encounter issues with API key authentication:

1. **Check Cloudflare Logs:**
   - Dashboard → Workers & Pages → cean-orchestrator → Logs
   - Look for `Unauthorized` entries

2. **Verify Key is Set:**
   ```bash
   npx wrangler secret list --env production
   # Should show: CEAN_API_KEY (secret)
   ```

3. **Test with curl:**
   - See "Testing API Key Authentication" section above

4. **Contact:**
   - GitHub Issues: https://github.com/pohi99999/mcp-brunella-core/issues
   - Email: pohi99999@gmail.com

---

**Generated:** 2026-02-18 22:30 UTC  
**Author:** Brunella DevOps + GitHub Copilot  
**Phase:** 6.3 - Security Audit (API Key Setup)

