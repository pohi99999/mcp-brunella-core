# Implementációs Terv: Type Safety Enforcement

## 📋 Fázisok

### 1. Fázis: Domináns any-k azonosítása
- [ ] `utils/db.ts` és `utils/tasksDb.ts` refaktorálása (DB objektumok típusozása).
- [ ] `utils/rag.ts` és `utils/lancedb_client.ts` refaktorálása.

### 2. Fázis: Agent és Tool réteg típusozása
- [ ] `BaseAgent.ts` és az IAgent interfész szigorítása.
- [ ] Tool handler függvények paramétereinek típusozása (extra: `any` -> `unknown`).

### 3. Fázis: Dashboard és Store típusozás
- [ ] `src/dashboard/store/` mappában lévő linter warningok javítása.
- [ ] Felesleges `eslint-disable` direktívák eltávolítása.

### 4. Fázis: Verifikáció
- [ ] `npm run build` (ha ez átmegy, a típusozás jó).
- [ ] `npm run lint` (0 any warning).

## 🎨 Dashboard Integráció
- [ ] Típusbiztos Store-ok használatának verifikálása a komponensekben.

## 🖥️ CLI Integráció
- [ ] CLI parancs paraméterek típusozásának ellenőrzése.
