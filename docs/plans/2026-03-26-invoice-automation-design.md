# Tervezési Dokumentum: Automatizált Számlafeldolgozó Rendszer

**Dátum:** 2026-03-26
**Státusz:** Tervezés alatt
**Ügynök:** InvoiceAutomationAgent

## 1. Célkitűzés
Egy teljesen automatizált munkafolyamat létrehozása, amely a Gmail-be érkező számlákat (PDF vagy kép) felismeri, a Gemini 2.0 Flash modell segítségével kinyeri belőlük a kulcsfontosságú adatokat (Név, Sorszám, Összeg), majd ezeket rendszerezetten menti a Google Drive-ra és egy Google Sheets táblázatba.

## 2. Architektúra
A rendszer a **Brunella Agent System (BAS)** infrastruktúrájára épül.

### Komponensek:
- **InvoiceAutomationAgent:** A folyamatot vezérlő TypeScript ügynök.
- **Bifrost Gateway:** Központi LLM elérés, kifejezetten a Gemini 2.0 Flash Vision képességeit használva.
- **Google Workspace MCP:**
    - `gmail`: Levelek keresése és csatolmányok letöltése.
    - `drive`: Év/Hónap alapú mappaszerkezet kezelése és fájlmentés.
    - `sheets`: Adatok rögzítése.

## 3. Adatáramlás
1. **Lekérdezés:** Az ügynök óránként ellenőrzi a Gmailt a következő szűrővel: `has:attachment filename:pdf label:inbox "számla"`.
2. **Letöltés:** A csatolmányt a helyi `temp/invoices/` mappába menti.
3. **Elemzés:** A Gemini 2.0 Flash elemzi a dokumentumot (OCR + szemantikai értelmezés).
    - Elvárt kimenet: JSON (Partner, Sorszám, Összeg, Pénznem, Dátum).
4. **Drive Mentés:**
    - Mappa ellenőrzése: `Drive/Számlák/YYYY/MM_Hónap/`.
    - Fájl feltöltése és átnevezése (pl. `YYYYMMDD_Partner_Sorszam.pdf`).
5. **Sheets Rögzítés:** Új sor beszúrása a táblázatba a kinyert adatokkal és a Drive linkkel.

## 4. Speciális Esetek és Hibakezelés
- **Többoldalas számlák:** A Gemini Vision képes több kép/oldal együttes elemzésére.
- **Kézi ellenőrzés:** Ha a kinyerés bizonytalan vagy sikertelen, a levél Gmailben kap egy "Brunella-Manual-Check" címkét.
- **Duplikáció:** A Sheets-be írás előtt az ügynök ellenőrzi a sorszámot a táblázatban.

## 5. EPP v2 Megfelelőség
- **Dashboard:** Új fül a Mission Control-on a feldolgozási statisztikákhoz és a manuális triggerhez.
- **CLI:** `brunella invoice process` parancs a munkafolyamat kézi indításához.

## 6. Sikerességi Kritériumok
- 95%+ pontosság a digitális PDF-ek esetén.
- 90%+ pontosság a jó minőségű mobilfotók esetén.
- Automatikus mappa-létrehozás hiba nélkül.
