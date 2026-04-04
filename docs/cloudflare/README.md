# Cloudflare Infrastructure Documentation

**Brunella Agent System** teljes Cloudflare integrációjának dokumentációja.

---

## 📚 Dokumentumok

| Fájl | Leírás |
|------|--------|
| **[INFRASTRUCTURE.md](./INFRASTRUCTURE.md)** | 🌟 **MASTER** - Teljes infrastruktúra áttekintés, 6 deployed + 5 planned worker, összes szolgáltatás (Tunnel, AI Gateway, Browser Rendering, R2, D1, Vectorize, KV, Durable Objects), költség modell, deployment, troubleshooting |
| **[DIAGRAM.txt](./DIAGRAM.txt)** | 📊 ASCII diagram - Teljes rendszer vizualizáció (workers, pipeline flow, cost breakdown) |

---

## 🚀 Gyors Áttekintés

### Deployed Workers (6)
- `llm-chat-app-template` - Chat interface template
- `agents-api` - MCP agent proxy
- `saas-admin` - Admin dashboard
- `brunella-cf` - Core API edge proxy
- `bas-orchestrator` - Central delegation hub ✨
- `throbbing-fire` - Unknown (audit needed)

### Planned Workers (CEAN - 5%)
- `research-agent` - GitHub/arXiv AI trends
- `grant-monitor` - EU/USA grant tracker
- `data-harvester` - Playwright web scraper
- `data-extractor` - LLM structured extraction
- `builder-agent` - CI/CD monitor + auto-fix PRs
- `cean-orchestrator` - Upgraded task scheduler

### Infrastructure Services
- ✅ **AI Gateway** - LLM routing (`@cf/meta/llama-3.1-8b-instruct`)
- ✅ **Tunnel** - Localhost → Public URL (GitHub webhooks)
- ✅ **Browser Rendering** - Playwright automation on Edge
- ⏳ **R2 Storage** - Object storage (configured, not used)
- ⏳ **D1 Database** - SQLite edge DB (schema designed, pending creation)
- ⏳ **Vectorize (R1)** - Vector embeddings (planned)
- ⏳ **KV Storage** - Key-value store (planned)
- ⏳ **Durable Objects** - Stateful workers (planned)

---

## 📈 Költség

**Havi becslés:** ~$2.63/month (jócskán a free tier alatt)

Részletek: [INFRASTRUCTURE.md → Cost Model](./INFRASTRUCTURE.md#-cost-model-monthly-estimate)

---

## 🔧 Gyors Parancsok

### Health Check
```bash
curl http://localhost:3000/api/health | python -m json.tool
```

### Token Verification
```bash
curl -s "https://api.cloudflare.com/client/v4/user/tokens/verify" \
   -H "Authorization: Bearer $CF_BAS_API_TOKEN" | python -m json.tool
```

### Deploy Worker
```bash
wrangler deploy --env production
```

### Start Tunnel
```bash
cloudflared tunnel --url http://localhost:3000
```

---

## 🎯 Következő Lépések (CEAN)

1. **Phase 1A: Infrastructure Setup**
   - [ ] D1 database creation (`wrangler d1 create cean-tasks`)
   - [ ] Vectorize index creation (`wrangler vectorize create cean-embeddings`)
   - [ ] KV namespace creation (`wrangler kv:namespace create cean-cache`)

2. **Phase 2: Agent Workers Implementation**
   - [ ] Research Agent worker
   - [ ] Grant Monitor worker
   - [ ] Data Harvester worker
   - [ ] Data Extractor worker
   - [ ] Builder Agent worker

3. **Phase 3: Orchestration & Pipeline**
   - [ ] Orchestrator upgrade
   - [ ] Pipeline DAG implementation
   - [ ] Dashboard integration

4. **Phase 4: Testing & Optimization**
   - [ ] Load testing
   - [ ] Cost optimization
   - [ ] E2E testing

**Progress:** 5% (Specification done)
**Target:** 2026-03-15 (4 weeks)

---

## 📖 További Dokumentáció

- **CEAN Track:** `../../conductor/tracks/cloudflare_edge_agents_network_20260215/`
  - `spec.md` - Detailed specification
  - `plan.md` - Implementation plan
  - `meta.json` - Track metadata
- **Wrangler Config:** `../../wrangler.toml`
- **D1 Schema:** `../../myai/agents/workers/schema/d1_schema.sql` (planned)
- **EdgeProxyAgent:** `../../src/agents/EdgeProxyAgent.ts`
- **Cloudflare Routes:** `../../src/server/routes/cloudflare.ts`

---

## 🆘 Troubleshooting

**"Cloudflare unhealthy" despite valid token?**
→ Restart Node.js backend: `npm run dev`

**HTTP 401 Unauthorized?**
→ Token expired or wrong scope. Generate new token with Workers AI + Scripts + Account Settings permissions.

**HTTP 502 Bad Gateway?**
→ Worker not responding or AI Gateway URL wrong. Check `CLOUDFLARE_WORKER_URL` in `.env`.

**Tunnel URL változik újraindításkor?**
→ Named tunnel szükséges production-höz: `wrangler tunnel create brunella-prod`

Részletes hibaelhárítás: [INFRASTRUCTURE.md → Health Check & Monitoring](./INFRASTRUCTURE.md#-health-check--monitoring)

---

**Frissítve:** 2026-02-16
**Owner:** Brunella Core Team
**Kapcsolat:** Internal documentation - see CLAUDE.md or README.md for project contact
