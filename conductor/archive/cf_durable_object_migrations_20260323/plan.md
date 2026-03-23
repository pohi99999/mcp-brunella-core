# Végrehajtási Terv: Durable Object Migrations Konfiguráció

**Track ID:** `cf_durable_object_migrations_20260323`
**Prioritás:** HIGH
**Becsült idő:** 10 perc

---

## Fázis 1: Wrangler.jsonc szerkesztése

- [ ] A `cloudflare/wrangler.jsonc` fájl megnyitása
- [ ] A `migrations` tömb hozzáadása a gyökér objektumhoz:
  ```jsonc
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["EdgeCoordinator"]
    }
  ]
  ```
- [ ] JSON szintaxis ellenőrzés (JSONC kommentekkel kompatibilis parser)

## Fázis 2: Lokális validálás

- [ ] Wrangler dry-run futtatás:
  ```bash
  cd cloudflare && wrangler deploy --dry-run
  ```
- [ ] Ellenőrzés: NEM jelenik meg a `WARNING: No migrations defined` figyelmeztetés
- [ ] Ellenőrzés: Nincs más hiba vagy figyelmeztetés

## Fázis 3: Deploy és verifikáció

- [ ] Deploy a Cloudflare-re:
  ```bash
  cd cloudflare && wrangler deploy
  ```
- [ ] EdgeCoordinator DO health check:
  ```bash
  curl https://bas-orchestrator.workers.dev/coordinator/health
  ```
- [ ] DO példány létrehozás és válasz ellenőrzés

## Fázis 4: Dokumentáció és lezárás

- [ ] `cloudflare/wrangler.jsonc` változás commitolása
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`
- [ ] Megjegyzés: Jövőbeli DO módosításoknál új migration tag szükséges

---

## Sikerkritérium

- A `wrangler deploy --dry-run` figyelmeztetés nélkül lefut
- Az `EdgeCoordinator` Durable Object sikeresen deploy-olva van
- A DO health check endpoint válaszol
