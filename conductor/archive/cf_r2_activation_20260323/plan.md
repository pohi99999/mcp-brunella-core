# Végrehajtási Terv: Cloudflare R2 Object Storage Aktiválás

**Track ID:** `cf_r2_activation_20260323`
**Prioritás:** CRITICAL
**Becsült idő:** 20 perc

---

## Fázis 1: R2 engedélyezés a CF Dashboard-on

- [ ] Bejelentkezés: https://dash.cloudflare.com
- [ ] Navigálás a bal oldali menüben: **R2 Object Storage**
- [ ] **Enable R2** gomb megnyomása
- [ ] Fizetési adatok megerősítése (Free tier: 10 GB/hó ingyenes)
- [ ] R2 szolgáltatás státusz ellenőrzése a dashboard-on

## Fázis 2: Vodor1 bucket létrehozása

- [ ] Bucket létrehozás wrangler CLI-vel:
  ```bash
  wrangler r2 bucket create vodor1
  ```
- [ ] Alternatíva — ha a CLI nem működik, Dashboard-on:
  - [ ] R2 → **Create bucket** → Név: `vodor1` → Location: Auto
- [ ] Bucket lista ellenőrzés:
  ```bash
  wrangler r2 bucket list
  ```

## Fázis 3: Feltöltés/letöltés teszt

- [ ] Teszt fájl feltöltése:
  ```bash
  echo "BAS R2 Integration Test - $(date)" > /tmp/r2test.txt
  wrangler r2 object put vodor1/test/r2test.txt --file=/tmp/r2test.txt
  ```
- [ ] Teszt fájl letöltése és tartalom ellenőrzés:
  ```bash
  wrangler r2 object get vodor1/test/r2test.txt
  ```
- [ ] Teszt fájl törlése:
  ```bash
  wrangler r2 object delete vodor1/test/r2test.txt
  ```

## Fázis 4: Deploy verifikáció

- [ ] Wrangler deploy dry-run az R2 binding-gal:
  ```bash
  cd cloudflare && wrangler deploy --dry-run
  ```
- [ ] Ellenőrzés: az `R2_KNOWLEDGE` binding sikeresen feloldódik
- [ ] Track státusz frissítése: `progress: 100`, `status: "done"`

---

## Sikerkritérium

- Az R2 szolgáltatás aktív a CF fiókon
- A `vodor1` bucket létezik és elérhető
- A feltöltés/letöltés műveletek sikeresen végrehajthatók
- A `wrangler deploy --dry-run` az R2 binding-gal együtt sikeres
