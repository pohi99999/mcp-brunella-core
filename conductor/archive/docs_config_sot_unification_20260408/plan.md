# Implementacios Terv: Documentation/Config Single Source of Truth Unification

## Cel
Egyetlen canonical tudas- es konfiguracios modellre kell epiteni a Brunella dokumentaciojaval es configjaval kapcsolatos derive-olt neveket, hogy a README, a Master Context, a RENDSZER.md es a config fajlok ne csusszanak szet.

## Kiindulasi alap
- `README.md`
- `BRUNELLA_MASTER_CONTEXT.md`
- `RENDSZER.md`
- `conductor/tracks.md`
- `src/config/paiosConfig.ts`
- `src/config/schema.ts`
- `scripts/update_master_context.ts`
- `scripts/sync_doc_stats.ts`

## Fazisok
### 1. Canonical SOT modell
- Strukturalt architecture/agents/tracks/infra/security modell definialasa.
- Doc es config mezok normalizalasa.
- Read-only JSON valtozat letrehozasa.

### 2. Derive-olt dokumentumok
- Doc unifier tool implementalasa.
- README / Master Context / RENDSZER diff es drift riport generalasa.
- Derived doc sync folyamat kialakitasa.

### 3. Config guardian
- Config schema bovites PAIOS, Edge, Google Workspace es helyi kulcsokkal.
- .env / .env.example drift checker.
- Config health riportok eloallitasa.

### 4. UX es integracio
- Dashboard config health vagy SOT panel bekotese.
- CLI docs/config health parancsok.
- MCP tool regisztracio.

### 5. Verifikacio
- SOT diff tesztek.
- Config schema tesztek.
- Build, doc sync es conductor rescan ellenorzes.

## Acceptance kriteriumok
- A canonical SOT model elerheto es derive-olhato.
- A config drift jelzes explicit.
- A dokumentacio es config health feluletek ugyanazt a source-of-truth modelt hasznaljak.
- A track active marad es a kapcsolodo tesztek zoldek.
