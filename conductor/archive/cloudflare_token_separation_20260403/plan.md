# Cloudflare Token Separation Track

## Cél
A Cloudflare API tokenek és Account ID-k szétválasztása a BAS (Brunella Agent System) és a személyes Cloudflare account között, hogy a rendszer csak a BAS Workers/KV/D1/R2 erőforrásaihoz férjen hozzá.

## Probléma
- Jelenlegi `.env`: `CLOUDFLARE_ACCOUNT_ID` és `CLOUDFLARE_API_TOKEN` — egyetlen token mindkettőhöz
- Ha a BAS kompromittálódik, a személyes CF account is veszélyben van
- A token scope nem minimális (teljes account hozzáférés vs. csak Workers/KV/D1/R2)
- `.vscode/mcp.json` cloudflare szerver ugyanezt a tokent használja

## Javasolt Változók

```env
# Személyes Cloudflare account (DNS, Pages, egyéb)
CF_PERSONAL_ACCOUNT_ID=...
CF_PERSONAL_API_TOKEN=...      # Scope: Zone:Read, DNS:Edit

# BAS-specifikus Cloudflare account/sub-account
CF_BAS_ACCOUNT_ID=...
CF_BAS_API_TOKEN=...           # Scope: Workers:Edit, KV:Edit, D1:Edit, R2:Edit
```

## Megoldási Terv

### 1. Fázis: Token Audit (1 óra)
- [ ] Felsorolni az összes helyet ahol `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_API_TOKEN` használva van
- [ ] Ellenőrizni: `src/`, `myai/`, `scripts/`, `.vscode/mcp.json`, CI workflows
- [ ] Azonosítani melyik kód melyik account-ot igényli

### 2. Fázis: Környezeti Változók Refaktor (2-3 óra)
- [ ] `.env.example` frissítése az új változókkal
- [ ] `src/core/cloudflare*.ts` fájlok frissítése
- [ ] `myai/` Python kód frissítése
- [ ] `.vscode/mcp.json` cloudflare szerver env mapping frissítése
- [ ] CI/CD workflows frissítése (secrets rename)

### 3. Fázis: Token Létrehozás Dokumentáció (30 perc)
- [ ] `docs/cloudflare/TOKEN_SETUP.md` — lépésről lépésre útmutató
  - Cloudflare Dashboard → My Profile → API Tokens → Create Token
  - BAS token scope: Workers Scripts:Edit, Workers KV Storage:Edit, D1:Edit, R2:Edit
  - Personal token scope: minimális (csak ami kell)

### 4. Fázis: Validáció (30 perc)
- [ ] Health check script ellenőrzi mindkét tokent
- [ ] `.github/workflows/ci.yml` — titkosított secrets, megfelelő neveken

## Elfogadási Kritérium
- `CF_BAS_ACCOUNT_ID` és `CF_BAS_API_TOKEN` — BAS Workers/KV/D1/R2 hozzáférés
- Nincs kereszthivatkozás a személyes account tokenjébe
- `docs/cloudflare/TOKEN_SETUP.md` létezik és naprakész
- Health check megkülönbözteti a két token státuszát

## Biztonsági Megjegyzés
Ez security-érzékeny feladat — token rotáció és scope-szűkítés szükséges.
Ne commitolj valós token értékeket, csak `.env.example` placeholdereket!

## Érintett Fájlok
- `.env` / `.env.example`
- `src/core/bifrost_gateway.ts`
- `src/server/routes/cloudflare*.ts`
- `.vscode/mcp.json`
- `.github/workflows/ci.yml`
- `.github/workflows/docker-publish.yml`
- `docs/cloudflare/TOKEN_SETUP.md` (új)
