# Specifikáció: Durable Object Migrations Konfiguráció

**Track ID:** `cf_durable_object_migrations_20260323`
**Prioritás:** HIGH
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Probléma Leírás

A `wrangler deploy` parancs figyelmeztetést ad, mert az `EdgeCoordinator` Durable Object osztályhoz nem tartozik migration bejegyzés a `wrangler.jsonc` fájlban.

### Wrangler figyelmeztetés

```
⚠️  WARNING: No migrations defined for Durable Object class "EdgeCoordinator".
   Without migrations, Durable Objects may not function correctly.
   Please add a migrations entry to your wrangler configuration.
   See: https://developers.cloudflare.com/durable-objects/reference/migrations/
```

### Jelenlegi wrangler.jsonc konfiguráció

A `cloudflare/wrangler.jsonc` fájlban a Durable Object binding definiálva van, de a migrations tömb hiányzik:

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "EDGE_COORDINATOR",
        "class_name": "EdgeCoordinator"
      }
    ]
  }
  // ❌ Hiányzik: "migrations" tömb
}
```

### Mi az a Durable Object Migration?

A Durable Objects migration rendszer biztosítja, hogy a Cloudflare infrastruktúra tudja:
- Melyik osztályok léteznek
- Mikor lettek bevezetve
- Milyen storage backend-et használnak (KV vagy SQLite)

Migration nélkül:
- A DO osztály nem példányosítható
- A `fetch()` és `alarm()` handlerek nem hívhatók meg
- A belső SQLite storage nem érhető el

---

## 2. Az EdgeCoordinator osztály

Az `EdgeCoordinator` a BAS rendszer edge-oldali koordinátora, amely:

- **Session kezelés:** Egyedi user session-öket tart karban
- **Task routing:** Feladatokat irányít a megfelelő Worker-ekhez
- **Állapot tárolás:** SQLite-alapú tartós állapotot kezel
- **WebSocket:** Valós idejű kommunikáció a dashboard-dal

### Forrásfájl

```typescript
// cloudflare/src/edge-coordinator.ts
import { DurableObject } from "cloudflare:workers";

export class EdgeCoordinator extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    // Session és task routing logika
  }

  async alarm(): Promise<void> {
    // Időzített feladatok (health check, cleanup)
  }
}
```

---

## 3. Megoldás

A `cloudflare/wrangler.jsonc` fájlba fel kell venni a `migrations` tömböt:

### Szükséges konfiguráció változás

```jsonc
{
  "durable_objects": {
    "bindings": [
      {
        "name": "EDGE_COORDINATOR",
        "class_name": "EdgeCoordinator"
      }
    ]
  },
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["EdgeCoordinator"]
    }
  ]
}
```

### Miért `new_sqlite_classes`?

- Az `EdgeCoordinator` SQLite-alapú tárolást használ (nem régi KV-alapút)
- A `new_sqlite_classes` biztosítja, hogy a DO példány SQLite storage-ot kapjon
- Ez az ajánlott modern megközelítés a Cloudflare dokumentáció szerint

### Alternatívák (nem ajánlott)

```jsonc
// ❌ Régi KV-alapú storage (NEM ajánlott új DO-hoz)
{
  "tag": "v1",
  "new_classes": ["EdgeCoordinator"]
}

// ❌ Létező osztály konvertálása (csak migrációnál)
{
  "tag": "v2",
  "renamed_classes": [
    { "from": "OldName", "to": "EdgeCoordinator" }
  ]
}
```

---

## 4. Verifikáció

```bash
# 1. Wrangler konfiguráció validálás
cd cloudflare && wrangler deploy --dry-run
# Elvárt: NEM jelenik meg migration figyelmeztetés

# 2. Tényleges deploy (staging)
wrangler deploy --env staging
# Elvárt: Sikeres deploy, EdgeCoordinator regisztrálva

# 3. DO példány teszt
curl https://bas-orchestrator.staging.workers.dev/coordinator/health
# Elvárt: {"status": "ok", "class": "EdgeCoordinator"}
```

---

## 5. Jövőbeli migrációk

Ha az `EdgeCoordinator` osztályt módosítjuk (átnevezés, törlés), új migration bejegyzést kell hozzáadni:

```jsonc
{
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["EdgeCoordinator"]
    },
    {
      "tag": "v2",
      "renamed_classes": [
        { "from": "EdgeCoordinator", "to": "EdgeCoordinatorV2" }
      ]
    }
  ]
}
```

A migration tag-eknek egyedinek és növekvőnek kell lenniük.

---

## 6. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — Módosítandó konfiguráció
- `cloudflare/src/edge-coordinator.ts` — EdgeCoordinator DO osztály
- `cloudflare/src/index.ts` — Worker entry point, DO binding export
