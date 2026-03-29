# Specifikáció: Federated MCP — Signed Capability Manifests

**Track ID:** `federated_mcp_signed_manifests_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Státusz:** PROPOSED  
**Prioritás:** HIGH  
**Függőségek:** `federated_mcp_trust_20260329`

## 1. Cél

A remote routing és capability discovery csak hiteles, verziózott és aláírt manifestekre épülhessen.

## 2. Scope

### Benne van
- Capability manifest schema
- Sign/verify workflow
- Versioning és deprecation mezők
- Manifest storage és cache policy

### Nincs benne
- Remote execution routing maga
- Negotiation contract
- Teljes third-party marketplace

## 3. Architektúra és illeszkedés

- Érintett vagy várható fő fájl/modul: `src/core/federation/capabilityManifest.ts`
- Érintett vagy várható fő fájl/modul: `src/core/dynamicToolRegistry.ts`
- Érintett vagy várható fő fájl/modul: `src/server/registry.ts`
- Érintett vagy várható fő fájl/modul: `src/core/federation/trustRegistry.ts`
- Érintett vagy várható fő fájl/modul: `cloudflare/src/index.ts`

## 4. Fő deliverable-ek

- src/core/federation/capabilityManifest.ts
- Manifest sign/verify utility
- Peer manifest cache
- Schema validation és expiry kezelés

## 5. Sikerkritériumok

- A BAS tud saját capability manifestet publikálni
- A BAS csak érvényes aláírású remote manifestet fogad el
- Lejárt vagy sérült manifest nem használható routingra
- A manifest verzió- és deprecációs adatai láthatók

## 6. Guardrail-ek és kockázatok

- Gyenge aláírás-kezelés hamis capability disclosure-höz vezethet
- Cache invalidation hibák elavult manifestet hagyhatnak aktívnak
- Túl nagy manifest túl sok érzékeny capability-t fedhet fel
