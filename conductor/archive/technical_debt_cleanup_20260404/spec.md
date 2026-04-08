# Specifikáció: Technical Debt Cleanup

## 🎯 Célkitűzés
A Brunella kódbázisban felhalmozódott technikai adósság csökkentése. Elsődleges cél az elszórt `TODO` megjegyzések rendszerezése, a már nem releváns TODO-k törlése, és a többiek trackekhez vagy issue-khoz rendelése. Másodlagos cél a linter által jelzett felesleges tiltások (`eslint-disable`) kitakarítása.

## ⚠️ Jelenlegi Probléma
- Több mint 100 `TODO` komment, amik nagy része kontextus nélküli.
- Felesleges `eslint-disable` direktívák, amik rontják a kód olvashatóságát.
- Elavult kódblokkok (pl. kikommentelt régi debug logok).

## ✅ Elvárt Állapot
- Minden `TODO` rendelkezik felelőssel vagy határidővel/track-kel.
- A linter warningok száma 0 (különös tekintettel az `Unused eslint-disable` hibákra).
- Nincsenek elavult, kikommentelt kódblokkok a production fájlokban.

## 🛠️ Technikai Követelmények
- `npm run lint:fix` használata.
- A `scanCodebaseForTodos` utility eredményeinek összevetése a valós kóddal.
- Szigorú EPP v2 protokoll betartása (minden módosítás trackelve legyen).
