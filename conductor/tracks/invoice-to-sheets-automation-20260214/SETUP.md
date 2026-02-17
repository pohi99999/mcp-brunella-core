# Számlázz.hu & Google Sheets Automatizáció - Phase 1 Setup Guide

## 📋 Phase 1: Környezet és Séma Definíció

Ez a útmutató a Invoice Automation track Phase 1 completionhoz kell.

### ✅ Befejezett Feladatok

1. **Pydantic séma** ✅
   - Fájl: `myai/schemas/invoice.py`
   - InvoiceData osztály - Partner, Összeg, ÁFA, Dátum, Határidő fields
   - `dict_for_sheets()` metódus a Google Sheets integráció számára

2. **.env konfigurálás** ✅
   - Fájl: `.env`
   - SZAMLAZZ_HU_API_KEY, SZAMLAZZ_HU_ACCOUNT_ID
   - GOOGLE_SHEETS_ID, GOOGLE_CLOUD_CREDENTIALS_PATH
   - INVOICE_AUTO_SYNC_ENABLED, INVOICE_AUTO_SYNC_CRON

3. **Google Sheets Service Account javaslat** ✅
   - Sablonfájl: `config/google-service-account.json.example`
   - El kell készíteni az actual credential fájlt: `config/google-service-account.json`

---

## 🔧 Konfigurálási Lépések (MANUAL STEPS)

### 1. Számlázz.hu API Key beszerzése

1. Látogass el: https://szamlazz.hu/api
2. Hozz létre egy API key-t vagy küldj e-mailt: support@szamlazz.hu
3. Másoldan az API KEY-t a `.env` fájlba:
   ```env
   SZAMLAZZ_HU_API_KEY=YOUR_KEY_HERE
   SZAMLAZZ_HU_ACCOUNT_ID=YOUR_ACCOUNT_ID
   ```

### 2. Google Cloud Project & Service Account Létrehozása

1. Menj: https://console.cloud.google.com/
2. Hozz létre egy új project: "Brunella Invoice Automation"
3. Engedélyezd a **Google Sheets API**:
   - APIs & Services → Library
   - Keressen: "Google Sheets API"
   - Click "Enable"
4. Hozz létre một Service Account:
   - APIs & Services → Credentials
   - Create Credentials → Service Account
   - Nev: "brunella-invoice-bot"
   - Skip optional steps
5. Hozz létre egy JSON key-t:
   - Képernyő: Service Accounts
   - Click on "brunella-invoice-bot"
   - Tab: Keys
   - Add Key → Create new key → JSON
   - **Másold a JSON fájlt** → `config/google-service-account.json`
6. Az **PROJECT_ID** másolás a `.env`-be:
   ```env
   GOOGLE_PROJECT_ID=your-project-id-12345
   ```

### 3. Google Sheets Dokumentum & Megosztás

1. Menj: https://sheets.google.com
2. Hozz létre egy új spreadsheet: "Brunella Számlák"
3. Másold az **SHEET ID** az URL-ből:
   - URL: `https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit`
   - Másolás az `.env`-be:
     ```env
     GOOGLE_SHEETS_ID=YOUR_SHEET_ID_HERE
     ```
4. **Megosztás** a Service Account email-vel:
   - Kattints "Share"
   - Beillesztés: `brunella-invoice-bot@{PROJECT_ID}.iam.gserviceaccount.com`
   - Permission: "Editor"
   - Click "Share"

### 4. Sheet Headers Létrehozása

Az első sor (headers) legyen:
```
Partner | Szám | Dátum | Határidő | Nettó | ÁFA % | ÁFA | Bruttó | Státusz | Forrás | Megjegyzés
```

**Excel Formula for Headers (Copy-Paste):**
```
A1: Partner
B1: Szám
C1: Dátum
D1: Határidő
E1: Nettó
F1: ÁFA %
G1: ÁFA
H1: Bruttó
I1: Státusz
J1: Forrás
K1: Megjegyzés
```

---

## 🧪 Tesztelés (Phase 1 Done Check)

1. **Pydantic validáció test:**
   ```bash
   npm test -- myai/schemas/invoice.test.ts
   ```
   (test még nem létezik, Phase 2-ben jön)

2. **Manual validáció:**
   ```python
   # myai/test_invoice_schema.py
   from myai.schemas.invoice import InvoiceData
   from datetime import date

   # Valid invoice
   invoice = InvoiceData(
       partner="Acme Corp",
       amount=100000.0,
       vat_amount=27000.0,
       vat_rate=27.0,
       invoice_date=date(2026, 2, 14),
       due_date=date(2026, 3, 14),
       invoice_no="2026-00001"
   )
   
   print(invoice.dict_for_sheets())
   # Output: {'Partner': 'Acme Corp', 'Szám': '2026-00001', ...}
   ```

---

## 📊 Phase 1 Status

| Task | Status | Notes |
|------|--------|-------|
| Pydantic séma | ✅ DONE | `myai/schemas/invoice.py` |
| .env setup | ✅ DONE | Invoice section added |
| Google Sheets Service Account | ✅ TEMPLATE | Need manual credential setup |
| Database schema | ⏳ PHASE 2 | SQLite for tracking |
| Számlázz.hu client | ⏳ PHASE 2 | Python API wrapper |

---

## 🔗 Lásd még

- **Phase 2**: Harvest integration (Számlázz.hu API + Gmail)
- **Phase 3**: Refine & Index (Pydantic validation + LanceDB)
- **Phase 4**: Google Sheets export
- **Phase 5**: Dashboard widget + CLI command

---

Created: 2026-02-17
Track: invoice-to-sheets-automation-20260214
