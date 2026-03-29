# Specifikáció: Federated MCP — Remote Capability Routing

**Track ID:** `federated_mcp_remote_routing_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `federated_mcp_trust_20260329`, `federated_mcp_signed_manifests_20260329`

## 1. Cél

A BAS képes legyen eldönteni, mikor és melyik trusted partnerhez delegálhat részfeladatot, capability, latency, cost és trust alapján.

## 2. Scope

### Benne van
- Remote peer capability discovery
- Routing decision cost/trust/latency szempontokkal
- Fallback és failure handling remote delegációnál
- Auditált remote invocation flow

### Nincs benne
- Negotiation protocol
- Külső billing/settlement rendszer
- Teljes mesh autonóm cluster

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/federation/federatedGateway.ts`
- Érintett vagy várható fő fájl/modul: `src/core/federation/trustRegistry.ts`
- Érintett vagy várható fő fájl/modul: `src/core/federation/capabilityManifest.ts`
- Érintett vagy várható fő fájl/modul: `cloudflare/src/edge-coordinator.ts`
- Érintett vagy várható fő fájl/modul: `src/core/modelRouter.ts`

## 4. Fő deliverable-ek

- src/core/federation/federatedGateway.ts
- Remote routing decision engine
- Fallback és retry policy
- Invocation audit és telemetry

## 5. Sikerkritériumok

- A BAS trusted peer capability alapján tud remote részfeladatot választani
- Failure esetén fallback vagy safe abort történik
- Minden remote hívás auditált és policy-ellenőrzött
- A routing decision figyelembe veszi a trust és manifest adatokat

## 6. Guardrail-ek és kockázatok

- Rossz routing döntés túl sok külső függést hozhat be
- Latency vagy availability probléma elhúzhatja a teljes taskot
- Audit nélküli remote call átláthatatlansághoz vezet
