# BAS Cloudflare Integration

**Verzió:** 1.0.0 | **Frissítve:** 2026-02-10

A Brunella Agent System (BAS) Cloudflare integrációja lehetővé teszi a rendszer globális kiterjesztését serverless edge computing használatával.

---

## 🌐 Áttekintés

A BAS három főbb Cloudflare szolgáltatást használ:

1. **Cloudflare Tunnel** - Biztonságos távoli hozzáférés lokális szolgáltatásokhoz
2. **AI Gateway** - LLM kérések cache-elése, rate limiting és költségkövetés
3. **Vectorize** - Globális vektor adatbázis (POC fázis)

---

## 1. Cloudflare Tunnel

### Mi ez?

Biztonságos kapcsolat a lokális gép (Zalaegerszeg) és a külvilág között **port nyitás nélkül**. A tunnel lehetővé teszi, hogy:

- A Cloudflare Worker visszahívhasson a lokális n8n-be
- A Browser-Use eredményeket küldjön a myai Python szervernek
- A Dashboard elér hető legyen bárhonnan (mobilról is)

### Telepítés

**Részletes útmutató:** [bas-cloudflare-orchestrator/cloudflared/README.md](bas-cloudflare-orchestrator/cloudflared/README.md)

#### Gyors Mód (nincs domain szükséges)

```bash
cloudflared tunnel --url http://localhost:3000
```

Ez egy ideiglenes URL-t generál (pl. `https://xyz.trycloudflare.com`).

⚠️ **Figyelem:** Az URL változik minden újraindításkor!

#### Állandó Mód (javasolt)

1. **Autentikáció:**

   ```bash
   cloudflared tunnel login
   ```

2. **Tunnel létrehozása:**

   ```bash
   cloudflared tunnel create bas-local-bridge
   ```

3. **Konfiguráció szerkesztése:**

   ```bash
   cd bas-cloudflare-orchestrator/cloudflared
   # Frissítsd a config.yml-t a tunnel UUID-val és credentials elérési úttal
   ```

4. **Tunnel indítása:**

   ```bash
   cloudflared tunnel --config cloudflared/config.yml run
   ```

5. **Windows Service (opcionális):**

   ```bash
   cloudflared service install
   cloudflared service start
   ```

### Environment Változók

Frissítsd a `.env` fájlt a tunnel URL-ekkel:

```env
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_URL=https://api-bas.trycloudflare.com
CLOUDFLARE_TUNNEL_N8N_URL=https://n8n-bas.trycloudflare.com
CLOUDFLARE_TUNNEL_BROWSER_URL=https://browser-bas.trycloudflare.com
CLOUDFLARE_TUNNEL_DASHBOARD_URL=https://dashboard-bas.trycloudflare.com
```

### Tesztelés

```bash
# Ellenőrizd, hogy a tunnel működik
curl https://api-bas.trycloudflare.com/api/health

# Várt válasz: 200 OK (a lokális BAS backend válasza)
```

### Architectural Diagram

```
┌─────────────────────────────────────────────────────────────┐
│  Cloudflare Worker (bas-orchestrator.workers.dev)           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  POST /task → Routing to local services             │  │
│  │  • Browser task → CLOUDFLARE_TUNNEL_BROWSER_URL     │  │
│  │  • n8n task → CLOUDFLARE_TUNNEL_N8N_URL            │  │
│  │  • Callback → CLOUDFLARE_TUNNEL_URL                 │  │
│  └──────────────────────────────────────────────────────┘  │
└───────────┬─────────────────────────────────────────────────┘
            │  Cloudflare Tunnel (TLS/SSL)
            ▼
┌─────────────────────────────────────────────────────────────┐
│  LOCAL (F:\mcp-brunella-core) - Zalaegerszeg               │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ n8n (5678)       │  │ BAS API (3000)   │               │
│  │ Workflow Engine  │  │ Express + Socket │               │
│  └──────────────────┘  └──────────────────┘               │
│  ┌──────────────────┐  ┌──────────────────┐               │
│  │ Browser-Use      │  │ Dashboard (5173) │               │
│  │ myai (8000)      │  │ Vite + React     │               │
│  └──────────────────┘  └──────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. AI Gateway

### Mi ez?

A Cloudflare AI Gateway egy proxy réteg az LLM API hívások előtt, amely biztosítja:

- **Cache:** Ismétlődő promptok gyorsítása (akár 90% költségcsökkentés)
- **Rate Limiting:** Védelmet nyújt túlzott használat ellen
- **Analytics:** Token usage, latency, cost tracking
- **Fallback:** Több LLM provider közötti failover

### Telepítés

1. **Gateway létrehozása:**
   - Navigálj: [https://dash.cloudflare.com/](https://dash.cloudflare.com/) → AI → AI Gateway
   - Kattints **"Create Gateway"**
   - Név: `bas-llm-gateway`
   - Ez generál egy gateway URL-t: `https://gateway.ai.cloudflare.com/v1/{account_id}/bas-llm-gateway`

2. **Environment változók frissítése:**

   ```env
   AI_GATEWAY_ENABLED=true
   AI_GATEWAY_URL=https://gateway.ai.cloudflare.com/v1/{account_id}/bas-llm-gateway
   AI_GATEWAY_CACHE_TTL=3600  # 1 óra cache
   ```

3. **Automatikus integráció:**
   A BAS automatikusan használja az AI Gateway-t, ha `AI_GATEWAY_ENABLED=true`. Érintett fájlok:
   - `src/core/llm_client.ts` - Generate hívások
   - `src/utils/rag.ts` - Embedding hívások
   - `src/core/codebaseIndexer.ts` - Indexing embeddings

### Tesztelés

```bash
# Generálj egy LLM választ
brunella chat "Mi a BAS fő célja?"

# Ellenőrizd a Cloudflare Dashboard-on:
# https://dash.cloudflare.com/ → AI Gateway → bas-llm-gateway → Analytics
# Láthatod: request count, cache hit rate, latency, token usage
```

### Cache Stratégia

| Cache TTL | Használat |
|-----------|----------|
| **1 óra** (default) | Code generation, dokumentáció keresés |
| **24 óra** | Statikus dokumentumok, FAQ válaszok |
| **0 (disable)** | Real-time chat, user-specific promptok |

### Analytics Metrikák

```typescript
import { getAIGatewayStats } from './src/utils/aiGateway.js';

const stats = getAIGatewayStats();
console.log(stats);
// {
//   totalRequests: 1234,
//   cacheHits: 456,
//   cacheHitRate: "37.0%",
//   averageLatency: 245  // ms
// }
```

---

## 3. Vectorize (Proof of Concept)

### Mi ez?

Cloudflare Vectorize egy globális vektor adatbázis, amely az edge-en (a hálózat szélén) futtatja a vector similarity search-t. Tökéletes RAG (Retrieval-Augmented Generation) alkalmazásokhoz.

### Status

🚧 **POC fázis** - Még nem production ready!

**Részletes útmutató:** [bas-cloudflare-orchestrator/VECTORIZE_POC.md](bas-cloudflare-orchestrator/VECTORIZE_POC.md)

### Gyors Indítás

1. **Index létrehozása:**

   ```bash
   cd bas-cloudflare-orchestrator
   wrangler vectorize create bas-knowledge-index --dimensions=768 --metric=cosine
   ```

2. **Worker endpoint tesztelése:**

   ```bash
   curl -X POST https://bas-orchestrator.workers.dev/vectorize/search \
     -H "Content-Type: application/json" \
     -d '{"query": "How to create a new agent?", "topK": 3}'
   ```

### Architektura Terv (Hibrid)

| Storage | Role | Use Case |
|---------|------|----------|
| **LanceDB (Local)** | Master Write DB | Real-time writes, teljes kontroll |
| **Vectorize (Edge)** | Read-Only Replica | Gyors globális lekérdezések, cache |

**Sync stratégia:**

1. Minden harvest → LanceDB (azonnali írás)
2. Napi cron job (vagy webhook) → LanceDB → Vectorize sync
3. RAG lekérdezések → Vectorize (gyors, cached)
4. Fallback → LanceDB (ha Vectorize offline)

---

## 🔐 Biztonság

### Cloudflare Tunnel

✅ **Zero-trust alapú** (Cloudflare proxy-n keresztül)  
✅ **Nincs nyitott port** a routeren  
✅ **TLS/SSL automatikus** (HTTPS)

⚠️ **Figyelem:** A credentials fájl (`.cloudflared/*.json`) **NEM** mehet Git-re!

### AI Gateway

✅ **Rate limiting** védelem  
✅ **API key nem látszik** a client oldalon  
✅ **Audit log** minden LLM hívásról

### Environment Változók

⚠️ **SOHA ne commitolj `.env` fájlt Git-re!** Használj `.env.example` template-et.

---

## 📊 Költségek

### Cloudflare Free Tier (elég a BAS-hoz)

| Service | Free Limit | BAS Usage (becsült) |
|---------|------------|---------------------|
| **Workers** | 100k req/day | ~1-5k/nap ✅ |
| **KV** | 1GB, 100k reads/day | ~10MB, 5k reads ✅ |
| **R2** | 10GB, 10M reads/mo | ~500MB, 100k reads ✅ |
| **D1** | 5GB, 5M reads/day | ~50MB, 10k reads ✅ |
| **Tunnel** | Unlimited | ♾️ INGYENES ✅ |
| **AI Gateway** | Unlimited caching | ♾️ INGYENES ✅ |
| **Vectorize** | 5M dims, 100k queries/mo | ~1M dims, 10k queries ✅ |

**Összesen:** **$0/hó** (ha a free tier-en belül maradunk)

---

## 🛠️ Troubleshooting

### Tunnel "Connection failed"

**Probléma:** `cloudflared` nem tud csatlakozni.

**Megoldás:**

1. Ellenőrizd, hogy a lokális szolgáltatás fut-e: `curl http://localhost:3000`
2. Firewall engedélyezze a `cloudflared.exe` folyamatot
3. Parancs újraindítása: `cloudflared tunnel run bas-local-bridge`

### AI Gateway "Gateway not found"

**Probléma:** `AI_GATEWAY_URL` hibás vagy a gateway nem létezik.

**Megoldás:**

1. Ellenőrizd a Cloudflare Dashboard-on: AI → AI Gateway
2. Másold ki a helyes URL-t
3. Frissítsd a `.env` fájlt

### Vectorize "Index not found"

**Probléma:** `wrangler vectorize create` még nem futott le.

**Megoldás:**

```bash
cd bas-cloudflare-orchestrator
wrangler vectorize create bas-knowledge-index --dimensions=768 --metric=cosine
```

---

## 📚 További Dokumentáció

- **Cloudflare Tunnel:** [cloudflared/README.md](bas-cloudflare-orchestrator/cloudflared/README.md)
- **Vectorize POC:** [VECTORIZE_POC.md](bas-cloudflare-orchestrator/VECTORIZE_POC.md)
- **Worker API:** [bas-cloudflare-orchestrator/README.md](bas-cloudflare-orchestrator/README.md)
- **EdgeProxyAgent:** [src/agents/EdgeProxyAgent.ts](src/agents/EdgeProxyAgent.ts)

---

## 🚀 Beállítások Checklist

- [ ] Cloudflare Tunnel telepítve és konfigurálva
- [ ] `.env` frissítve tunnel URL-ekkel
- [ ] AI Gateway létrehozva Cloudflare Dashboard-on
- [ ] `AI_GATEWAY_ENABLED=true` beállítva
- [ ] EdgeProxyAgent tesztelve: `brunella-edge health`
- [ ] Worker deployolva: `cd bas-cloudflare-orchestrator && npm run deploy`
- [ ] Vectorize index létrehozva (opcionális POC)

---

**Utolsó frissítés:** 2026-02-10  
**Verzió:** 1.0.0  
**Karbantartó:** Brunella Core Team
