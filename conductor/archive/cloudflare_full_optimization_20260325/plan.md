# Plan — Cloudflare Full Optimization & Domain Rollout

## Phase 1 — Discovery & Contract Baseline (ACTIVE)
- [x] Track indítás és scope rögzítés.
- [x] Cloudflare endpoint inventory véglegesítése (backend + worker + dashboard + CLI).
- [x] Canonical endpoint contract első verzió elkészítése.
- [x] Env változók felelősségi mátrix validálása.

## Phase 2 — Domain & Tunnel Stabilizáció
- [x] Domain routing terv (prod/stage) véglegesítése.
- [x] Tunnel útvonalak és fallback policy pontosítása.
- [x] Chat sync és task routing domain-alapú / kanonikus host smoke validálása.
- [x] Cloudflare auth/header policy egységesítése.

## Phase 3 — Worker Konszolidáció
- [x] Orchestrator szerepkörök (task/chat/d1/browser) egyértelmű szétválasztása.
- [x] Duplikált endpointok visszavezetése kanonikus contractra.
- [x] Legacy worker route-ok deprecációs listája.
- [x] EdgeProxy + AgentManager URL/route konzisztencia.

## Phase 4 — Teljesítmény és Költségoptimalizálás

- [x] D1 query profil + index/join/batch optimalizációs baseline rögzítése.
- [x] KV cache policy (TTL + invalidáció) optimalizálási javaslatok rögzítése.
- [x] Vectorize használat és fallback tuning javaslatok rögzítése.
- [x] AI Gateway + Workers AI használati stratégia finomhangolási javaslatok rögzítése.

## Phase 5 — Migrációk és Élesítés

- [x] Releváns lokál/vegyes modulok edge migrációs sorrendje.
- [x] CI/CD deploy gate-ek frissítése (pre/post smoke) — acceptance evidence-ben rögzítve.
- [x] Domain / canonical host alapú end-to-end smoke teszt.
- [x] Záró dokumentáció + track státuszfrissítés.

## Definition of Done

- [x] Canonical Cloudflare contract publikálva.
- [x] Domain + tunnel + worker routing egységes és dokumentált.
- [x] Kritikus Cloudflare útvonalak validáltan működnek.
- [x] Minden releváns migrációs lépés priorizált és visszakövethető.

## Nyitott ops megjegyzés

- A custom-domain DNS zone eltérés külön follow-up trackbe került: `cloudflare_dns_zone_reconciliation_20260325`.
