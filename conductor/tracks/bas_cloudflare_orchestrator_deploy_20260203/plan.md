# Plan: BAS Cloudflare Orchestrator Deploy

**Track ID:** `bas_cloudflare_orchestrator_deploy_20260203`
**Dátum:** 2026-02-03

---

## Végrehajtott Lépések

### 1. Projekt előkészítés
- `bas-cloudflare-orchestrator` és `bas-cloudflare-analysis` mappák tartalmának ellenőrzése
- langflow/, n8n/, client/ mappák megléte
- wrangler.jsonc PLACEHOLDER_KV_ID állapota

### 2. KV Namespace
```powershell
npm run kv:create
# Eredmény: id = b6718ab359ac401bb24da7c34c24f11b
```

### 3. Konfiguráció frissítése
- wrangler.jsonc: PLACEHOLDER_KV_ID → b6718ab359ac401bb24da7c34c24f11b

### 4. Deploy
```powershell
npm run deploy
# Eredmény: https://bas-orchestrator.iam-dd1.workers.dev
```

### 5. Callback URL javítás
- src/index.ts: hardcoded `throbbing-water-2892.workers.dev` → dinamikus `new URL(request.url).origin`
- dispatchTask() paraméter: workerOrigin
- Újra-deploy

### 6. Tesztelés
- Health check: OK
- Task beküldés: OK (orchestrate → n8n)

### 7. Dokumentáció
- run-tests.ps1: Worker URL frissítve
- TEST_RESULTS.md: eredmények rögzítve
- setup-complete.ps1: ProjectRoot dinamikus (PSScriptRoot)
