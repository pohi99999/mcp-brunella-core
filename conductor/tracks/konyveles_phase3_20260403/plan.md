# Könyvelés — Phase 3 (Track: konyveles_phase3_20260403)

## Goal
Provide a Phase 3 skeleton that wires invoice ingestion (IMAP), basic refinement, and a placeholder Szamlazz client for downstream integration and QA.

## Steps
1. Create feature branch:
   ```bash
   git checkout -b feature/konyveles_phase3_skeleton
   ```
2. Add stubs: Szamlazz client, IMAP fetcher stub, refine endpoint, n8n workflow export.
3. Run Python unit tests under `myai/`:
   ```bash
   cd myai
   pytest -q
   ```
4. Push branch and open PR for review.

## PR checklist (short)
- [ ] Branch created and pushed
- [ ] `cd myai && pytest` passes locally
- [ ] n8n workflow attached in PR as JSON

## Next steps after merge
- Implement real IMAP fetching, robust attachment parsing
- Wire Szamlazz client to production endpoint and credential handling
- Add integration tests that exercise the full pipeline
# Végrehajtási Terv: Könyvelési Automatizálás Phase 3

**Track ID:** `konyveles_phase3_20260403`
**Becsült idő:** Phase 0: 1 nap · Phase 3a: 4 nap · 3b: 3 nap · 3c: 3 nap · 3d: 2 nap
**Utolsó audit:** 2026-04-03

> A phase0 readiness lepes kulon follow-up trackben lezarva es archiválva: `konyveles_phase3_readiness_20260405`.

---

## ✅ MÁR MEGÉPÍTVE (n8n_konyveles_pipeline_20260328-ban)

> Ezeket NEM kell újra megcsinálni — csak hivatkozni rájuk.

- ✅ `BankAgent.ts` — CSV parser (de sample CSV-re mutat!)
- ✅ `NavAgent.ts` — struktúra kész, **100% MOCK** → Phase 3b-ben cserélendő
- ✅ `MatchingAgent.ts` — heurisztikus egyeztetés, működik
- ✅ `bookkeeping_db.ts` — SQLite séma és CRUD
- ✅ `src/server/routes/bookkeeping.ts` — `/api/v1/bookkeeping/*` végpontok
- ✅ `src/tools/getSzamlazzInvoices.ts` — MCP tool (de SzamlazzHuAgent nincs!)
- ✅ `SzamlazzHuAgent.ts` — Számlázz.hu fetch/sync agent (zero-touch happy path scaffold)
- ✅ n8n WF-1..WF-5 scaffoldok importálva n8n-ben
- ✅ Google Sheets service account + `myai/clients/google_sheets_client.py`
- ✅ `test/e2e/n8n-konyveles-wf5.spec.ts` — Playwright E2E

---

## Phase 0 — Credential és .env Előkészítés (1 nap) ⛔ BLOKKOLÓ

> Ez a legfontosabb lépés. Nélküle a többi fázis nem indulhat.

### 0.1 szamlazz.hu credential

- [ ] szamlazz.hu fiókba belépés → Beállítások → API → agentkulcs ellenőrzése (él-e?)
- [ ] `.env` bővítése:

  ```env
  SZAMLAZZ_HU_API_KEY=<agentkulcs>
  SZAMLAZZ_HU_BANK_ACCOUNT=<bankszámlaszám pl. 12345678-12345678-12345678>
  SZAMLAZZ_HU_TAX_NUMBER=<adószám pl. 12345678-2-12>
  ```

- [ ] Teszt hívás: `curl -X POST https://www.szamlazz.hu/szamla/ -d "action=szamla_agent_check&..."`

### 0.2 NAV Online Számla API credential

- [ ] NAV Online Számla regisztrációs oldalon technikai felhasználó ellenőrzése
- [ ] `.env` bővítése:

  ```env
  NAV_USERNAME=<technikai felhasználónév>
  NAV_PASSWORD=<jelszó>
  NAV_SIGNING_KEY=<aláírókulcs>
  NAV_EXCHANGE_KEY=<cserekulcs>
  NAV_BASE_URL=https://api.onlineszamla.nav.gov.hu/invoiceService/v3
  ```

- [ ] Ha nincs hozzáférés: NavAgent mock marad, Phase 3b csak részlegesen teljesíthető

### 0.3 Gmail IMAP credential

- [ ] Gmail fiókban App Password generálása (ha 2FA be van kapcsolva)
  - Google Fiók → Biztonság → Alkalmazásszintű jelszavak → "n8n IMAP"
- [ ] n8n-be importálás: Credential → IMAP → `imap.gmail.com:993`
- [ ] `.env` bővítése (dokumentáció célra):

  ```env
  GMAIL_IMAP_USER=<email>
  GMAIL_APP_PASSWORD=<app-jelszó>
  ```


### 0.4 Bank CSV éles path

- [x] `mkdir -p data/bank-imports/` mappa létrehozása
- [x] `.gitignore` bővítése: `data/bank-imports/*.csv` (már jelen volt a repo-ban)
- [x] `BankAgent.ts` 20. sor javítása: sample CSV path → `data/bank-imports/OTP_export_sample.csv.example`
- [x] `data/bank-imports/OTP_export_sample.csv.example` minta fájl hozzáadása

---

## Phase 3a — szamlazz.hu + WF-6 (4 nap)

### 3a.1 Előkészítés

- [ ] `.env` bővítése: `SZAMLAZZ_HU_API_KEY`, `SZAMLAZZ_HU_BANK_ACCOUNT`, `SZAMLAZZ_HU_TAX_NUMBER`
- [ ] `data/bank-imports/` mappa létrehozása
- [ ] `.gitignore` frissítése: `data/bank-imports/*.csv`
- [ ] szamlazz.hu teszt hozzáférés ellenőrzése (agentkulcs él-e?)

### 3a.2 WF-6 workflow scaffold

- [ ] `n8n-workflows/wf6-szamlazz-kuldas.json` létrehozása scaffold-ként
- [ ] Import n8n-be
- [ ] HTTP Request node konfigurálása (szamlazz.hu API endpoint)
- [ ] XML payload builder Function node
- [ ] Sikeres ág → BAS PATCH `/api/v1/bookkeeping/status`
- [ ] Hiba ág → WF-4

### 3a.3 BAS oldal

- [x] `SzamlazzHuAgent` trigger esemény hozzáadása (vagy meglévő InvoiceAutomation bővítése)
- [x] `POST /api/v1/invoice/create` endpoint ellenőrzése/létrehozása

### 3a.4 Teszt

- [ ] Teszt számla küldése WF-6 webhook-on → szamlazz.hu-n megjelenik
- [ ] Playwright E2E teszt: `test/e2e/n8n-konyveles-wf6.spec.ts`

---

## Phase 3b — WF-7 IMAP + WF-8 NAV (3 nap)

### 3b.1 WF-7 IMAP Email Intake (Live)

- [ ] Gmail IMAP credential n8n-ben (OAuth2 vagy App Password)
- [ ] WF-1 IMAP trigger node konfigurálása
- [ ] Filter: subject tartalmaz `számla|invoice|szla`
- [ ] Csatolmány mentése `data/inbox/<timestamp>_<filename>`
- [ ] EmailAgent hívás node konfigurálása
- [ ] Teszt email küldése → feldolgozás ellenőrzése

### 3b.2 WF-8 NAV XML Live

- [ ] NAV Online Számla API hozzáférési adatok `.env`-be
- [ ] n8n HTTP Request node: NAV API endpoint
- [ ] XML tanúsítvány kezelés (base64 encoding Function node)
- [ ] NavAgent csere: mock → live NAV API
- [ ] Teszt: valódi számla egytlen validáció

---

## Phase 3c — WF-9 Report + Bank CSV (3 nap)

### 3c.1 WF-9 Napi Report Email

- [ ] `n8n-workflows/wf9-report-email.json` scaffold
- [ ] Cron: hétfõ 08:00
- [ ] BAS `/api/v1/bookkeeping/status` lekérés
- [ ] Google Sheets összesítő (gspread Python bridge vagy n8n Sheets node)
- [ ] HTML sablon (Jinja2 vagy n8n Code node)
- [ ] SMTP küldés (WF-4 credential újrahasználatával)
- [ ] Teszt: manuális trigger → email megérkezett

### 3c.2 Bank CSV watch élesítés

- [ ] WF-2 file watch node: `data/bank-imports/*.csv`
- [ ] Cron backup: 08:00 naponta (ha file watch nem trigger)
- [x] Minta CSV: `data/bank-imports/OTP_export_sample.csv.example` (repo-side sample; valós CSV marad gitignored)
- [ ] Végponttól végpontig teszt: CSV elhelyezés → MatchingAgent → Sheets szinkron

---

## Phase 3d — E2E + Hardening (2 nap)

### 3d.1 Playwright E2E bővítés

- [ ] `test/e2e/n8n-konyveles-wf6.spec.ts` — szamlazz.hu webhook
- [ ] `test/e2e/n8n-konyveles-wf7.spec.ts` — IMAP intake validáció
- [ ] `test/e2e/n8n-konyveles-wf9.spec.ts` — report email check
- [ ] `test/e2e/n8n-bank-csv.spec.ts` — bank CSV feldolgozás

### 3d.2 Produkciós hardening

- [ ] n8n retry policy: max 3 kísérlet / 30 s delay minden WF-re
- [ ] `data/` mappa `.gitignore` audit (érzékeny fájlok)
- [ ] `npm run test:fast` zöld
- [ ] `npm run build` 0 hibával

### 3d.3 Dokumentáció

- [ ] `docs/n8n-konyveles-pipeline.md` — teljes flow-diagram és futtatási útmutató
- [ ] `conductor/tracks/konyveles_phase3_20260403/plan.md` checklist frissítése

---

## Kockázatok

- **szamlazz.hu API kulcs érvénytelen** — közepes valószínűség, magas hatás. Mitigáció: teszt kulcs kérése.
- **NAV Online hozzáférési adatok hiányoznak** — magas valószínűség, közepes hatás. Mitigáció: mock agent megtartása fallbackként.
- **Gmail IMAP App Password blokkolva** — közepes valószínűség, közepes hatás. Mitigáció: OAuth2 alternatíva.
- **Bank CSV formátum eltér** — alacsony valószínűség, magas hatás. Mitigáció: CSV parser konfigurálható mezőkkel.
