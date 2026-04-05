# Specifikáció: Konyvelesi Phase 0 readiness

## Eredmény

A phase0 readiness külön trackben lezárult, hogy a bookkeeping pipeline előfeltételei önállóan, dry-run módban legyenek ellenőrizhetők.

## Lefedett scope

- szamlazz.hu credential jelenlét ellenőrzése
- NAV Online Számla credential jelenlét ellenőrzése
- Gmail IMAP hozzáférés ellenőrzése
- `data/bank-imports/` drop zone ellenőrzése
- readiness report a backend status felületen
- readiness megjelenítés a dashboardon és a CLI-ben

## Elvárt állapot

- A readiness report megmutatja, mi hiányzik.
- A report nem szivárogtat secret értéket.
- A dashboard és a CLI ugyanazt a readiness állapotot mutatja.
- A status endpoint továbbra is működik a meglévő summary/snapshot adattal.

## Záró megjegyzés

Ez a slice lezárt előfeltétel volt; a broader phase3 folytatás a parent trackben mehet tovább.
