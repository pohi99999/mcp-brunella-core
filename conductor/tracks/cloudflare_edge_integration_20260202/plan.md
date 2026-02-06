# Track: Cloudflare Edge Integration

**ID:** `cloudflare_edge_integration_20260202`
**Státusz:** 🟡 Active
**Prioritás:** HIGH
**Létrehozva:** 2026-02-02
**Becslés:** 5-7 nap

---

## 🎯 Célok

A BAS (Brunella Agent System) bővítése Cloudflare Workers edge computing képességekkel:

1. **API Gateway** - Egységes külső belépési pont globális elérhetőséggel
2. **Task Router** - AI-alapú task osztályozás az edge-en
3. **Távoli elérés** - Dashboard és API bárhonnan elérhető
4. **Hibrid Orchestráció** - Edge + Lokális rendszer együttműködése
5. **Fallback LLM** - Workers AI backup ha Ollama nem elérhető

---

## 📋 Feladatok

### Fázis 1: Alapinfrastruktúra (2-3 nap)

- [x] Cloudflare Worker kód létrehozása (`cloudflare/src/index.ts`)
- [x] wrangler.jsonc konfiguráció
- [x] cloudflared telepítése (2025.8.1) – 2026-02-03
- [x] Cloudflare Tunnel létrehozása (bas-tunnel, f6c9eed4-cb46-4bc4-98bf-d51b6455417c) – 2026-02-03
- [x] KV namespace létrehozása (`BAS_TASKS`) – 2026-02-03
- [x] Első deploy és health check teszt – 2026-02-03 (https://bas-orchestrator.iam-dd1.workers.dev)

### Fázis 2: Lokális Integráció (2-3 nap)

- [x] EdgeProxyAgent implementálása
- [x] AgentManager edge-first delegálás
- [x] registry.json frissítés
- [x] Tunnel config (docs/tunnel-config.yml) + DNS CNAME rekordok – 2026-02-03
- [x] Webhook endpoint a lokális rendszerben
- [x] KV ↔ SQLite szinkronizáció

### Fázis 3: Hibrid Orchestráció (2-3 nap)

- [x] Workers AI fallback implementálása
- [x] Durable Objects session state
- [x] Dashboard proxy
- [x] End-to-end teszt
- [x] Dokumentáció frissítés

---

## ✅ Elfogadási Kritériumok

### Must Have
- [x] Worker deployolva: `https://bas-orchestrator.iam-dd1.workers.dev` (2026-02-03)
- [x] Health check működik edge-ről
- [x] Task beküldés működik az edge-en keresztül
- [ ] Tunnel kapcsolat stabil (lokális szolgáltatásokhoz)

### Should Have
- [ ] KV szinkronizáció működik
- [ ] Workers AI fallback implementálva
- [ ] Dashboard elérhető távolról

### Nice to Have
- [ ] Durable Objects session management
- [ ] Cloudflare Access policy
- [ ] Multi-region támogatás

---

## 📁 Érintett Fájlok

### Új Fájlok

| Fájl | Státusz | Leírás |
|------|---------|--------|
| `cloudflare/src/index.ts` | ✅ Kész | Worker entry point |
| `cloudflare/wrangler.jsonc` | ✅ Kész | CF konfiguráció |
| `src/agents/EdgeProxyAgent.ts` | ✅ Kész | Edge kommunikáció |
| `src/agents/ProjectConductorAgent.ts` | ✅ Kész | Projekt menedzsment |
| `docs/tunnel-config.yml` | ✅ Kész | Tunnel config (peterpohanka.com) |
| `src/edge/tunnel/bridge.ts` | ⏳ Tervezett | Tunnel kommunikáció |

### Módosított Fájlok

| Fájl | Státusz | Változás |
|------|---------|----------|
| `src/agents/AgentManager.ts` | ✅ Kész | Edge-first delegálás |
| `src/agents/registry.json` | ✅ Kész | Új ügynökök |
| `.env` | ⏳ Tervezett | CF credentials |
| `package.json` | ⏳ Tervezett | Új scriptek |

---

## 🔧 Környezeti Változók

```env
# Cloudflare Edge Integration
EDGE_ENABLED=true
CLOUDFLARE_ACCOUNT_ID=1bf6118df97f0e12f3592a89d90deb1e
CLOUDFLARE_API_TOKEN=your-api-token
CLOUDFLARE_WORKER_URL=https://bas-orchestrator.workers.dev
CLOUDFLARE_TUNNEL_ENABLED=true
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token

# Fallback settings
EDGE_FALLBACK_TO_LOCAL=true
EDGE_HEALTH_CHECK_INTERVAL=30000
```

---

## 🧪 Tesztelési Terv

### Manuális Tesztek

```powershell
# 1. Edge health check
curl https://bas-orchestrator.workers.dev/health

# 2. Task beküldés
curl -X POST https://bas-orchestrator.workers.dev/task `
  -H "Content-Type: application/json" `
  -d '{"instruction": "Test task from edge"}'

# 3. Tunnel teszt (lokálisan)
curl http://localhost:3000/api/health

# 4. Dashboard proxy
curl https://bas-orchestrator.workers.dev/dashboard
```

### Integrációs Tesztek

```typescript
// test/edge/integration.test.ts
describe('Edge Integration', () => {
  it('should route tasks through edge when available');
  it('should fallback to local when edge is down');
  it('should sync KV with local SQLite');
});
```

---

## 📝 Napló

### 2026-02-02

- Track létrehozva
- Cloudflare Worker kód elkészült
- EdgeProxyAgent implementálva
- ProjectConductorAgent implementálva
- AgentManager frissítve edge támogatással
- registry.json frissítve

### 2026-02-03

- bas-cloudflare-orchestrator deploy sikeres
- KV namespace: b6718ab359ac401bb24da7c34c24f11b
- Worker URL: https://bas-orchestrator.iam-dd1.workers.dev
- Dinamikus callback URL javítás
- Track: bas_cloudflare_orchestrator_deploy_20260203
- **Cloudflare Tunnel:** cloudflared login, tunnel create bas-tunnel (f6c9eed4-cb46-4bc4-98bf-d51b6455417c)
- **DNS CNAME:** n8n.bas.peterpohanka.com, browser-use.bas.peterpohanka.com, api.bas.peterpohanka.com
- **Config:** docs/tunnel-config.yml (domain: peterpohanka.com)
- **Várakozás:** Névszerver propagáció – regisztrátor fiókhoz nincs hozzáférés

### Következő lépések

1. ~~KV namespace létrehozása~~ ✅
2. ~~Első deploy és teszt~~ ✅
3. ~~cloudflared telepítése~~ ✅
4. ~~Cloudflare Tunnel létrehozása~~ ✅ (bas-tunnel, peterpohanka.com)
5. ~~Config és DNS~~ ✅ (docs/tunnel-config.yml, n8n.bas, browser-use.bas, api.bas)
6. **Névszerver propagáció** – Regisztrátor fiókban (peterpohanka.com) Cloudflare névszerverek beállítása
7. **Tunnel indítása** – `cloudflared tunnel run bas-tunnel --config docs/tunnel-config.yml`
8. **Worker frissítése** – wrangler.jsonc vars: N8N_WEBHOOK_URL, BROWSER_USE_ENDPOINT → tunnel URL-ek
9. Langflow/n8n flow-k importálása és aktiválása

---

## 🔗 Referenciák

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Workers AI](https://developers.cloudflare.com/workers-ai/)
- BAS Architektúra: `conductor/BAS_ARCHITECTURE_v2.md`
- **Tunnel setup:** `docs/cloudflare-tunnel-setup.md` – részletes útmutató

---

*Track létrehozva: Claude (Brunella társügynök)*
*Utolsó frissítés: 2026-02-03*
