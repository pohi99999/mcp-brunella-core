# Track: Master Track 2 - Invoice to Sheets Automation

**Track ID:** `master_track_2_invoice_to_sheets_20260223`
**Status:** PROPOSED
**Priority:** HIGH (Immediate Monetization Value)
**Created:** 2026-02-23

---

## 🎯 Célkitűzés

Automatizált számlaadat-feldolgozó szolgáltatás létrehozása, amely Gmailből PDF számlákat olvas be, mesterséges intelligencia segítségével kinyeri az adatokat (OCR, Pydantic modellek), validálja azokat, és rendszerezetten Google Sheets táblázatba rögzíti. Ez egy "Setup fee" alapú szolgáltatás lesz kisebb vállalkozások számára.

---

## 🛠️ Érintett Fájlok és Komponensek

-   **`src/agents/FinanceGuardian.ts`**: Fő orchestrátor ágens a folyamathoz.
-   **`myai/refiners/invoice_parser.py`**: Pydantic modellek és OCR logika a PDF-ek feldolgozásához.
-   **`src/tools/gmail_handler.ts`**: Gmail API integráció (levelek keresése, mellékletek letöltése).
-   **`src/tools/googleWorkspace.ts`**: Google Sheets írási funkciók.
-   **`src/agents/EmailTriageAgent.ts`**: Email szűrés és kiválasztás.
-   **`conductor/tracks/invoice-e2e-testing-20260217`**: A tesztelési keretrendszer és specifikációk ebből a track-ből származnak.
-   **`data/invoice_templates/`**: Példa Pydantic modellek.

---

## 📋 Megvalósítási Terv (Phases)

### Phase 1: Gmail Integration & PDF Harvesting
-   **Cél:** Biztosítani, hogy az ügynök képes legyen célzottan keresni és letölteni PDF számlákat egy Gmail fiókban.
-   **Feladatok:**
    1.  Fejleszd az `EmailTriageAgent.ts`-t, hogy képes legyen Gmailben keresni specifikus kulcsszavakkal (pl. "számla", "invoice", "pdf") és címzettektől.
    2.  Implementáld a `gmail_downloadAttachment` funkciót, hogy a PDF mellékleteket le tudja menteni egy ideiglenes mappába (`_br_temp/invoices/`).
    3.  Teszteld a letöltési funkciót különböző PDF formátumokkal.

### Phase 2: OCR & Pydantic Parsing Pipeline
-   **Cél:** A letöltött PDF-ekből az adatokat kinyerni és strukturált Pydantic modellekbe rendezni.
-   **Feladatok:**
    1.  Implementáld a `myai/refiners/invoice_parser.py` scriptet:
        *   Használjon OCR-t (pl. `pytesseract` vagy Google Cloud Vision API) a PDF-ből szöveg kinyeréséhez.
        *   Definiáld a `InvoiceData` Pydantic modellt (`data/invoice_templates/invoice_schema.py`).
        *   A parser függvény dolgozza fel a kinyert szöveget és töltse ki a Pydantic modellt.
    2.  Teszteld a parser-t sample PDF számlákkal.

### Phase 3: LanceDB Indexing & Duplicate Detection
-   **Cél:** A feldolgozott számlaadatokat tárolni és detektálni az esetleges duplikátumokat.
-   **Feladatok:**
    1.  Implementáld a LanceDB tábla struktúrát a számlák tárolására (`id`, `invoice_number`, `amount`, `vendor`, `processed_timestamp`).
    2.  A `FinanceGuardian.ts` vagy egy új `InvoicePersistenceAgent.ts` végezze el a duplikátum ellenőrzést (`invoice_number` alapján) minden új számla mentése előtt.
    3.  Ha duplikátum, loggolja és ne írja be újra.

### Phase 4: Google Sheets Integration & Reporting
-   **Cél:** A validált és nem duplikált számlaadatok strukturáltan Google Sheets-be írása.
-   **Feladatok:**
    1.  A `FinanceGuardian.ts` használja a `googleWorkspace.ts` `sheets_appendText` vagy `sheets_write` funkciót.
    2.  Konfiguráld a cél Google Sheet-et (neve, munkalap, oszlopfejlécek).
    3.  Implementáld a color-coding logikát a Sheet-ben (pl. piros a duplikátumoknak/hibáknak, zöld a sikeresen feldolgozottaknak).

### Phase 5: Service Packaging & Client Setup Guide
-   **Cél:** A teljes folyamat csomagolása egy "Setup fee" alapú szolgáltatásként.
-   **Feladatok:**
    1.  Definiáld a szolgáltatás árát (pl. 200.000 Ft egyszeri beállítás).
    2.  Készítsd el az ügyfél dokumentációt (`docs/services/invoice-to-sheets.md`), ami leírja a folyamatot, a szükséges engedélyeket (Gmail, Google Sheets), és a beállítás lépéseit.
    3.  Hozz létre egy `setup_invoice_automation.ps1` scriptet a BAS-ban a kliens oldali beállításokhoz (pl. Google API credentials, Gmail label konfig).

---

## ✅ Definition of Done

- [ ] Gmailben PDF számlák keresése és mentése működik.
- [ ] Pydantic modell validálja a kinyert számlaadatokat.
- [ ] Duplikátum detektálás LanceDB-ben működik.
- [ ] Adatok sikeresen íródnak a Google Sheets-be, megfelelő formázással.
- [ ] Az ügyfél dokumentáció és setup guide elkészült.
- [ ] Az első 3 teszt-számlát sikeresen feldolgoztunk.
- [ ] `npm test` és `npm run build` PASS.

---

## 🔗 Függőségek

-   Működő `FinanceGuardianAgent` és `EmailTriageAgent`.
-   Hozzáférés a Gmail és Google Sheets API-hoz.
-   Python OCR worker telepítve és konfigurálva.
-   LanceDB inicializálva.

---

## 📝 Megjegyzések

-   Az OCR pontossága kulcsfontosságú. Több OCR engine tesztelése javasolt.
-   A Google Sheets API limitjeire figyelni kell batch írásnál.
-   Az ügyfél engedélyezési folyamatát (Gmail, Sheets) tisztán kell kommunikálni.

---

**Track Spec Version:** 1.0  
**Last Updated:** 2026-02-23  
**Maintained By:** BAS Finance Module Team
