# Specifikáció: L5 Zero-Touch Számla Pipeline — Teljes Automatizáció

**Track ID:** `l5_invoice_zerotouchl_20260410`
**Prioritás:** HIGH
**Tulajdonos:** Claude
**Létrehozva:** 2026-04-10
**Utolsó audit:** 2026-04-11
**Alap:** `invoice_automation_20260326` + `l5_hook_engine_20260410` + `l5_event_store_outbox_20260410`

---

## Hátter

A meglévő `InvoiceAutomationAgent` már képes Gmailből számlákat feldolgozni, Gemini Vision-nel adatot kinyerni, Drive-ra menteni és Sheets-be rögzíteni. Ez a track ezt a folyamatot L5 szintre emeli: eseményvezérelt, outbox-alapú, saga-szerű, minimális emberi beavatkozással működő zero-touch pipeline-ná alakítja.

---

## Scope

- Gmail számlaértesítések és mellékletek automatikus beolvasása
- Vision/OCR alapú adatkinyerés és normalizálás
- Drive + Sheets + könyvelési státusz automatikus frissítés
- NAV validáció és exception queue kezelés
- Event store / outbox / hook integráció
- Dashboard és CLI observability a zero-touch flow-hoz
- Integrációs és regressziós tesztek

## Outside scope

- Teljes ERP csere
- Külön könyvelői human review UX a happy path-on
- Új pénzügyi domain hozzáadása a pipeline-on túl
- Külső SaaS átállás, ha nem a számla flow-hoz tartozik

---

## Acceptance kritériumok

- A happy path-on nincs manuális közbeavatkozás
- A számla feldolgozási esemény outbox-on keresztül kerül továbbításra
- A `InvoiceAutomation` agent és a dashboard widget regisztrálva van
- NAV / exception ág esetén audit és manual-check jelzés készül
- `npm run build` és `npm run test:fast` zöld

---

## Architektúra / működési elv

1. Gmail triggerből érkező számlaesemény
2. Hook engine / outbox esemény létrehozása
3. `InvoiceAutomationAgent` feldolgozás, Vision kinyerés
4. Drive/Sheets/NAV műveletek saga-szerűen végrehajtva
5. Hiba esetén exception queue + manual-check címke
6. Dashboard státusz és CLI összegzés frissítése

---

## Megjegyzés a track-stratégiáról

Ehhez a scope-hoz külön child track nem szükséges: a zero-touch happy path és az exception path ugyanebben a trackben lezárható. Ha később külön domain (például partnerkommunikáció vagy NAV-only hardening) nő ki belőle, akkor az külön follow-up track lesz.
