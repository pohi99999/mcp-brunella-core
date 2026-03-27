# Spec — Cloudflare DNS Zone Reconciliation for Custom Domains

## Cél
Feloldani a dokumentált és a ténylegesen elérhető Cloudflare zóna közti eltérést, hogy a custom domain hostok (`api.bas.*`, `browser-use.bas.*`, `n8n.bas.*`) DNS-szinten is konzisztensen működjenek.

## Megfigyelt állapot
- A tunnel és worker auth működik.
- A `bas-tunnel` named tunnel futtatható és csatlakozik a Cloudflare edge-hez.
- A `cloudflared tunnel route dns bas-tunnel api.bas.peterpohanka.com` parancs `Authentication error (code 10000)` hibával megáll.
- A Cloudflare global API key-jel lekérdezhető zónák között jelenleg `pohankaestarsa.com` látható, miközben a projekt-dokumentáció `peterpohanka.com` domaint tekinti kanonikusnak.

## Scope
1. Valós domain ownership és Cloudflare zone ownership tisztázása.
2. A helyes zone-hoz tartozó DNS auth helyreállítása.
3. `api.bas`, `browser-use.bas`, `n8n.bas` rekordok létrehozása vagy javítása.
4. Domain-health validáció a named tunnel mögött.

## Acceptance Criteria
- [ ] A helyes Cloudflare zone azonosítva és dokumentálva.
- [ ] A szükséges CNAME rekordok létrehozva / javítva.
- [ ] `api.bas.<domain>` health zöld.
- [ ] A Brunella dokumentáció a valós zone állapotot tükrözi.