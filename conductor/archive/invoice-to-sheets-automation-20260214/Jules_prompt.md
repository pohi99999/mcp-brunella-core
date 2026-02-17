🚀 PROMPT A JULES AI SZÁMÁRA



Tárgy: Új Track Implementáció: invoice-to-sheets-automation-20260214 (Phase 1) 

+1



Kontextus:

Te a Brunella Agent System (BAS) autonóm fejlesztő ügynöke vagy. A feladatod az invoice-to-sheets-automation-20260214 track elindítása a szigorú Engineering Precision Protocol v2 (EPP v2) szabályai szerint. A cél egy olyan Data Flywheel folyamat, amely a Számlázz.hu API-ból és Gmail PDF-ekből adatokat nyer ki, majd Google Sheets-be exportálja azokat.

+4



Feladatod (Phase 1):





Branch létrehozása: Indíts egy új ágat feat/invoice-automation-setup néven.

+3





Séma definíció: Hozd létre a myai/schemas/invoice.py fájlt. Használj Pydantic-ot az InvoiceData osztályhoz az alábbi mezőkkel: partner\_name, amount\_net, amount\_gross, tax\_rate, invoice\_date, due\_date, currency.

+4





Környezet előkészítése: Frissítsd a .env.example fájlt a szükséges változókkal: SZAMLAZZ\_HU\_API\_KEY, GOOGLE\_SHEETS\_ID.





Track inicializálása: Ellenőrizd, hogy a conductor/tracks/invoice-to-sheets-automation-20260214/spec.md és plan.md fájlok a helyükön vannak-e.

+1



EPP v2 Megkötések:



Nincs kódírás track és specifikáció nélkül.

+1



Minden változtatás után kötelező az npm test és a build ellenőrzése.

+2



A folyamat végén frissítsd a conductor/tracks.md állapotát és futtasd a scripts/sync\_foszal.py scriptet.

+2



Várom a PR-t és a Phase 1 lezárását!

