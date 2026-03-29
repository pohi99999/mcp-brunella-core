# Végrehajtási Terv: Federated MCP — Trust Layer

**Track ID:** `federated_mcp_trust_20260329`  
**Fázis:** Fázis 4 — Federated MCP  
**Célállapot:** PROPOSED → ACTIVE → TESTING → COMPLETED

## Kimenet

- src/core/federation/trustRegistry.ts
- Remote peer metadata schema
- Revocation és trust review folyamat
- Policy hook a remote routing elé

## Todo lista

### 1. Trust modell

- [x] Peer identity és trust state séma definiálása
- [x] Revocation és review cycle szabályok rögzítése
- [x] Minimal visibility policy meghatározása
### 2. Implementáció

- [x] Trust registry modul létrehozása
- [x] Remote peer ellenőrzési hookok bekötése
- [x] Revocation kezelő logika hozzáadása
### 3. Integráció

- [x] Remote route-ok elé trust check bevezetése
- [x] Audit és security események összekapcsolása
### 4. Validáció

- [x] Unknown peer deny teszt
- [x] Revoked peer deny teszt
- [x] Trusted peer handshake smoke teszt

## Végső validáció (2026-03-30)

- `npm run build` ✅
- `npm run build:ui` ✅
- `npx vitest run test/federationRoutes.test.ts test/federation/federatedGateway.test.ts` ✅
- `npx vitest run --config vitest.dashboard.config.ts test/dashboard/components/FederationCenter.test.tsx` ✅
- `node build/cli.js --help` → `federation|fed` parancsfelület látható ✅

## Megjegyzések

- Elsődleges függőségek: `zero_prompt_policy_engine_20260329`, `remote_layer_phase1_foundation_20260322`
- A megvalósításnak illeszkednie kell a BAS meglévő Phoenix / scheduler / agent / dashboard architektúrájához.
- Track lezárási minimum: dokumentált tesztstratégia, elfogadási kritériumok ellenőrzése, naplófrissítés.
