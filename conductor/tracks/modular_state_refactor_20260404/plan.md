# Implementációs Terv: Modular State Refactor

## 📋 Fázisok

### 1. Fázis: Database Wrapper Refaktor
- [x] `DatabaseManager` osztály létrehozása a `utils/db.ts` alapján.
- [x] `TasksDatabase` osztály létrehozása a `utils/tasksDb.ts` alapján.
- Megjegyzés: A `businessJobs` route DI injekciója, a `TasksDatabaseManager` wrapper és a fókusz tesztek is elkészültek; az 1. fázis lezárult, a következő fókusz a RAG refaktor.

### 2. Fázis: RAG és AI Client Refaktor
- [x] `RagEngine` osztály létrehozása, ami injektált DB és Embedding klienssel működik.
- [x] Globális `_lancedbModule` típusú változók kivezetése.
- [x] `defaultRagEngine` named export hozzáadva DI-kompatibilis használathoz.

### 3. Fázis: Injekció bevezetése a Szerver rétegben
- [x] Az Express route-ok a `request` objektumon vagy egy `ServiceRegistry`-n keresztül érjék el a példányokat.
  - Létrehozva: `src/utils/serviceRegistry.ts` — `ServiceRegistry` osztály + `getServiceRegistry()` helper.
  - Javítva: `userPreferences.ts` `initSchema()` — `db!` non-null assertion eltávolítva, explicit `database` paraméter bevezetve.
  - Hozzáadva: `testResultsService.ts` `getTestResultsDb()` getter.
- [x] Unit tesztek frissítése (valódi izoláció tesztelése).

### 4. Fázis: Verifikáció
- [x] Teljes teszt suite futtatása (`npm run test:fast`).
- [x] Memória-leak ellenőrzés (szolgáltatások leállítása után ne maradjon nyitott handle).

## 🎨 Dashboard Integráció
- [ ] A Dashboard API végpontok válaszidejének és stabilitásának ellenőrzése az új architektúra alatt.

## 🖥️ CLI Integráció
- [ ] CLI parancsok (pl. `memoria lista`) működésének ellenőrzése.
