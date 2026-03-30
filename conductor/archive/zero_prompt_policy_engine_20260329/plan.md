# Végrehajtási Terv: Zero-Prompt Core — Policy Engine

**Track ID:** `zero_prompt_policy_engine_20260329`  
**Fázis:** Fázis 1 — Zero-Prompt Core  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/policyEngine.ts
- Risk / autonomy scoring contract
- Guardrail szabálykészlet kritikus műveletekre
- Policy audit log rekordok

## Todo lista

### 1. Policy modell

- [x] Risk score és autonomy level típusok definiálása
- [x] Safe / guarded / dangerous kategóriák szabályainak rögzítése
- [x] Approval requirement mezők és indoklási schema kidolgozása
### 2. Implementáció

- [x] Policy Engine core létrehozása
- [x] Event Fabric output fogadása és döntés generálása
- [x] Audit log és policy explanation támogatás beépítése
### 3. Integráció

- [x] Approval Router számára machine-readable decision output adása
- [x] Orchestrator és scheduled runner hookok bekötése
### 4. Validáció

- [x] Kritikus GitHub workflow failure esetre guarded döntés ellenőrzése
- [x] Egyszerű health eseményre safe automatikus döntés ellenőrzése
- [x] Policy regression tesztkészlet létrehozása

## Megjegyzések

- Elsődleges függőségek: `zero_prompt_event_fabric_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
