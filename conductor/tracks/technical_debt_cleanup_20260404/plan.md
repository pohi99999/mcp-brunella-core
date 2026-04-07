# Implementációs Terv: Technical Debt Cleanup

## 📋 Fázisok

### 1. Fázis: Linter takarítás
- [x] `npm run lint:fix` futtatása és a változások ellenőrzése.
- [x] Manuális javítás ott, ahol az automata nem boldogult (redundant Boolean casts, empty object interface, unused eslint-disable, empty catch blocks, @ts-nocheck elimánálás).

### 2. Fázis: TODO Audit
- [ ] Teljes TODO lista exportálása.
- [ ] Kategóriákba sorolás: "Törölhető", "Azonnal javítandó", "Track szükséges".
- [ ] A megmaradó TODO-k kiegészítése Track ID-val.

### 3. Fázis: Halott kód elimináció
- [ ] Kikommentelt kódblokkok keresése és törlése.
- [ ] Nem használt importok ellenőrzése.

### 4. Fázis: Verifikáció
- [ ] `npm run build` és `npm test`.
- [ ] `grep -r "TODO" src/` ellenőrzés (csak valid, trackelt TODO-k maradhatnak).

## 🎨 Dashboard Integráció
- [ ] A `SuggestedTasks` panel frissítése az új TODO struktúra alapján.

## 🖥️ CLI Integráció
- [ ] `brunella conductor status` kimenetének ellenőrzése (ne legyen benne fals TODO hiba).
