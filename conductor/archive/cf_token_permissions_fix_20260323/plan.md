# Végrehajtási Terv: Cloudflare API Token Jogosultság Bővítés

**Track ID:** `cf_token_permissions_fix_20260323`
**Prioritás:** CRITICAL
**Becsült idő:** 15 perc

---

## Fázis 1: CF Dashboard navigáció

- [ ] Bejelentkezés a Cloudflare Dashboard-ba: https://dash.cloudflare.com
- [ ] Navigálás: **My Profile** → **API Tokens**
- [ ] A jelenlegi BAS token azonosítása (a `.env` `CLOUDFLARE_API_TOKEN` alapján)

## Fázis 2: Token jogosultság bővítés

- [ ] A token melletti **Edit** gomb megnyomása
- [ ] Új jogosultságok hozzáadása:
  - [ ] **Account** → **Workers KV Storage** → **Edit**
  - [ ] **Account** → **Vectorize** → **Edit**
  - [ ] **Account** → **R2 Storage** → **Edit**
- [ ] **Continue to summary** → **Update Token**
- [ ] ⚠️ Ha a token nem szerkeszthető: új token létrehozása az összes szükséges jogosultsággal

## Fázis 3: Környezeti változó frissítés

- [ ] Ha új token készült: `.env` fájl frissítése az új `CLOUDFLARE_API_TOKEN` értékkel
- [ ] Ha CI/CD-ben is használjuk: GitHub Secrets frissítése

```bash
# .env frissítés (csak ha új token!)
# CLOUDFLARE_API_TOKEN=<új_token_értéke>
```

## Fázis 4: Verifikáció

- [ ] KV Storage teszt:
  ```bash
  wrangler kv namespace list
  ```
- [ ] Vectorize teszt:
  ```bash
  wrangler vectorize list
  ```
- [ ] R2 teszt:
  ```bash
  wrangler r2 bucket list
  ```
- [ ] Teljes deploy dry-run:
  ```bash
  cd cloudflare && wrangler deploy --dry-run
  ```
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

Minden wrangler parancs hiba nélkül lefut, és a `wrangler deploy --dry-run` sikeresen validálja az összes binding-ot.
