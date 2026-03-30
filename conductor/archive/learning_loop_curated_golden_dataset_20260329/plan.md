# Végrehajtási Terv: Learning Loop — Curated Golden Dataset

**Track ID:** `learning_loop_curated_golden_dataset_20260329`  
**Fázis:** Fázis 2 — Learning Loop  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- Curated sample schema
- Golden sample candidate → approved flow
- PII redaction és provenance pipeline
- Review queue / promotion szabályrendszer

## Todo lista

### 1. Adatmodell

- [x] Curated sample schema megírása quality, provenance és approval mezőkkel
- [x] Candidate és approved állapotok definiálása
- [x] Redaction / review queue tárolási séma rögzítése
### 2. Implementáció

- [x] Reflection outcome candidate capture kiegészítése
- [x] PII redaction réteg bekötése
- [x] Quality threshold és dedupe logika implementálása
- [x] Approved promotion flow elkészítése
### 3. Integráció

- [x] Memory/golden stat endpointok bővítése curated mutatókkal
- [x] Approval Routerből approved action outcome-ok becsatlakoztatása
### 4. Validáció

- [x] PII redaction tesztminták futtatása
- [x] Dedupe és quality gate tesztek
- [x] Export formátum ellenőrzése a trainer számára

## Megjegyzések

- Elsődleges függőségek: nincs
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
