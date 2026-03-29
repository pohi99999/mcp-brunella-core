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

- [ ] Capability manifest schema megírása
- [ ] Aláírási és verify folyamat rögzítése
- [ ] Expiry és version mezők definiálása
### 2. Implementáció

- [ ] Manifest generator és verifier utility létrehozása
- [ ] Peer manifest cache réteg kialakítása
- [ ] Schema validation és failure handling hozzáadása
### 3. Integráció

- [ ] DynamicToolRegistry / registry adatokból saját manifest előállítása
- [ ] Trust layerrel közös verification flow bekötése
### 4. Validáció

- [ ] Valid manifest acceptance teszt
- [ ] Invalid signature reject teszt
- [ ] Expired manifest reject teszt

## Megjegyzések

- Elsődleges függőségek: `federated_mcp_trust_20260329`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
