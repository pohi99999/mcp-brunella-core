# Implementációs Terv: Modular State Refactor

## 📋 Fázisok

### 1. Fázis: Database Wrapper Refaktor
- [ ] `DatabaseManager` osztály létrehozása a `utils/db.ts` alapján.
- [ ] `TasksDatabase` osztály létrehozása a `utils/tasksDb.ts` alapján.

### 2. Fázis: RAG és AI Client Refaktor
- [ ] `RagEngine` osztály létrehozása, ami injektált DB és Embedding klienssel működik.
- [ ] Globális `_lancedbModule` típusú változók kivezetése.

### 3. Fázis: Injekció bevezetése a Szerver rétegben
- [ ] Az Express route-ok a `request` objektumon vagy egy `ServiceRegistry`-n keresztül érjék el a példányokat.
- [ ] Unit tesztek frissítése (valódi izoláció tesztelése).

### 4. Fázis: Verifikáció
- [ ] Teljes teszt suite futtatása (`npm test`).
- [ ] Memória-leak ellenőrzés (szolgáltatások leállítása után ne maradjon nyitott handle).

## 🎨 Dashboard Integráció
- [ ] A Dashboard API végpontok válaszidejének és stabilitásának ellenőrzése az új architektúra alatt.

## 🖥️ CLI Integráció
- [ ] CLI parancsok (pl. `memoria lista`) működésének ellenőrzése.
