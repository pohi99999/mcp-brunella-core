# CF Token Jogosultság Bővítés — Specifikáció

## Probléma
A `CLOUDFLARE_API_TOKEN` jelenleg Workers és D1 hozzáféréssel rendelkezik, de:
- **KV Storage**: `error 10000 — Authentication error` → kvCache.ts nem tud távoli KV-t használni
- **Vectorize**: `error 10000 — Authentication error` → vectorize.ts nem tudja az indexet kezelni
- **R2**: Külön kezelt (`CF_R2_ACCESS_KEY_ID` + `CF_R2_SECRET_ACCESS_KEY` megvan)

## Megoldás
1. CF Dashboard → API Tokens → Edit jelenlegi token
2. Jogosultságok hozzáadása:
   - `Account > Workers KV Storage > Edit`
   - `Account > Vectorize > Edit`
3. Vagy: új dedikált token generálás per-szolgáltatás (biztonságosabb)

## Érintett fájlok
- `src/utils/kvCache.ts` — KV távoli mód aktiválása token javítás után
- `src/utils/vectorize.ts` — Vectorize API hívások engedélyezése
- `.env` — Token frissítés ha új token generálódik

## Siker kritérium
- `wrangler kv namespace list` → sikeres válasz
- `wrangler vectorize list` → sikeres válasz
- kvCache.ts remote mód aktív
- vectorize.ts embed+query működik
