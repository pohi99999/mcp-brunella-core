# Könyvelés Automatizálás Design - 2026-03-27

## Áttekintés
Ez a dokumentum a Brunella Agent System (BAS) könyvelési moduljának (Számla + NAV + Bank párosítás) technikai tervét tartalmazza. A rendszer célja az éles könyvelési folyamat 80%-ának automatizálása.

## Architektúra: Eseményvezérelt Agent Swarm
A rendszer aszinkron ágensekből áll, amelyek egy központi SQLite/LanceDB állapotgépen keresztül kommunikálnak.

### Ágensek és feladatok
1. **EmailAgent (Watcher):** IMAP-en keresztül figyeli a számla-emaileket, letölti a PDF-eket és `Partner_Dátum_Összeg.pdf` formátumban menti őket.
2. **NAV-API-Agent (Sync):** Rendszeresen szinkronizálja a NAV Online Számla XML adatait.
3. **BankAgent (Watcher):** Figyeli a megadott lokális mappát banki exportokért (CSV/JSON).
4. **MatchingAgent (The Brain):** Hibrid párosítási logikát futtat (Számlaszám -> Összeg+Partner+Dátum).
5. **SheetsSyncAgent:** Az adatbázis állapotát tükrözi a Google Sheets felé.

## Adatmodell és Matching Logika
- **Hibrid Matching:**
  - Elsődleges: Számlaszám regex keresése a közleményben.
  - Másodlagos: Összeg egyezés + Fuzzy partnernév keresés + Dátum tolerancia (+/- 5 nap).
- **Státuszok:** `PENDING_MATCH`, `PARTIALLY_MATCHED`, `COMPLETED`, `MANUAL_REVIEW`.

## Google Sheets Struktúra
- **Kontroll Panel:** Összesített statisztikák és hiányzó bizonylatok száma.
- **Számla Egyeztető:** Színkódolt (Zöld/Sárga/Piros) mátrix a NAV, PDF és Bank adatokkal.
- **Banki Maradék:** Párosítatlan banki tranzakciók listája.

## Riportálás
Napi összefoglaló email reggel 8:00-kor az elvégzett párosításokról és a beavatkozást igénylő hibákról.
