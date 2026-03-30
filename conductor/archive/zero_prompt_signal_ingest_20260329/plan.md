# Végrehajtási Terv: Zero-Prompt Core — GitHub + Health + Scheduled Inputok

**Track ID:** `zero_prompt_signal_ingest_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- GitHub source adapter(ek)
- Health monitor source adapter
- Scheduled tasks outcome adapter
- Alap esemény-prioritási mapping táblák

## Todo lista

### 1. Források felmérése

- [x] GitHub eventek prioritási és payload mappingjének összeírása
- [x] Health signal threshold-ok meghatározása
- [x] Scheduled task outcome taxonomy rögzítése
### 2. Implementáció

- [x] GitHub webhook normalizáló adapter létrehozása
- [x] Health anomaly adapter kialakítása
- [x] Scheduled task runner event bridge bevezetése
- [x] Deployment analyzer output becsatlakoztatása GitHub failure eseményekhez
### 3. Integráció

- [x] Event Fabric publish flow bekötése mindhárom forrásnál
- [x] Dedup kulcsok és prioritási mapping finomhangolása
### 4. Validáció

- [x] Mock GitHub workflow_run failure teszt
- [x] Health degradációs smoke teszt
- [x] Scheduled task success/failure event smoke teszt

## Megjegyzések

- Elsődleges függőségek: `zero_prompt_event_fabric_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
