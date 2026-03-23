# Specifikáció: Cloudflare R2 Object Storage Aktiválás

**Track ID:** `cf_r2_activation_20260323`
**Prioritás:** CRITICAL
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Probléma Leírás

Az R2 Object Storage nincs aktiválva a Cloudflare fiókon. Minden R2-vel kapcsolatos wrangler parancs hibaüzenetet ad.

### Hibaüzenet

```bash
wrangler r2 bucket list
# Hiba: "Please enable R2 first: https://dash.cloudflare.com/..."
# Error code: 10042
```

### Wrangler konfiguráció (már meglévő)

A `cloudflare/wrangler.jsonc` fájlban az R2 binding már definiálva van:

```jsonc
{
  "r2_buckets": [
    {
      "binding": "R2_KNOWLEDGE",
      "bucket_name": "vodor1"
    }
  ]
}
```

Ez azt jelenti, hogy a Worker kód (`cloudflare/src/index.ts`) már tartalmaz R2 hivatkozásokat, de a deploy sikertelen, mert az R2 szolgáltatás nincs engedélyezve a fiókon.

### Hatás a rendszerre

- A `wrangler deploy` parancs meghiúsul az R2 binding miatt
- Az artifact tárolás (screenshotok, logok, generált kód) nem lehetséges
- A Knowledge Base fájlok nem tölthetők fel az edge-re
- A `cf_r2_artifact_storage_20260323` track blokkolva van

---

## 2. Háttér

Az R2 a Cloudflare S3-kompatibilis objektumtárolója. Főbb jellemzők:

- **S3-kompatibilis API** — meglévő S3 SDK-kkal használható
- **Nincs egress díj** — adatkiolvasás ingyenes
- **Workers integráció** — natív binding-ok Workers-ben
- **10 GB ingyenes** — havonta 10 GB tárhely a Free tier-ben

### BAS felhasználási területek

| Terület | Leírás |
|---------|--------|
| Knowledge Base | RAG pipeline dokumentumok tárolása |
| Agent Artifacts | Futási eredmények, logok |
| Screenshotok | RobotkezV2 böngésző képernyőképek |
| Generált Kód | Agent által készített kódfájlok |
| Golden Dataset | Minőségbiztosítási teszt adatok |

---

## 3. Megoldás

### 3.1 R2 engedélyezése

1. Navigálás: CF Dashboard → **R2 Object Storage**
2. Az **Enable R2** gomb megnyomása
3. Fizetési adatok megerősítése (Free tier-en belül nincs költség)

### 3.2 Vodor1 bucket létrehozása

A bucket létrehozható a dashboard-on vagy CLI-vel:

```bash
# CLI-vel (ajánlott)
wrangler r2 bucket create vodor1

# Ellenőrzés
wrangler r2 bucket list
```

### 3.3 Bucket struktúra tervezés

```
vodor1/
├── knowledge/          # RAG dokumentumok
│   ├── markdown/
│   └── embeddings/
├── artifacts/          # Agent futási eredmények
│   └── {agent_id}/{run_id}/
├── screenshots/        # Böngésző képernyőképek
│   └── {date}/{task_id}/
├── code/               # Generált kódfájlok
│   └── {track_id}/
└── logs/               # Archivált logok
    └── {date}/
```

---

## 4. Verifikáció

```bash
# R2 engedélyezés ellenőrzése
wrangler r2 bucket list
# Elvárt: Bucket lista megjelenik (tartalmazza: vodor1)

# Bucket létezés ellenőrzése
wrangler r2 bucket list | grep vodor1
# Elvárt: "vodor1" sor megjelenik

# Teszt feltöltés
echo "BAS R2 Test" > /tmp/r2test.txt
wrangler r2 object put vodor1/test/r2test.txt --file=/tmp/r2test.txt
# Elvárt: Sikeres feltöltés

# Teszt letöltés
wrangler r2 object get vodor1/test/r2test.txt
# Elvárt: "BAS R2 Test" tartalom

# Deploy dry-run (R2 binding-gal)
cd cloudflare && wrangler deploy --dry-run
# Elvárt: Sikeres, R2_KNOWLEDGE binding feloldva
```

---

## 5. Kockázatok

- Az R2 engedélyezéséhez **fizetési mód** szükséges lehet a CF fiókon (még Free tier esetén is).
- A `vodor1` bucket név foglalt lehet — ebben az esetben alternatív nevet kell választani és a `wrangler.jsonc`-t frissíteni.
- Az R2 API token jogosultság külön track-ben kezelendő (`cf_token_permissions_fix_20260323`).

---

## 6. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — R2 bucket binding definíció
- `cloudflare/src/index.ts` — Worker R2 binding használat
- `conductor/tracks/cf_r2_artifact_storage_20260323/` — Függő track (R2 alapú artifact tárolás)
- `conductor/tracks/cf_token_permissions_fix_20260323/` — Token jogosultság (R2 Edit szükséges)
