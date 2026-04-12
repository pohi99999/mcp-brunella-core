# Végrehajtási Terv: Federated MCP — Negotiation Protocol

**Track ID:** `federated_mcp_negotiation_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/federation/negotiationProtocol.ts
- Negotiation state machine
- Approval checkpoints a kritikus ajánlatokra
- Transcript / audit trail

## Todo lista

### 1. Protocol design

- [x] Negotiation message schema és állapotgép megírása
- [x] Elfogadási küszöbök és approval pontok definiálása
### 2. Implementáció

- [x] Negotiation protocol modul létrehozása
- [x] Offer/counter-offer/reject/accept flow implementálása
- [x] Transcript és audit mentés hozzáadása
### 3. Integráció

- [x] Federated gateway és Approval Router összekötése
- [x] Policy Engine üzleti guardrail-jeinek bekapcsolása
### 4. Validáció

- [x] Egyszerű negotiation happy-path teszt
- [x] Approval-required negotiation branch teszt
- [x] Reject/cancel branch teszt

## Végső validáció (2026-03-30)

- Strukturált offer / counter-offer / accept / reject flow és transcript audit elérhető ✅
- Dashboard panel és REST route látható a Brunellában ✅
- `npx vitest run test/federationRoutes.test.ts test/federation/federatedGateway.test.ts` ✅
- `npx vitest run --config vitest.dashboard.config.ts test/dashboard/components/FederationCenter.test.tsx` ✅

## Megjegyzések

- Elsődleges függőségek: `federated_mcp_remote_routing_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
