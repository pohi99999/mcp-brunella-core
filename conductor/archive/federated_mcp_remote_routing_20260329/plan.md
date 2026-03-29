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

- [ ] Capability discovery és peer selection szabályok definiálása
- [ ] Fallback és safe-abort stratégia rögzítése
### 2. Implementáció

- [ ] Federated gateway modul létrehozása
- [ ] Remote peer selection engine implementálása
- [ ] Invocation audit és retry policy hozzáadása
### 3. Integráció

- [ ] Trust és manifest verification bekötése a routing elé
- [ ] Orchestrator és policy engine kapcsolódási pontok kidolgozása
### 4. Validáció

- [ ] Trusted peer routing smoke teszt
- [ ] Unavailable peer fallback teszt
- [ ] Remote deny path teszt policy tiltásnál

## Megjegyzések

- Elsődleges függőségek: `federated_mcp_trust_20260329`, `federated_mcp_signed_manifests_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
