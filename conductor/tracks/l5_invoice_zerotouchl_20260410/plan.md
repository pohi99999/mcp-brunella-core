# Track Plan: L5 Zero-Touch Számla Pipeline — Teljes Automatizáció

**ID:** `l5_invoice_zerotouchl_20260410`
**Státusz:** ACTIVE
**Progress:** 0%

## Cél

A jelenlegi Invoice Automation alapot L5 szintű, eseményvezérelt zero-touch pipeline-ná alakítani, ahol a számlaérkezéstől a Drive/Sheets/NAV frissítésig a happy path automatikusan lezajlik.

## Fázisok

### Phase 1: Track bootstrap és domain-szinkron

- [ ] `InvoiceAutomationAgent` és `InvoiceAutomationWidget` jelenlegi állapotának baseline auditja
- [ ] Event/outbox flow-szabályok rögzítése a zero-touch happy path-ra
- [ ] `conductor/project_state.json` és track metadata szinkron ellenőrzése
- [ ] Döntés rögzítése: nincs külön child track, a teljes scope ebben a trackben marad

### Phase 2: Zero-touch happy path hardening

- [ ] Gmail → Vision → Drive → Sheets happy path megerősítése
- [ ] Outbox/saga események bekötése a számlafeldolgozási lépésekhez
- [ ] Idempotens futtatás és duplikációvédelem
- [ ] Manual-check ág csak kivételes esetekre

### Phase 3: Exception és NAV ág

- [ ] NAV validációs és hibaág kezelése
- [ ] Failure label / queue / audit trail pontosítása
- [ ] Riasztási és összegző események ellenőrzése

### Phase 4: UI, CLI, tesztek, lezárás

- [ ] Dashboard állapotkártyák és progress mutatók
- [ ] CLI summary / status parancsok ellenőrzése
- [ ] Integrációs és regressziós tesztek
- [ ] Build + fast test validáció
- [ ] Track lezárási döntés: archíválás vagy follow-up track, ha új domain nő ki

## Első teendők

1. Meglévő invoice agent és widget audit
2. Outbox / saga kapcsolódási pontok kijelölése
3. Minimális teszt-szett összeállítása

## Definíció of Done

- A számla feldolgozás zero-touch happy path-on végigfut
- Az exception ág nyomon követhető és auditált
- A dashboard és a CLI visszaadja a pipeline aktuális állapotát
- Nincs további child trackre szükség ehhez a scope-hoz

