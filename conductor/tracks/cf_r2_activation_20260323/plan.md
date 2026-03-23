# CF R2 Aktiválás — Implementációs Terv

## Fázis 1: R2 engedélyezés (manuális — CF Dashboard)
- [ ] dash.cloudflare.com → R2 Object Storage → Enable
- [ ] Fizetési mód megerősítése (ingyenes tier, kártya szükséges)

## Fázis 2: Bucket létrehozás
- [ ] `npx wrangler r2 bucket create vodor1`
- [ ] `npx wrangler r2 bucket list` → ellenőrzés

## Fázis 3: Worker binding validálás
- [ ] `wrangler deploy` a bas-orchestrator-nak az R2 binding-gal
- [ ] Worker logok ellenőrzése: R2_KNOWLEDGE elérhető

## Fázis 4: S3 API validálás
- [ ] S3-kompatibilis endpoint teszt (`CF_R2_ACCESS_KEY_ID` + `CF_R2_SECRET_ACCESS_KEY`)
- [ ] Fájl feltöltés és letöltés a `Brunella-core/` prefix alá

## Fázis 5: Integrációs teszt
- [ ] Node.js-ből R2 elérés az S3 API-n keresztül
- [ ] Worker-ből R2 elérés a binding-on keresztül
