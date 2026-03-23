# CF Token Jogosultság Bővítés — Implementációs Terv

## Fázis 1: Token audit (manuális — CF Dashboard)
- [ ] Belépés: dash.cloudflare.com → Account → API Tokens
- [ ] Jelenlegi token jogosultságok listázása
- [ ] KV Storage Edit jogosultság hozzáadása
- [ ] Vectorize Edit jogosultság hozzáadása

## Fázis 2: Validálás (CLI)
- [ ] `npx wrangler kv namespace list` → siker
- [ ] `npx wrangler vectorize list` → siker
- [ ] `npx wrangler r2 bucket list` → siker (R2 aktiválás után)

## Fázis 3: .env frissítés (ha új token)
- [ ] Régi token archiválása
- [ ] Új token beírása `.env` fájlba
- [ ] Rendszer újraindítás és smoke test

## Fázis 4: Integrációs teszt
- [ ] kvCache.ts → remote KV get/set teszt
- [ ] vectorize.ts → embed + query teszt
- [ ] Dashboard ellenőrzés
