# CF Durable Object Migrációk — Implementációs Terv

## Fázis 1: Kód elemzés
- [ ] `edge-coordinator.ts` átnézése — milyen állapotot kezel
- [ ] `swarmCoordinator.ts` átnézése — milyen adatot tárol

## Fázis 2: Migrations konfiguráció
- [ ] `cloudflare/wrangler.jsonc` → migrations blokk hozzáadása (EdgeCoordinator)
- [ ] `bas-cloudflare-orchestrator/wrangler.jsonc` → migrations blokk (SwarmCoordinator)

## Fázis 3: Lokális teszt
- [ ] `wrangler dev` → EdgeCoordinator DO működik
- [ ] `wrangler dev` → SwarmCoordinator DO működik

## Fázis 4: Deploy
- [ ] `wrangler deploy` mindkét worker-re
- [ ] CF Dashboard → Workers → DO ellenőrzés
- [ ] Swarm session teszt a production-ön
