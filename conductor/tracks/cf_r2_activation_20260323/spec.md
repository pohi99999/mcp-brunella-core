# CF R2 Aktiválás — Specifikáció

## Probléma
- R2 **nem engedélyezett** a fiók szinten (wrangler error 10042)
- A `wrangler.jsonc` már tartalmazza az R2 konfigurációt: `vodor1` bucket, `Brunella-core` prefix
- R2 access key-ek (`CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`) már vannak a `.env`-ben
- S3 API endpoint is konfigurálva: `https://dd107933ac970dac...r2.cloudflarestorage.com`

## Megoldás
1. CF Dashboard → R2 → Enable (ingyenes tier: 10GB/hó, 1M Class A ops, 10M Class B ops)
2. `vodor1` bucket létrehozása (ha nem létezik automatikusan)
3. Validálás: `wrangler r2 bucket list`

## Ingyenes tier korlátok
- Storage: 10 GB/hó
- Class A operations (PUT, POST, LIST): 1M/hó
- Class B operations (GET): 10M/hó
- Egress: ingyenes (nincs bandwidth díj!)

## Érintett fájlok
- `bas-cloudflare-orchestrator/wrangler.jsonc` — R2_KNOWLEDGE binding (vodor1)
- `cloudflare/wrangler.jsonc` — Archív, de referencia R2 konfighoz
- `src/utils/kvCache.ts` — Később: R2-t is cache backend-ként használhatjuk

## Siker kritérium
- `wrangler r2 bucket list` → vodor1 megjelenik
- BAS Orchestrator Worker R2_KNOWLEDGE binding aktív
- Fájl feltöltés/letöltés teszt sikeres
