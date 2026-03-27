# Resolved Config Snapshot (2026-03-25)

Források:
- `cloudflare.md`
- `cloudflareversup.md`
- `.env`

> Megjegyzés: A dokumentum *maszkolt* formában tartalmaz érzékeny adatokat.

---

## 1) Domain és DNS alap

- Root domain: `peterpohanka.com`
- Tunnel-alapú BAS hostok (CNAME → `cfargotunnel.com`):
  - `api.bas.peterpohanka.com`
  - `browser-use.bas.peterpohanka.com`
  - `n8n.bas.peterpohanka.com`

Következtetés: a domain routing tervhez van valós DNS alap, nem csak workers.dev endpointok.

---

## 2) Canonical worker URL-k (jelenlegi)

`.env` szerint:
- `CLOUDFLARE_D1_WORKER_URL=https://cean-orchestrator.iam-dd1.workers.dev`
- `CLOUDFLARE_WORKER_URL=https://bas-orchestrator.peterpohankapersonal.workers.dev`
- `CLOUDFLARE_CHAT_SYNC_URL=https://bas-orchestrator.peterpohankapersonal.workers.dev`

Tunnel URL-k:
- `CLOUDFLARE_TUNNEL_URL=https://api-bas.trycloudflare.com`
- `CLOUDFLARE_TUNNEL_N8N_URL=https://n8n-bas.trycloudflare.com`
- `CLOUDFLARE_TUNNEL_BROWSER_URL=https://browser-bas.trycloudflare.com`
- `CLOUDFLARE_TUNNEL_DASHBOARD_URL=https://dashboard-bas.trycloudflare.com`

Következtetés: a task/D1 útvonal és a chat sync már logikailag szétválasztható, de chat sync még a bas-orchestrator URL-re mutat.

---

## 3) Account/storage snapshot

- Account ID: `dd107933ac970dac857f27cee7a7ff46`
- D1: `bas-metadata` (id dokumentált a fájlokban)
- KV namespace: `b6718ab359ac401bb24da7c34c24f11b`
- Worker inventory: ~20 db (cloudflare.md szerint)

---

## 4) Auth és token policy állapot

A `.env` több tokenformát tartalmaz párhuzamosan:
- `CLOUDFLARE_API_TOKEN=cfut_***`
- `CF_API_TOKEN=cfut_***`
- `CF_TOKEN=cfut_***`
- `CEAN_API_KEY=cean_***`

Kritikus észrevétel:
- `cfut_` token típus tipikusan tunnel/workflow jellegű; több API művelethez OAuth/API token szükséges lehet.
- Auth policy egyszerűsítése Phase 2/3 kötelező (single-source token stratégia).

---

## 5) Phase 2 readiness decision

**Döntés:** a "Domain routing terv véglegesítése" feladat teljesíthető volt, mert
- rendelkezésre álltak valós domain hostok,
- rendelkezésre álltak valós worker + tunnel URL-ek,
- és a route dokumentáció (cloudflareversup) már endpoint szintű képet adott.

Még nyitott (teszt/prod gate):
- tunnel fallback policy véglegesítése futó környezetben,
- domain-alapú task/chat smoke,
- auth header policy konszolidáció.
