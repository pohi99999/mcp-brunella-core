# MCP + Bifrost + E2B Deployment Guide

Complete deployment guide for the Brunella MCP integration stack.

---

## Prerequisites

### Required

- **Node.js** 18+ (for backend)
- **Python** 3.11+ (for agents)
- **Ollama** (for local LLM - [install](https://ollama.ai/))
- **Git** (for version control)

### Optional (for full features)

- **E2B API Key** - Secure Python sandboxes ([signup](https://e2b.dev/))
- **Gemini API Key** - Google's Gemini LLM ([get key](https://ai.google.dev/))
- **GitHub PAT** - GitHub Models access ([create token](https://github.com/settings/tokens))
- **Anthropic API Key** - Claude access ([get key](https://console.anthropic.com/))

---

## Installation Steps

### 1. Clone & Install Dependencies

```bash
# Clone repository
git clone https://github.com/pohi99999/mcp-brunella-core.git
cd mcp-brunella-core

# Install Node.js dependencies
npm install

# Install Python dependencies (using uv - recommended)
cd myai
uv sync

# OR using pip
pip install -r requirements.txt
cd ..
```

### 2. Configure Environment Variables

Create `.env` file in project root:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# === REQUIRED ===
# Workspace root (usually current directory)
BRUNELLA_WORKSPACE_ROOT=.

# Ollama (local LLM)
OLLAMA_BASE_URL=http://localhost:11434

# === OPTIONAL (but recommended) ===
# E2B Sandboxes (secure Python execution)
E2B_API_KEY=your-e2b-api-key-here

# Google Gemini (fast general-purpose LLM)
GEMINI_API_KEY=your-gemini-api-key-here

# GitHub Models (GPT-4o access)
GITHUB_PAT=your-github-personal-access-token

# Anthropic Claude (most capable LLM)
ANTHROPIC_API_KEY=your-anthropic-api-key-here

# === Python Backend ===
BRUNELLA_PYTHON_API_URL=http://127.0.0.1:8000
```

**Security:** Never commit `.env` to git!

### 3. Start Ollama

```bash
# Start Ollama server
ollama serve

# In another terminal, pull required model
ollama pull qwen2.5-coder:7b
```

**Verify Ollama:**
```bash
curl http://localhost:11434/api/tags | python -m json.tool
```

### 4. Build Backend

```bash
npm run build
```

**Expected output:**
```
> mcp-brunella-core@1.0.0 build
> tsc

# No errors = success
```

### 5. Start Services

**Terminal 1: Node.js Backend**
```bash
npm run dev
```

**Terminal 2: Python FastAPI (optional, for refiner)**
```bash
cd myai
uvicorn server:app --reload --port 8000
```

**Terminal 3: Dashboard (optional)**
```bash
npm run dev:ui
```

---

## Verification Checklist

### Health Check

```bash
curl http://localhost:3000/api/health | python -m json.tool
```

**Expected response:**
```json
{
  "status": "healthy",
  "ollama": {
    "status": "healthy",
    "models": ["qwen2.5-coder:7b"]
  },
  "cloudflare": {
    "status": "healthy"
  }
}
```

### Test MCP Tools

```bash
# List available tools
curl http://localhost:3000/api/v1/mcp/tools | python -m json.tool

# Test read_file
curl -X POST http://localhost:3000/api/v1/mcp/tools/read_file \
  -H "Content-Type: application/json" \
  -d '{"args": {"path": "README.md"}}' | python -m json.tool
```

**Expected:** `"success": true` with file content

### Test Bifrost Gateway

```bash
# Check provider health
curl http://localhost:3000/api/v1/mcp/providers | python -m json.tool
```

**Expected providers:**
- `ollama`: `"available": true`
- `gemini`: `"available": true` (if key configured)
- `github`: `"available": true` (if PAT configured)
- `anthropic`: `"available": true` (if key configured)

### Test Python MCP Bridge

```bash
cd myai
python tools/mcp_bridge.py
```

**Expected output:**
```
[MCPBridge] Testing Python MCP Bridge...
1. Reading file...
   ✅ Read 1234 bytes
2. Listing directory...
   ✅ Found 10 items
...
[MCPBridge] Testing complete!
```

---

## Configuration

### Safe Zone Setup

Edit `config/safe_zones.json` to configure allowed directories:

```json
{
  "safe_zones": [
    {
      "name": "Data Directory",
      "path": "./data",
      "permissions": ["read", "write", "delete"],
      "max_file_size_mb": 100,
      "allowed_extensions": ["txt", "json", "csv", "md", "log"]
    }
  ],
  "blacklist": [".env", ".env.*", ".git/**", "*.key", "*.pem"]
}
```

**Restart backend after changes.**

### E2B Sandbox Configuration

1. **Sign up:** https://e2b.dev/
2. **Get API key:** Dashboard → API Keys → Create
3. **Add to `.env`:**
   ```env
   E2B_API_KEY=e2b_***************************
   ```
4. **Restart backend**

**Test E2B:**
```bash
curl -X POST http://localhost:3000/api/v1/mcp/e2b/execute \
  -H "Content-Type: application/json" \
  -d '{"code": "print(\"Hello from E2B\")", "timeout_ms": 10000}' \
  | python -m json.tool
```

### Bifrost Provider Priority

Edit `src/core/bifrost_gateway.ts` to customize routing:

```typescript
const routing: Record<TaskType, ProviderType[]> = {
  code: ['ollama', 'github', 'gemini', 'anthropic'],    // Code tasks → Ollama first
  general: ['gemini', 'ollama', 'github', 'anthropic'], // General → Gemini first
  reasoning: ['anthropic', 'github', 'gemini', 'ollama'], // Reasoning → Claude first
  // ...
};
```

---

## Production Deployment

### Environment Setup

1. **Set production URLs:**
   ```env
   NODE_ENV=production
   BRUNELLA_API_URL=https://your-domain.com
   ```

2. **Use reverse proxy (nginx):**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location /api/ {
           proxy_pass http://localhost:3000/api/;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }

       location / {
           proxy_pass http://localhost:5173/;
       }
   }
   ```

3. **Enable HTTPS (Let's Encrypt):**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

### Process Management (PM2)

```bash
# Install PM2
npm install -g pm2

# Start backend
pm2 start npm --name "brunella-backend" -- run dev

# Start Python backend
pm2 start "uvicorn myai.server:app --host 0.0.0.0 --port 8000" --name "brunella-python"

# Save PM2 config
pm2 save

# Enable auto-start on boot
pm2 startup
```

### Monitoring

```bash
# View logs
pm2 logs brunella-backend

# Monitor resources
pm2 monit

# Health check endpoint
curl https://your-domain.com/api/health
```

---

## Troubleshooting

### Ollama Connection Failed

**Symptom:** `"ollama": {"status": "unhealthy"}`

**Fix:**
```bash
# Check if Ollama is running
ps aux | grep ollama

# Restart Ollama
ollama serve

# Verify
curl http://localhost:11434/api/tags
```

### E2B Sandbox Timeout

**Symptom:** `"E2B_API_KEY not configured"` or timeouts

**Fix:**
1. Check API key in `.env`
2. Verify E2B quota: https://e2b.dev/dashboard
3. Increase timeout in code:
   ```typescript
   timeout_ms: 60000  // 60 seconds
   ```

### Safe Zone Access Denied

**Symptom:** `"Access denied: Path outside Safe Zone"`

**Fix:**
1. Check `config/safe_zones.json` configuration
2. Verify path is within allowed zone
3. Check audit log: `tail -f logs/mcp_audit.log`

### Bifrost Provider Offline

**Symptom:** `"provider: ollama, available: false"`

**Fix:**
1. Check provider API key in `.env`
2. Test provider directly:
   ```bash
   # Test Gemini
   curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"
   ```
3. Restart backend after fixing keys

### Python Bridge Connection Failed

**Symptom:** `"Backend not reachable at http://localhost:3000"`

**Fix:**
1. Ensure Node.js backend is running: `npm run dev`
2. Check port 3000 is not blocked
3. Verify health endpoint: `curl http://localhost:3000/api/health`

---

## Performance Tuning

### MCP Tool Response Time

**Target:** <100ms

**Optimization:**
- Use SSD for data storage
- Enable filesystem caching
- Increase Node.js heap size:
  ```bash
  NODE_OPTIONS="--max-old-space-size=4096" npm run dev
  ```

### E2B Sandbox Start Time

**Target:** <5s

**Optimization:**
- Use E2B template with pre-installed packages
- Enable E2B caching
- Reduce package installation:
  ```python
  # Pre-install common packages in E2B template
  packages=[]  # No runtime installation needed
  ```

### Bifrost Auto-Select Accuracy

**Target:** ≥85%

**Monitoring:**
```bash
# View provider usage
curl http://localhost:3000/api/v1/mcp/stats | python -m json.tool
```

**Tuning:** Adjust task type routing in `bifrost_gateway.ts`

---

## Backup & Recovery

### Data Backup

```bash
# Backup critical data
tar -czf brunella-backup-$(date +%Y%m%d).tar.gz \
  data/ \
  conductor/tracks/ \
  logs/mcp_audit.log \
  config/safe_zones.json \
  .env.backup

# Exclude large files
tar -czf brunella-backup.tar.gz --exclude='data/brunella_lancedb' data/
```

### Restore

```bash
# Extract backup
tar -xzf brunella-backup-20260218.tar.gz

# Restart services
pm2 restart all
```

---

## Security Hardening

1. **Firewall rules:**
   ```bash
   # Allow only necessary ports
   sudo ufw allow 22/tcp    # SSH
   sudo ufw allow 80/tcp    # HTTP
   sudo ufw allow 443/tcp   # HTTPS
   sudo ufw enable
   ```

2. **API rate limiting:** Configure in `src/server/middleware.ts`

3. **Audit log monitoring:**
   ```bash
   # Alert on denied operations
   tail -f logs/mcp_audit.log | grep DENIED | mail -s "Security Alert" admin@example.com
   ```

4. **Regular updates:**
   ```bash
   npm audit fix
   pip list --outdated
   ```

---

## Support

- **Documentation:** `docs/`
- **GitHub Issues:** https://github.com/pohi99999/mcp-brunella-core/issues
- **Security:** See `SECURITY.md`

---

**Last Updated:** 2026-02-18
**Version:** 1.0.0
