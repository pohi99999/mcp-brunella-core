# Végrehajtási Terv: Könyvelési Automatizálás Phase 3

**Track ID:** `konyveles_phase3_20260403`
**Becsült idő:** Phase 3a: 4 nap · 3b: 3 nap · 3c: 3 nap · 3d: 2 nap

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

- [ ] `SzamlazzHuAgent` trigger esemény hozzáadása (vagy meglévő InvoiceAutomation bővítése)
- [ ] `POST /api/v1/invoice/create` endpoint ellenőrzése/létrehozása

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
- [ ] Minta CSV: `data/bank-imports/OTP_export_sample.csv` (gitignored valós, de .example van)
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

| Kockázat | Valószínűség | Hatás | Mitigáció |
|----------|-------------|-------|-----------|
| szamlazz.hu API kulcs érvénytelen | közepes | magas | Teszt kulcs kérése |
| NAV Online hozzáférési adatok hiányoznak | magas | közepes | Mock agent megtartása fallbackként |
| Gmail IMAP App Password blokkolva | közepes | közepes | OAuth2 alternatíva |
| Bank CSV formátum eltér | alacsony | magas | CSV parser konfigurálható mezőkkel |
