# Specifikáció: Cloudflare API Token Jogosultság Bővítés

**Track ID:** `cf_token_permissions_fix_20260323`
**Prioritás:** CRITICAL
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-03-23

---

## 1. Probléma Leírás

A jelenlegi `CLOUDFLARE_API_TOKEN` jogosultságai nem elegendőek a BAS rendszer teljes Cloudflare integrációjához.
A token jelenleg kizárólag **D1 Database** és **Workers** erőforrásokhoz rendelkezik hozzáféréssel.

### Érintett API hívások, amelyek hibát adnak

A következő wrangler parancsok **authentication error (10000)** hibakóddal térnek vissza:

```bash
# KV Storage - 10000 Authentication error
wrangler kv namespace list
# Válasz: "Authentication error [code: 10000]"

# Vectorize - 10000 Authentication error
wrangler vectorize list
# Válasz: "Authentication error [code: 10000]"

# R2 Storage - 10000 Authentication error
wrangler r2 bucket list
# Válasz: "Authentication error [code: 10000]"
```

### Jelenlegi token jogosultságok

| Erőforrás | Jogosultság | Státusz |
|-----------|-------------|---------|
| Workers Scripts | Edit | ✅ Működik |
| D1 Database | Edit | ✅ Működik |
| KV Storage | - | ❌ Hiányzik |
| Vectorize | - | ❌ Hiányzik |
| R2 Storage | - | ❌ Hiányzik |

### Hatás a rendszerre

- **KV Storage:** A `bas-cloudflare-orchestrator` Worker nem tud KV namespace-eket kezelni, így a session storage és cache nem működik.
- **Vectorize:** A szemantikus keresés (RAG pipeline) nem érhető el a Cloudflare edge-en.
- **R2:** Az artifact tárolás, screenshotok és logok nem menthetők R2-be.

A `cloudflare/wrangler.jsonc` fájlban már definiálva vannak a KV, Vectorize és R2 binding-ok, de a token hiányzó jogosultságai miatt nem deploy-olhatók.

---

## 2. Megoldás

Két lehetséges megközelítés:

### 2.1 Meglévő token bővítése (ajánlott)

1. Navigálás: CF Dashboard → My Profile → API Tokens
2. A `BAS-Worker-Token` (vagy hasonló nevű) token szerkesztése
3. További jogosultságok hozzáadása:
   - **Account** → **Workers KV Storage** → **Edit**
   - **Account** → **Vectorize** → **Edit**
   - **Account** → **R2 Storage** → **Edit**

### 2.2 Új token létrehozása (alternatíva)

Ha a meglévő token nem szerkeszthető, új token létrehozása a következő jogosultságokkal:

| Scope | Erőforrás | Jogosultság |
|-------|-----------|-------------|
| Account | Workers Scripts | Edit |
| Account | D1 Database | Edit |
| Account | Workers KV Storage | Edit |
| Account | Vectorize | Edit |
| Account | R2 Storage | Edit |
| Account | Workers Routes | Edit |

---

## 3. Verifikáció

A javítás után a következő parancsoknak sikeresen kell futniuk:

```bash
# KV Storage ellenőrzés
wrangler kv namespace list
# Elvárt: JSON tömb a namespace-ekkel (lehet üres: [])

# Vectorize ellenőrzés
wrangler vectorize list
# Elvárt: Index lista (lehet üres)

# R2 ellenőrzés
wrangler r2 bucket list
# Elvárt: Bucket lista (lehet üres)

# Teljes deploy teszt
cd cloudflare && wrangler deploy --dry-run
# Elvárt: Sikeres dry-run minden binding-gal
```

### Elvárt végállapot

| Erőforrás | Jogosultság | Státusz |
|-----------|-------------|---------|
| Workers Scripts | Edit | ✅ |
| D1 Database | Edit | ✅ |
| KV Storage | Edit | ✅ |
| Vectorize | Edit | ✅ |
| R2 Storage | Edit | ✅ |

---

## 4. Kockázatok

- **Token csere esetén** az összes CI/CD pipeline-ban és `.env` fájlban frissíteni kell az értéket.
- **R2 aktiválás** külön szükséges (lásd: `cf_r2_activation_20260323` track).
- A token scope bővítés **nem igényel** worker újratelepítést, csak az API hívások válnak elérhetővé.

---

## 5. Kapcsolódó fájlok

- `cloudflare/wrangler.jsonc` — KV, Vectorize, R2 binding definíciók
- `.env` — `CLOUDFLARE_API_TOKEN` értéke
- `cloudflare/src/index.ts` — Worker főmodul, amely használja a binding-okat
