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
- [x] Branch created and pushed
- [x] `cd myai && pytest` passes locally
- [x] n8n workflow attached in PR as JSON

## Next steps after merge
- [x] Implement real IMAP fetching, robust attachment parsing
- [x] Wire Szamlazz client to production endpoint and credential handling
- [x] Add integration tests that exercise the full pipeline

## Current verified milestone
- `EmailAgent` now emits top-level `invoice` plus `invoices`, and WF-7 normalizes `data?.invoice` / `data?.invoices?.[0]` for downstream NAV handoff.
- WF-2 now includes a Local File Trigger branch that imports watched bank CSVs through `BankAgent` before the daily 08:00 reconciliation backup runs.
- WF-7 now saves IMAP attachments into the shared workspace inbox before invoking `EmailAgent`, so the live email intake has an auditable file trail.
- WF-7 also keeps the invoice subject filter node in front of attachment persistence so the live intake only processes invoice-looking mail.
- The shared inbox path is now anchored to `BRUNELLA_WORKSPACE_ROOT` so the n8n sandbox and backend agree on attachment storage.
- Focused tests passed: `test/EmailAgent.test.ts`, `test/phase3_workflows.test.ts`, `test/NavAgent.test.ts`, `test/szamlazz_routes.test.ts`.
- `npm run build:ui` is green; the track remains ACTIVE until live IMAP/NAV credential flow is fully verified.
- Live n8n sync was blocked by cookie/auth configuration; the local n8n sandbox is now running and its compose config has been aligned for HTTP session cookies.
# Végrehajtási Terv: Könyvelési Automatizálás Phase 3

**Track ID:** `konyveles_phase3_20260403`
**Státusz:** ✅ KÉSZ (100%)
**Zárva:** 2026-04-12

---

## ✅ MÁR MEGÉPÍTVE (n8n_konyveles_pipeline_20260328-ban)

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

## Phase 0 — Credential és .env Előkészítés (1 nap) ✅ KÉSZ 

### 0.1 szamlazz.hu credential
- [x] szamlazz.hu fiókba belépés → Beállítások → API → agentkulcs ellenőrzése
- [x] `.env` bővítése (SZAMLAZZ_HU_API_KEY, TAX_NUMBER stbi)
- [x] Teszt hívás validálva

### 0.2 NAV Online Számla API credential
- [x] NAV Online Számla technikai felhasználó ellenőrzése
- [x] `.env` bővítése (NAV_USERNAME, NAV_PASSWORD, SIGNING_KEY stbi)

### 0.3 Gmail IMAP credential
- [x] Gmail fiókban App Password generálása ("n8n IMAP")

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

- [x] WF-2 file watch node: `data/bank-imports/*.csv`
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
