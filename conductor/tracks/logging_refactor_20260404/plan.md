# Implementációs Terv: Logging Audit

## 📋 Fázisok

### 1. Fázis: Audit és Előkészítés
- [ ] Teljes lista készítése a `console.log`-ot tartalmazó fájlokról.
- [ ] `utils/logger.ts` képességeinek ellenőrzése (támogatja-e a több-paraméteres hívásokat mindenhol).

### 2. Fázis: Automatizált Refaktor (Batch 1)
- [ ] `LintFixerAgent` bevetése a `src/server/` mappa tisztítására.
- [ ] `LintFixerAgent` bevetése a `src/tools/` mappa tisztítására.

### 3. Fázis: Manuális Refaktor és Finomhangolás (Batch 2)
- [ ] `src/cli.ts` és `src/interactive.ts` tisztítása (itt trükkösebb a chalk/figlet használat miatt).
- [ ] `src/dashboard/` overlay és context fájlok javítása.

### 4. Fázis: Verifikáció
- [ ] `npm run lint` futtatása.
- [ ] Dashboard Observability panel ellenőrzése futó rendszer mellett.
- [ ] `grep` ellenőrzés: `grep -r "console.log" src/` eredménye legyen üres.

## 🎨 Dashboard Integráció
- [ ] Ellenőrizni, hogy az átállás után a logok megjelennek-e a Dashboardon.

## 🖥️ CLI Integráció
- [ ] `brunella observability` parancs kimenetének ellenőrzése.
