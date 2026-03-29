# Specifikáció: Federated MCP — Trust Layer

**Track ID:** `federated_mcp_trust_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `zero_prompt_policy_engine_20260329`, `remote_layer_phase1_foundation_20260322`

## 1. Cél

A Brunella csak megbízható, explicit jóváhagyott és policy szerint engedélyezett remote agentekkel kommunikálhasson.

## 2. Scope

### Benne van
- Trusted peer registry és identity metadata
- AuthN/AuthZ alapkövetelmények remote MCP irányba
- Data minimization policy és capability visibility szabályok
- Trust state lifecycle és revocation

### Nincs benne
- Signed manifests részletes implementáció
- Negotiation protocol
- Teljes PKI/Mesh infrastruktúra minden deploymentre

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/federation/trustRegistry.ts`
- Érintett vagy várható fő fájl/modul: `cloudflare/src/edge-coordinator.ts`
- Érintett vagy várható fő fájl/modul: `src/server/routes/remote.ts`
- Érintett vagy várható fő fájl/modul: `src/core/policyEngine.ts`
- Érintett vagy várható fő fájl/modul: `src/core/phoenixEventBus.ts`

## 4. Fő deliverable-ek

- src/core/federation/trustRegistry.ts
- Remote peer metadata schema
- Revocation és trust review folyamat
- Policy hook a remote routing elé

## 5. Sikerkritériumok

- Ismeretlen peerhez a BAS nem routol capability-t
- Trust state és revocation visszakövethető
- Capability láthatóság peer-szinten korlátozható
- A remote kapcsolat előfeltételeként policy- és trust-check fut

## 6. Guardrail-ek és kockázatok

- Gyenge trust modell teljes rendszerkitettséget okozhat
- Peer metadata rot gyorsan elavulhat
- Revocation nélküli kapcsolat hosszú távú kockázat
