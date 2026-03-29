# Végrehajtási Terv: Federated MCP — Signed Capability Manifests

**Track ID:** `federated_mcp_signed_manifests_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/federation/capabilityManifest.ts
- Manifest sign/verify utility
- Peer manifest cache
- Schema validation és expiry kezelés

## Todo lista

### 1. Schema és signing

- [x] Capability manifest schema megírása
- [x] Aláírási és verify folyamat rögzítése
- [x] Expiry és version mezők definiálása
### 2. Implementáció

- [x] Manifest generator és verifier utility létrehozása
- [x] Peer manifest cache réteg kialakítása
- [x] Schema validation és failure handling hozzáadása
### 3. Integráció

- [x] DynamicToolRegistry / registry adatokból saját manifest előállítása
- [x] Trust layerrel közös verification flow bekötése
### 4. Validáció

- [x] Valid manifest acceptance teszt
- [x] Invalid signature reject teszt
- [x] Expired manifest reject teszt

## Végső validáció (2026-03-30)

- A helyi manifest több forrásból (DynamicToolRegistry + registered tools + tool registry) épül fel ✅
- A manifest verzió/deprecáció adatai a dashboardon is láthatók ✅
- `npm run build` ✅
- `npx vitest run test/federationRoutes.test.ts test/federation/federatedGateway.test.ts` ✅

## Megjegyzések

- Elsődleges függőségek: `federated_mcp_trust_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
