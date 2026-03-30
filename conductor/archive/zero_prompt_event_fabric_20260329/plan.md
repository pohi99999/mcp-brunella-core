# Végrehajtási Terv: Zero-Prompt Core — Event Fabric

**Track ID:** `zero_prompt_event_fabric_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/eventFabric.ts
- EventEnvelope TypeScript típusok és adapter contract
- Perzisztens event history / replay tárolás
- GitHub + health + scheduler event adapterek

## Todo lista

### 1. Design és séma

- [x] EventEnvelope séma és source adapter contract megírása
- [x] Priority, risk-hint és dedupe kulcs szabályok definiálása
- [x] Replay és retention stratégia rögzítése
### 2. Implementáció

- [x] Event Fabric core modul létrehozása
- [x] GitHub webhook adapter bekötése
- [x] Health watcher adapter bekötése
- [x] Scheduled task adapter bekötése
- [x] Event store / history réteg létrehozása
### 3. Integráció

- [x] Phoenix Event Bus bridge és Socket.IO broadcast összekötése
- [x] Minimális API vagy CLI nézet biztosítása az event historyhoz
### 4. Validáció

- [x] Duplikált eseményekre idempotencia teszt
- [x] Replay flow ellenőrzése manuális teszttel
- [x] Forrásonként legalább egy integrációs teszt hozzáadása

## Megjegyzések

- Elsődleges függőségek: nincs
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
