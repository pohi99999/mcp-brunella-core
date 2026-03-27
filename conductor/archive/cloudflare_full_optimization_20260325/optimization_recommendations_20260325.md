# Optimization Recommendations — 2026-03-25

## D1

- A `tasks` tábla és indexei most már élesben is léteznek (`0000_schema.sql`).
- A `POST /d1/query` bridge él, így az operatív olvasások központosíthatók ugyanazon a worker contracton.
- Következő lépésként javasolt:
  - task státusz szerinti lekérdezések monitorozása,
  - `history` paginációs plafon bevezetése,
  - lassú query log minták mentése külön ops dokumentumba.

## KV cache

- A Node oldali KV adapter most már kanonikus Cloudflare URL-feloldót használ.
- Következő lépésként javasolt:
  - namespace-szintű TTL policy táblázat,
  - prefix-alapú invalidációk mérőszámozása.

## Workers AI / chat routing

- A HTML false-positive kivédésével stabilabb lett a fallback lánc.
- Következő lépésként javasolt:
  - endpointonkénti success/fallback telemetry,
  - `/ai/generate` vs `/chat/messages` használati arány figyelése.

## Tunnel / fallback

- A named tunnel connector bizonyítottan feláll, de a custom domain DNS binding külön ops auth függőség.
- Következő lépésként javasolt:
  - Cloudflare DNS route audit a `cloudflare_dns_zone_reconciliation_20260325` trackben,
  - domain health ellenőrzés CI post-deploy gate-be emelve.