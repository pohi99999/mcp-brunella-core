# CF Durable Object Migrációk — Specifikáció

## Probléma
- Az `EdgeCoordinator` DO definiálva van `cloudflare/wrangler.jsonc`-ben
- A `SwarmCoordinator` DO definiálva van `bas-cloudflare-orchestrator/wrangler.jsonc`-ben
- **Hiányzik**: migrations konfiguráció mindkettőből → SQLite-alapú állapotkezelés nem elérhető

## Megoldás
Migrations blokk hozzáadása a wrangler.jsonc fájlokhoz:

### cloudflare/wrangler.jsonc
```json
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["EdgeCoordinator"]
  }
]
```

### bas-cloudflare-orchestrator/wrangler.jsonc
```json
"migrations": [
  {
    "tag": "v1",
    "new_sqlite_classes": ["SwarmCoordinator"]
  }
]
```

## Érintett fájlok
- `cloudflare/wrangler.jsonc` — EdgeCoordinator migration
- `bas-cloudflare-orchestrator/wrangler.jsonc` — SwarmCoordinator migration
- `cloudflare/src/edge-coordinator.ts` — Ellenőrizni: SQLite API használata
- `bas-cloudflare-orchestrator/src/swarmCoordinator.ts` — Ellenőrizni: SQLite API használata

## Siker kritérium
- `wrangler deploy` sikeres mindkét worker-re
- DO-k SQLite állapotot tudnak kezelni
- SwarmCoordinator session-ök perzisztensek maradnak
