# Specifikáció: Federated MCP — Negotiation Protocol

**Track ID:** `federated_mcp_negotiation_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Státusz:** PROPOSED  
**Prioritás:** MEDIUM  
**Függőségek:** `federated_mcp_remote_routing_20260329`

## 1. Cél

A federated MCP ne csak remote execute legyen, hanem magasabb szintű, kontrollált negotiation is, ahol a BAS képviseli a saját költség-, biztonsági és policy érdekeit.

## 2. Scope

### Benne van
- Negotiation message schema
- Offer / counter-offer / reject / accept state machine
- Policy és approval checkpointok tárgyalás közben
- Negotiation transcript és audit

### Nincs benne
- Valódi szerződéskötő jogi automatizmus
- Automatikus pénzügyi settlement
- Nem-MCP külső marketplace integrációk

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/federation/negotiationProtocol.ts`
- Érintett vagy várható fő fájl/modul: `src/core/approvalRouter.ts`
- Érintett vagy várható fő fájl/modul: `src/core/federation/federatedGateway.ts`
- Érintett vagy várható fő fájl/modul: `src/core/policyEngine.ts`
- Érintett vagy várható fő fájl/modul: `src/tools/negotiationEngine.ts`

## 4. Fő deliverable-ek

- src/core/federation/negotiationProtocol.ts
- Negotiation state machine
- Approval checkpoints a kritikus ajánlatokra
- Transcript / audit trail

## 5. Sikerkritériumok

- A BAS tud strukturált ajánlatot és ellenajánlatot kezelni
- Kritikus üzleti küszöbértékek fölött approval checkpoint lép be
- A teljes tárgyalási transcript auditálható
- A negotiation outcome integrálható a remote routing flowba

## 6. Guardrail-ek és kockázatok

- Approval nélküli elfogadás üzleti kockázatot jelent
- Rosszul definiált schema miatt félreértik egymást a partnerek
- Transcript nélkül nincs elszámoltathatóság
