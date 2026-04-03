# Specifikáció: Könyvelési Automatizálás Phase 3

**Track ID:** `konyveles_phase3_20260403`
**Szülő track:** `n8n_konyveles_pipeline_20260328` (COMPLETED 2026-04-03)
**Prioritás:** HIGH
**Tulajdonos:** Pohánka Péter
**Létrehozva:** 2026-04-03
**Utolsó audit:** 2026-04-03

---

## ⚠️ ELŐFELTÉTELEK — ezek nélkül nem indulhat el a munka

| Előfeltétel | Státusz | Teendő |
|-------------|---------|--------|
| `SZAMLAZZ_HU_API_KEY` — szamlazz.hu agentkulcs | ❓ Ismeretlen | `.env`-ben beállítani, fel kell ellenőrizni hogy él-e |
| NAV Online Számla API auth (`NAV_USERNAME`, `NAV_PASSWORD`, `NAV_SIGNING_KEY`, `NAV_EXCHANGE_KEY`) | ❓ Ismeretlen | NAV technikai felhasználó + tanúsítvány szükséges |
| Gmail/IMAP credential (`GMAIL_IMAP_USER` + `GMAIL_APP_PASSWORD` vagy OAuth2) | ❓ Ismeretlen | n8n credential vault-ban konfigurálni |
| Bank CSV éles path (`data/bank-imports/`) | ❌ Nincs | `BankAgent.ts` jelenleg hardcoded sample CSV-re mutat |

> **Ha bármelyik credential hiányzik, az adott workflow (WF) elkezdése blokkolva van. A Phase 0 mindig előbb fut.**

---

## 1. Célkitűzés

A lezárt Phase 1+2 infrastruktúrára (n8n + BAS + Google Sheets ✅) épülve:

1. **szamlazz.hu integráció** — kimenő számlák automatikus rögzítése az API v3-on át
2. **IMAP live** — éles email figyelés PDF/XML számlákkal (WF-7)
3. **NAV XML validáció live** — valódi NAV Online API hívás (WF-8)
4. **Report email** — napi/heti összesítő email (WF-9)
5. **Bank CSV figyelő** — `data/bank-imports/` mappa éles file watch + minta CSV-k

---

## 2. Meglévő infrastruktúra (nem kell újra csinálni)

| Komponens | Állapot | Hol |
|-----------|---------|-----|
| n8n self-hosted | ✅ AKTÍV `localhost:5678` | `local-n8n/` |
| WF-1..WF-4 scaffoldok | ✅ Importálva | n8n-ben |
| WF-5 KP Pénztár + Sheets | ✅ AKTÍV | n8n-ben |
| Google Sheets `Könyvelés-KP` | ✅ `1A78ojE_3SvVQJst9xJUKHHLgeFrSpq2vvpAXEAml_fg` | |
| Service Account | ✅ `brunella-sheets@brunella-core.iam.gserviceaccount.com` | `config/google-service-account.json` |
| BAS `/api/v1/bookkeeping/status` | ✅ GET + PATCH | `src/server/routes/bookkeeping.ts` |
| NavAgent.ts | ⚠️ LÉTEZIK, DE 100% MOCK | `src/agents/NavAgent.ts` — live NAV API-ra cserélendő Phase 3b-ben |
| SzamlazzHuAgent.ts | ❌ NEM LÉTEZIK | Csak `src/tools/getSzamlazzInvoices.ts` MCP tool van — agent Phase 3a-ban készül |
| BankAgent.ts | ⚠️ LÉTEZIK, DE SAMPLE CSV-RE MUTAT | `src/agents/BankAgent.ts` — éles path konfig szükséges (Phase 0) |
| NavAgent.ts | ⚠️ LÉTEZIK, DE 100% MOCK | `src/agents/NavAgent.ts` — live NAV API-ra cserélendő Phase 3b-ben |
| SzamlazzHuAgent.ts | ❌ NEM LÉTEZIK | Csak `src/tools/getSzamlazzInvoices.ts` MCP tool van — agent Phase 3a-ban készül |
| BankAgent.ts | ⚠️ LÉTEZIK, DE SAMPLE CSV-RE MUTAT | `src/agents/BankAgent.ts` — éles path konfig szükséges (Phase 0) |
| Python Sheets kliens | ✅ `myai/clients/google_sheets_client.py` | |
| Playwright E2E tesztek | ✅ `test/e2e/n8n-konyveles-wf5.spec.ts` | |

---

## 3. WF-6 — szamlazz.hu Kimenő Számlázás

### 3.1 szamlazz.hu API v3

- Base URL: `https://www.szamlazz.hu/szamla/`
- Auth: `SZAMLAZZ_HU_API_KEY` (`.env`-ben kell beállítani)
- Operációk: `szamla_create`, `szamla_query`, `szamla_csv`

### 3.2 Workflow

```
BAS esemény (invoice.created)
  → WF-6 webhook trigger
  → szamlazz.hu API POST (számla létrehozás)
  → PDF visszakapás
  → Google Drive feltöltés (opcionális)
  → BAS PATCH /api/v1/bookkeeping/status
  → Sikerüzenet email
```

### 3.3 Szükséges .env változók

```env
SZAMLAZZ_HU_API_KEY=<szamlazz.hu agentkulcs>
SZAMLAZZ_HU_BANK_ACCOUNT=<bankszámlaszám>
SZAMLAZZ_HU_TAX_NUMBER=<adószám>
```

---

## 4. WF-7 — IMAP Email Intake (Live)

Jelenleg a WF-1 scaffold IMAP credentialt vár. Ez a fázis:
- IMAP credential beállítása n8n-ben (Gmail OAuth2 VAGY SMTP+IMAP)
- Poll interval: 5 perc
- Filter: subject tartalmaz `számla`, `invoice`, `szla`
- Csatolmány mentése `data/inbox/`
- EmailAgent hívás: `POST /api/v1/agents/EmailAgent/execute`

---

## 5. WF-8 — NAV XML Validáció (Live)

- NAV Online Számla API: `https://api.onlineszamla.nav.gov.hu/invoiceService/v3/`
- Auth: technikai felhasználó (XML + tanúsítvány)
- WF-3 lecseréli a mock NavAgent hívását valódi NAV API-ra
- MISMATCH → WF-4 (email értesítő)

**Szükséges:** NAV Online hozzáférési adatok a `.env`-be.

---

## 6. WF-9 — Napi/Heti Report Email

- Cron: hétfőnként 08:00
- BAS `/api/v1/bookkeeping/status` lekérése
- Google Sheets összesítő lekérése (gspread)
- HTML email összeállítás
- SMTP küldés (WF-4 SMTP credential újrahasználva)

---

## 7. Bank CSV Watch (Élesítés)

- `data/bank-imports/` mappa létrehozása (ha nincs)
- `.gitignore`: `data/bank-imports/*.csv`
- WF-2 file watch node konfigurálása az éles mappára
- Minta `OTP_export_sample.csv` a teszteléshez

---

## 8. Acceptance Criteria

- [ ] szamlazz.hu teszt számla létrehozva API-n keresztül
- [ ] WF-6 webhook trigger → számla megjelenik szamlazz.hu-n
- [ ] WF-7 IMAP scan lefut (teszt email küldve → feldolgozva)
- [ ] WF-8 NAV validáció live eredménnyel tér vissza
- [ ] WF-9 report email megérkezett
- [ ] Bank CSV elhelyezve → WF-2 automatikusan feldolgozza
- [ ] Összes E2E Playwright teszt zöld
- [ ] `npm run build` 0 hibával fordul
- [ ] `npm run test:fast` zöld
