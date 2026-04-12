# Track Plan: L5 Zero-Touch Számla Pipeline — Teljes Automatizáció

**ID:** `l5_invoice_zerotouchl_20260410`
**Státusz:** COMPLETED
**Progress:** 100%

## Cél

A jelenlegi Invoice Automation alapot L5 szintű, eseményvezérelt zero-touch pipeline-ná alakítani, ahol a számlaérkezéstől a Drive/Sheets/NAV frissítésig a happy path automatikusan lezajlik.

## Fázisok

### Phase 1: Track bootstrap és domain-szinkron ✅

- [x] `InvoiceAutomationAgent` és `InvoiceAutomationWidget` jelenlegi állapotának baseline auditja
- [x] Event/outbox flow-szabályok rögzítése a zero-touch happy path-ra
- [x] `conductor/project_state.json` és track metadata szinkron ellenőrzése
- [x] Döntés rögzítése: nincs külön child track, a teljes scope ebben a trackben marad

### Phase 2: Zero-touch happy path hardening ✅

- [x] Gmail → Vision → Drive → Sheets happy path megerősítése (L5 Refaktor)
- [x] Outbox/saga események bekötése a számlafeldolgozási lépésekhez (EventBus integráció)
- [x] Idempotens futtatás és duplikációvédelem (DB szintű csekk)
- [x] Manual-check ág csak kivételes esetekre (Brunella-Manual-Check label)

### Phase 3: Exception és NAV ág ✅

- [x] NAV validációs és hibaág kezelése (NavCrossCheckAgent integration)
- [x] Failure label / queue / audit trail pontosítása (EventBus + invoices table)
- [x] Riasztási és összegző események ellenőrzése (InvoicePipeline orchestrator)
- [x] Zero-touch orchestration service létrehozása (InvoicePipeline)

### Phase 4: UI, CLI, tesztek, lezárás ✅

- [x] Dashboard állapotkártyák és progress mutatók (History view hozzáadva)
- [x] CLI summary / status parancsok ellenőrzése (`brunella invoice status`)
- [x] Integrációs és regressziós tesztek (`npm run test:fast` PASS)
- [x] Build + fast test validáció
- [x] Track lezárási döntés: COMPLETED

## Definíció of Done

- A számla feldolgozás zero-touch happy path-on végigfut ✅
- Az exception ág nyomon követhető és auditált ✅
- A dashboard és a CLI visszaadja a pipeline aktuális állapotát ✅
- Nincs további child trackre szükség ehhez a scope-hoz ✅
