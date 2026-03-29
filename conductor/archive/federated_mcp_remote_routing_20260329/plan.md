# Végrehajtási Terv: Federated MCP — Remote Capability Routing

**Track ID:** `federated_mcp_remote_routing_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/federation/federatedGateway.ts
- Remote routing decision engine
- Fallback és retry policy
- Invocation audit és telemetry

## Todo lista

### 1. Routing design

- [x] Capability discovery és peer selection szabályok definiálása
- [x] Fallback és safe-abort stratégia rögzítése
### 2. Implementáció

- [x] Federated gateway modul létrehozása
- [x] Remote peer selection engine implementálása
- [x] Invocation audit és retry policy hozzáadása
### 3. Integráció

- [x] Trust és manifest verification bekötése a routing elé
- [x] Orchestrator és policy engine kapcsolódási pontok kidolgozása
### 4. Validáció

- [x] Trusted peer routing smoke teszt
- [x] Unavailable peer fallback teszt
- [x] Remote deny path teszt policy tiltásnál

## Végső validáció (2026-03-30)

- A gateway most már retry + fallback útvonalat használ több peer között ✅
- Minden remote végrehajtás trust/policy/audit kontroll alatt fut ✅
- `npx vitest run test/federationRoutes.test.ts test/federation/federatedGateway.test.ts` ✅
- `node build/cli.js --help` → federation parancs elérhető ✅

## Megjegyzések

- Elsődleges függőségek: `federated_mcp_trust_20260329`, `federated_mcp_signed_manifests_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
