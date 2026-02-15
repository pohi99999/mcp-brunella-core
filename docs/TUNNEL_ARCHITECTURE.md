# Brunella Cloudflare Tunnel Architecture

**Készítve:** 2026-02-15  
**Cél:** A Brunella Core szerver külső elérhetőségének biztosítása domain nélkül, Cloudflare Tunnel segítségével.

---

## 🏗️ Architektúra Áttekintés

```
┌─────────────────────────────────────────────────────────────────┐
│                        LOKÁLIS KÖRNYEZET                         │
│  (F:\mcp-brunella-core vagy saját gép)                          │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Brunella Core Szerver (Node.js + Express)              │   │
│  │  - Port: 3000 (backend API)                             │   │
│  │  - Port: 5173 (Vite dashboard)                          │   │
│  │  - MCP szerverek (stdio transport)                      │   │
│  │  - Ollama (port 11434)                                  │   │
│  │  - AnythingLLM (port 3001)                              │   │
│  └──────────────┬──────────────────────────────────────────┘   │
│                 │                                                │
│                 │ localhost:3000                                │
│                 ▼                                                │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cloudflare Tunnel (cloudflared)                        │   │
│  │  - Secure outbound connection                           │   │
│  │  - No inbound ports needed                              │   │
│  │  - Automatic HTTPS                                      │   │
│  └──────────────┬──────────────────────────────────────────┘   │
│                 │                                                │
└─────────────────┼────────────────────────────────────────────────┘
                  │
                  │ Encrypted Tunnel (WebSocket over TLS)
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE NETWORK (Edge)                     │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Cloudflare Tunnel Service                              │   │
│  │  - DNS routing                                          │   │
│  │  - DDoS protection                                      │   │
│  │  - SSL/TLS termination                                  │   │
│  │  - Access policies (optional)                           │   │
│  └──────────────┬──────────────────────────────────────────┘   │
│                 │                                                │
└─────────────────┼────────────────────────────────────────────────┘
                  │
                  │ Public Internet
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         KÜLSŐ VILÁG                              │
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  GitHub Webhooks │  │  n8n Workflows   │  │  Mobile App   │ │
│  │  (Deploy events) │  │  (Automation)    │  │  (Dashboard)  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│           │                      │                     │         │
│           └──────────────────────┴─────────────────────┘         │
│                                  │                               │
│                      https://abc123.trycloudflare.com            │
│                      vagy egyéni domain (opcionális)             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Működési Flow

### 1️⃣ **Lokális Indítás**

```bash
# Terminal 1: Brunella Core szerver
npm run dev          # Port 3000

# Terminal 2: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3000
```

**Eredmény:**
```
2026-02-15T16:00:00Z INF Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):
https://abc123-def456.trycloudflare.com
```

### 2️⃣ **Külső Kérés Beérkezése**

1. **User/System** elküld egy HTTP kérést: `GET https://abc123.trycloudflare.com/api/health`
2. **Cloudflare Edge** fogadja a kérést (legközelebbi datacenter)
3. **Tunnel Service** továbbítja a lokális `cloudflared` process-nek (titkosított WebSocket)
4. **cloudflared** a `localhost:3000`-re proxyzza a kérést
5. **Express API** feldolgozza és választ küld
6. **Visszafelé**: Express → cloudflared → Cloudflare Edge → User

### 3️⃣ **Példa: GitHub Webhook**

```
GitHub workflow fail
    ↓
POST https://abc123.trycloudflare.com/api/github/webhook
    ↓ (Cloudflare Tunnel)
Express: POST /api/github/webhook
    ↓
src/server/routes/githubWebhook.ts
    ↓
Jules AI analysis → Fix commit
```

---

## 🛡️ Biztonsági Előnyök

| Előny | Leírás |
|-------|--------|
| **Nincs nyitott port** | A lokális tűzfaladon nem kell 3000-es portot nyitni |
| **Automatikus HTTPS** | Cloudflare SSL certificate (ingyenes) |
| **DDoS védelem** | Cloudflare edge network szűri a rosszindulatú forgalmat |
| **IP rejtés** | A valódi IP címed nem látszik kívülről |
| **Access Policy** | Cloudflare Access (opcionális): Email/GitHub login before access |

---

## 🆚 Tunnel vs. Hagyományos Hosting

| Szempont | Cloudflare Tunnel | VPS/Render |
|----------|-------------------|------------|
| **Cost** | **Ingyenes** (quick tunnel) | $5-20/hó |
| **Setup** | 1 parancs (`cloudflared tunnel`) | Domain, DNS, server config |
| **Maintenance** | 0 (Cloudflare kezeli) | Frissítések, monitoring |
| **Latency** | +10-30ms (edge routing) | Közvetlen (ha közel a szerver) |
| **Flexibility** | Lokálisan fejleszthetsz, instant deploy | Push → build → deploy (lassabb) |
| **Best for** | **Dev/testing + personal projects** | Production apps, heavy traffic |

---

## 📊 Named Tunnel vs Quick Tunnel

### Quick Tunnel (amit most használunk)
```bash
cloudflared tunnel --url http://localhost:3000
```
- ✅ **Előny:** Instant, 0 config
- ❌ **Hátrány:** Random URL (minden indításkor új), temp session (24 óra max)

### Named Tunnel (ajánlott production-höz)
```bash
# 1. Létrehozás
cloudflared tunnel create brunella-core

# 2. Konfiguráció (config.yml)
tunnel: <uuid>
credentials-file: /path/to/credentials.json
ingress:
  - hostname: brunella.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404

# 3. DNS (automatikus)
cloudflared tunnel route dns brunella-core brunella.yourdomain.com

# 4. Indítás
cloudflared tunnel run brunella-core
```
- ✅ **Előny:** Fix URL, domain support, auto-restart, load balancing
- ❌ **Hátrány:** Több lépés a setuphoz

---

## 🚀 Deployment Opciók

### Opció A: Lokális + Quick Tunnel (JELENLEGI)
```bash
# start-full.bat módosítás (Phase 6 hozzáadás)
echo [Phase 6] Starting Cloudflare Tunnel...
start /B cloudflared tunnel --url http://localhost:3000
```
**Pro:** Legegyszerűbb, dev-friendly  
**Con:** Nem stabil (lokális gép kell hogy fusson)

### Opció B: Named Tunnel + Helyi Szerver
```bash
# Systemd service (Linux) vagy Windows Service
cloudflared tunnel run brunella-core
```
**Pro:** Stabil URL, auto-restart  
**Con:** Még mindig lokális (szerver ki = service down)

### Opció C: Hybrid (Tunnel + Edge Worker)
```
Lokális Brunella (heavy logic)
    ↓ Tunnel
Edge Worker (lightweight relay)
    ↓
Public API
```
**Pro:** Lokális fejlesztés + edge cache/routing  
**Con:** Complexity (2 system)

### Opció D: Full Cloud (Render/Railway + optional tunnel)
```
Render (Docker container, always-on)
    ↓ (opcionális tunnel, vagy direct HTTPS)
Public API
```
**Pro:** True 24/7 uptime  
**Con:** Költség, deployment complexity

---

## 🎯 Javaslat a Brunella-hoz

**Most:** Opció A (Quick Tunnel)  
- Gyors teszt, 0 cost, lokális fejlesztés  

**Later (ha production-ready):** Opció B (Named Tunnel)  
- Fix URL, stabil, még mindig ingyenes  
- Csak a lokális gépnek kell futnia (vagy VPS-en is megy)

**Ha budget van:** Opció D (Render + Named Tunnel)  
- Render: Backend always-on ($7/hó)  
- Tunnel: Backup/development access  

---

## 📝 Következő Lépések (Phase 3E)

1. ✅ **Tunnel Teszt:**
   ```bash
   cloudflared tunnel --url http://localhost:3000
   ```
   - Ellenőrzés: `curl https://<tunnel-url>/api/health`

2. ✅ **Dokumentáció Frissítés:**
   - README.md: Tunnel usage section
   - start-full.bat: Phase 6 tunnel indítás (opcionális flag)

3. ✅ **GitHub Webhook Setup:**
   - GitHub repo settings → Webhooks → Add webhook
   - URL: `https://<tunnel-url>/api/github/webhook`
   - Secret: `GITHUB_WEBHOOK_SECRET` env var

4. ✅ **n8n Integration Test:**
   - n8n workflow → HTTP Request node → Tunnel URL
   - Verify: Brunella receives request

5. ✅ **Mobile Dashboard Test:**
   - Open `https://<tunnel-url>` on phone
   - Verify: Dashboard loads (React app served)

---

## 🔍 Troubleshooting

### Problem: Tunnel nem indul
```bash
# Check cloudflared
cloudflared --version

# Check port conflict
netstat -ano | findstr :3000

# Restart with verbose
cloudflared tunnel --url http://localhost:3000 --loglevel debug
```

### Problem: 502 Bad Gateway
- **OK:** Backend (port 3000) nem fut → `npm run dev`
- **OK:** Rossz port → ellenőrizd `--url` paramétert

### Problem: Slow response
- **OK:** Edge routing latency (várható +20-50ms)
- **Fix:** Named tunnel + geo-steering (ha nagyon kritikus)

---

**Készítette:** GitHub Copilot (Claude)  
**Verzió:** 1.0  
**Utolsó frissítés:** 2026-02-15
