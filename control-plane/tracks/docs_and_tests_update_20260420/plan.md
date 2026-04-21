# Track: A meglévő AI multi-agent rendszer dokumentációjának és tesztelési protokolljának frissítése

## Fázis 1: Projekt Dokumentáció Auditálása és Frissítése
- [x] Task: Auditálja és frissítse a `README.md` fájlt
    - [ ] Ellenőrizze az architektúra leírását
    - [ ] Frissítse a parancsreferenciákat
    - [ ] Győződjön meg a kód konvenciók aktualitásáról
    - [ ] Hozzáadja az EPP v2 protokollra vonatkozó hivatkozásokat, ha szükséges
- [x] Task: Auditálja és frissítse az `.ai/FOSZAL.md` és `.ai/gemini.md` fájlokat
    - [ ] Ellenőrizze a munkamenet naplók konzisztenciáját és pontosságát
    - [ ] Frissítse a legutóbbi munka összefoglalóit
- [x] Task: Auditálja és frissítse a `conductor/tracks.md` fájlt
    - [ ] Ellenőrizze az aktív, befejezett és archivált trackek listáját
    - [ ] Győződjön meg a trackek linkjeinek helyességéről
- [x] Task: Conductor - User Manual Verification 'Projekt Dokumentáció Auditálása és Frissítése' (Protocol in workflow.md)

## Fázis 2: Tesztelési Protokoll Auditálása és Frissítése
- [x] Task: Auditálja és frissítse a `package.json` tesztparancsait
    - [ ] Ellenőrizze a `npm run test:fast` és `npm test` parancsok definícióját
    - [ ] Hozzáadja az új tesztparancsokat, ha szükséges
- [x] Task: Auditálja és frissítse a Vitest konfigurációs fájlokat (pl. `vitest.config.ts`)
    - [ ] Ellenőrizze a teszt lefedettségre vonatkozó beállításokat
    - [ ] Frissítse a teszt futtatási opciókat
- [x] Task: Implementálja az EPP v2 tesztelési követelményeket
    - [ ] Biztosítsa, hogy minden új funkcióhoz tartozzon Dashboard UI és Magyar CLI komponens
    - [ ] Győződjön meg arról, hogy a tesztek mindkét felületet lefedik
- [x] Task: Conductor - User Manual Verification 'Tesztelési Protokoll Auditálása és Frissítése' (Protocol in workflow.md)

## Fázis 3: Szinkronizációs és Karbantartási Folyamatok
- [x] Task: Ellenőrizze és frissítse a `scripts/sync_foszal.py` scriptet
    - [ ] Győződjön meg a script helyes működéséről
    - [ ] Frissítse a sync logikát, ha szükséges
- [x] Task: Conductor - User Manual Verification 'Szinkronizációs és Karbantartási Folyamatok' (Protocol in workflow.md)