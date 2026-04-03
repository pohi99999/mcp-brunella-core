# Cloudflare Token Beállítás — BAS vs Személyes Account

## Jelenlegi állapot (2026-04-03)

A rendszer jelenleg kevert token névhasználatot alkalmaz:

| Változó | Hol van | Mit jelent |
|---------|---------|-----------|
| `CF_ACCOUNT_ID` | `.env`, `src/utils/aiGateway.ts` | CF Account ID |
| `CF_TOKEN` | `.env.example` | Általános CF token |
| `CF_API_TOKEN` | `src/` sok helyen | Workers AI / API token |
| `CF_AI_API_TOKEN` | `.env.example`, `src/core/bifrost_gateway.ts` | Workers AI specifikus token |
| `CLOUDFLARE_API_TOKEN` | `.github/workflows/`, `src/server/routes/cloudflare.ts` | GitHub Actions / deploy token |
| `CLOUDFLARE_ACCOUNT_ID` | `.github/workflows/`, `src/utils/browserRendering.ts` | GitHub Actions account ID |

---

## Célállapot: Szétválasztott Token Struktúra

### BAS-specifikus tokenek (Workers/KV/D1/R2)

```env
# BAS Workers infrastruktúra token
# Scope: Workers Scripts:Edit, Workers KV Storage:Edit, D1:Edit, R2:Edit
CF_BAS_ACCOUNT_ID=your_bas_account_id
CF_BAS_API_TOKEN=your_bas_workers_token
```

### AI Gateway token (Workers AI inference)

```env
# Workers AI inference token
# Scope: Workers AI:Read, AI Gateway:Read
CF_AI_API_TOKEN=your_ai_gateway_token
CF_AI_GATEWAY_ENABLED=true
```

### Személyes account (DNS, Pages — CSAK ha szükséges)

```env
# Személyes Cloudflare account — NE tedd a rendszer .env-jébe alapból
CF_PERSONAL_ACCOUNT_ID=your_personal_id
CF_PERSONAL_API_TOKEN=your_personal_token  # Scope: Zone:Read, DNS:Edit
```

---

## Token Létrehozás — Lépésről Lépésre

### 1. BAS Workers Token

1. Menj: https://dash.cloudflare.com/profile/api-tokens
2. Kattints: **Create Token**
3. Válassz: **Edit Cloudflare Workers** sablon VAGY Custom token
4. Scope-ok (csak az szükséges):
   - `Account > Workers Scripts:Edit`
   - `Account > Workers KV Storage:Edit`
   - `Account > D1:Edit`
   - `Account > R2:Edit`
   - `Account > Workers AI:Read` (ha AI Gateway kell)
5. **Account Resources:** Csak a BAS account-ra korlátozd
6. **TTL:** Állíts be lejárati dátumot (javasolt: 1 év)

### 2. GitHub Actions Secret Beállítás

GitHub repository → Settings → Secrets and variables → Actions:

```
CLOUDFLARE_ACCOUNT_ID  = CF_BAS_ACCOUNT_ID értéke
CLOUDFLARE_API_TOKEN   = CF_BAS_API_TOKEN értéke
```

---

## Migrációs Terv (Track: cloudflare_token_separation_20260403)

### Fázis 1: Audit (elvégzett)

Az összes érintett fájl:
- `src/utils/aiGateway.ts` — `CF_ACCOUNT_ID`, `CF_API_TOKEN`, `CF_AI_API_TOKEN`
- `src/utils/cloudflareClient.ts` — `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`
- `src/utils/browserRendering.ts` — `CF_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`
- `src/server/routes/cloudflare.ts` — `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`
- `src/core/bifrost_gateway.ts` — `CF_AI_API_TOKEN`, `CF_API_TOKEN`, `CF_TOKEN`
- `src/core/modelRouter.ts` — `CF_AI_API_TOKEN`, `CF_API_TOKEN`
- `src/server/routes/llm.ts` — `CLOUDFLARE_API_TOKEN`, `CF_API_TOKEN`
- `.github/workflows/bas-cloud-sync.yml` — `CLOUDFLARE_API_TOKEN`
- `.github/workflows/bas-local-sync.yml` — `CLOUDFLARE_API_TOKEN`
- `.github/workflows/deploy-edge-agents.yml` — `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`

### Fázis 2: Egységesítés (TEENDŐ)

**Javasolt egységes változónevek:**

| Jelenlegi | Javasolt | Megjegyzés |
|-----------|---------|-----------|
| `CF_ACCOUNT_ID` + `CLOUDFLARE_ACCOUNT_ID` | `CF_BAS_ACCOUNT_ID` | Egységesítés |
| `CF_API_TOKEN` + `CLOUDFLARE_API_TOKEN` + `CF_TOKEN` | `CF_BAS_API_TOKEN` | Egységesítés |
| `CF_AI_API_TOKEN` | Maradjon → `CF_AI_API_TOKEN` | Különálló cél |

**Migráció sorrendje (kockázatminimálás):**
1. Először `.env.example` és dokumentáció frissítés
2. Majd backward-compatible fallback az összes `process.env` hívásban:
   ```typescript
   const token = process.env.CF_BAS_API_TOKEN
     || process.env.CLOUDFLARE_API_TOKEN   // backward compat
     || process.env.CF_API_TOKEN;          // legacy
   ```
3. GitHub Secrets frissítés (CI tesztelés után)
4. Régi változók eltávolítása (utolsó lépés, külön PR)

### Fázis 3: GitHub Actions (TEENDŐ)

A `.github/workflows/` fájlokban:
```yaml
# Jelenlegi:
CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

# Célállapot:
CF_BAS_API_TOKEN: ${{ secrets.CF_BAS_API_TOKEN }}
CF_BAS_ACCOUNT_ID: ${{ secrets.CF_BAS_ACCOUNT_ID }}
```

---

## Health Check

A rendszer `/api/health` endpointja ellenőrzi a Cloudflare Workers elérhetőségét:

```bash
curl http://localhost:3000/api/health | python -m json.tool
# services.cloudflare.status === "healthy" kell legyen
```

Ha `"unhealthy"`:
1. `CLOUDFLARE_WORKER_URL` env változó nincs beállítva → állítsd be
2. Token lejárt → regenerálás szükséges (ld. fent)
3. CF Workers deployment hiányzik → `npm run deploy:workers`
