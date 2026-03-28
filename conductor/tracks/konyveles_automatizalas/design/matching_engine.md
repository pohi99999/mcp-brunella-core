# Matching Engine Design

## Célkitűzés
- A számlák és bank tranzakciók automatikus, intelligens párosítása, hogy az egyeztetési folyamat legalább 90%-ban automatizálható legyen. Az első iterációban heuristikus pontozást használunk, később ML/LLM kiegészítéssel finomítjuk.

## Bemeneti adatok
| Forrás | Példa mezők |
| --- | --- |
| Bank tranzakció (`bank_transactions.csv` példák) | `date`, `amount`, `description`, `counterparty`, `account` |
| Kinyert számlák (`sample_invoice_placeholder.txt`, `sample_nav_invoice.xml`) | `invoice_number`, `net`, `vat`, `gross`, `issueDate`, `partner`, `partner_taxid`, `source` |
| NAV XML (NORMALIZÁLT) | `partner_taxid`, `payment_method`, `due_date`, `line_items` (jövőbeli) |

## Pontozási összetevők (`src/matching/matcher.ts` & `scripts/konyveles_discovery_run.js` implementáció)
1. **Összeg egyezés** – a fő szempont: ha a bank tranzakció összege megegyezik a számla `gross` vagy `net` értékével ± tolerancia (default `0.5`), akkor 60/50 pont jár.
2. **Dátum közelítés** – `issueDate` és tranzakció dátum közötti különbség (`daysBetween`) ≤ 3 nap: max 30 pont (csökken nap alapján).
3. **Partner név / leírás** – ha a tranzakció `description` mezője tartalmazza az `inv.partner` értéket: +15 pont.
4. **Számlaszám a leírásban** – `invoice_number` megtalálása a leírásban: +20 pont.
5. **Előnyt élvez a nagyobb pontszám** – a `match` függvény a legmagasabb pontszámú számlát párosítja, rendezett eredményt ment.

### Kiterjesztési lehetőségek
- **Részösszeges fizetés**: amennyiben több tranzakció összege adja ki a számlát, bevezetünk `partial_settled` állapotot és javaslatot minden tranzakcióhoz.
- **Több számla egy utalás**: összegeket `sum` -nel `invoice_group` kulcs alatt pontozzuk.
- **Tolerancia konfigurálás**: `dateToleranceDays` és `amountTolerance` publikálható részlet a `match` hívásban.
- **Botrányos alacsony pontszám**: 30 alatt `exceptions/bank_mismatch.json` generálható email értesítéssel.

## Exception handling
- Ha hiányoznak PDF-ek: `exceptions/missing_pdf.json` generálódik (a Discovery script 0 PDF és 0 XML esetén logol is).
- NAV mismatch: ha a NAV XML `gross_amount` nem egyezik a PDF-en lévő értékkel, log `exceptions/nav_mismatch.json` és reflog.
- Bank mismatch/report: a `scripts/konyveles_discovery_run.js` minta JSON mellett `exceptions` könyvtár (egyesített) létrehozása lesz jövő iterációban.

## Integrációs pontok
1. **Discovery pipeline**: `scripts/konyveles_discovery_run.js` olvassa be a `resources/samples` fájlokat, futtatja a `match` logikát, és `data/konyveles/match_results.json` fájlba menti.
2. **GTK**: a `src/agents/EmailAgent` és `NavAgent` által visszaadott JSON-ok (`parsed`, `data`) strukturálisan azonosítják az `invoice_number`/`net`/`issueDate` mezőket, így közvetlenül felhasználhatók a matching függvényhívásban.
3. **Adattár**: `data/bookkeeping_db.ts` `transactions` táblája tárolja a `status`, `matchedInvoice`, `data` mezőket; a `match` helper hívható a `BookkeepingTransaction` rekordokra.

## Következő lépések
1. Automatizált bank CSV import (ez már elérhető `scripts/konyveles_discovery_run.js`-ban, de jövőben agent is futtathatja egymás után).
2. Partial matching (részösszeges) kiegészítés a scoring rutinban.
3. Dashbord/output panel: összesített `match_results.json` és `exceptions` megjelenítése a `Remote` vagy `Invoice Automation` panelon `data/konyveles` forrásból.

## Referenciák
- `src/matching/matcher.ts` – aktuális match logika (Heurisztikus pontozás, `BankTx` + `Invoice` típusok).
- `scripts/konyveles_discovery_run.js` – end-to-end discovery script mint futható pipeline.
- `conductor/tracks/konyveles_automatizalas/resources` – mezőtérképek és mintafájlok, amik segítik az input normalizátort.