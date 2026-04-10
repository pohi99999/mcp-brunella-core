# Push teszt cadence optimalizáció

**Track ID:** `test_cadence_optimization_20260401`
**Kapcsolódó track:** `precommit_hook_optimization_20260325`
**Cél:** a push-lánc csak gyors alapteszteket futtasson, a teljes suite pedig napi egyszer, külön scheduled workflow-ban fusson.

---

## Feladatok

- [x] Azonosítani, hogy a sikertelen pushnál melyik hook / workflow futtatott a vártnál bővebb tesztkört.
- [x] A `.husky/pre-push` hookot a `npm run test:fast` profillal összhangba hozni.
- [x] A push / PR CI pipeline-t gyors ellenőrzésre átállítani.
- [x] Külön napi GitHub Actions workflow létrehozása a teljes suite-hoz.
- [x] README / Copilot / Claude dokumentáció frissítése az új cadence szerint.
- [x] Validáció: `npm run test:fast`.
- [x] Conductor újraszinkronizálása és Copilot napló frissítése.

## Eredmény

- a helyi `pre-push` többé nem futtat teljes suite-ot,
- a push/PR CI gyors validációra állt át,
- a teljes `npm test` napi egyszer, külön scheduled workflow-ban fut,
- a gyors profil validációja sikeres: **219 passed, 1 skipped / 1919 passed, 41 skipped**.
