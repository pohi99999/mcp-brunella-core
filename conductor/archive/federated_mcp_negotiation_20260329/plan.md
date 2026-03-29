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

- [ ] Negotiation message schema és állapotgép megírása
- [ ] Elfogadási küszöbök és approval pontok definiálása
### 2. Implementáció

- [ ] Negotiation protocol modul létrehozása
- [ ] Offer/counter-offer/reject/accept flow implementálása
- [ ] Transcript és audit mentés hozzáadása
### 3. Integráció

- [ ] Federated gateway és Approval Router összekötése
- [ ] Policy Engine üzleti guardrail-jeinek bekapcsolása
### 4. Validáció

- [ ] Egyszerű negotiation happy-path teszt
- [ ] Approval-required negotiation branch teszt
- [ ] Reject/cancel branch teszt

## Megjegyzések

- Elsődleges függőségek: `federated_mcp_remote_routing_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
