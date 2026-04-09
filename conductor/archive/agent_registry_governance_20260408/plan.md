# Implementacios Terv: Agent Registry Governance & Consolidation

## Cel
Egysges, audit-hu alapot kell letrehozni az agent registry, a Master Context es a RENDSZER dokumentacio kozott, hogy a duplikaciok, a stale agentek es a capability drift ne maradjanak rejtve.

## Kiindulasi alap
- `src/agents/registry.json`
- `src/agents/AgentManager.ts`
- `src/agents/registryValidation.ts`
- `src/agents/registryStandard.ts`
- `BRUNELLA_MASTER_CONTEXT.md`
- `RENDSZER.md`

## Fazisok
### 1. Canonical registry modell
- Normalizalt agent meta schema letrehozasa.
- Name/role/capabilities mezok osszehangolasa.
- Duplikacio es elavult bejegyzes felismeres.

### 2. Audit es javaslat motor
- Read-only registry audit tool implementalasa.
- Merge/archival javaslatok generálasa usage jelzok alapjan.
- Normalizalt JSON riport eloallitasa.

### 3. UX es integracio
- Dashboard health/hygiene panel bekotese.
- CLI audit parancs hozzaadasa.
- MCP tool regisztracio es regiszter tesztek.

### 4. Verifikacio
- Vitest unit tesztek az audit logikara.
- UI tesztek a hygiene panelre.
- Build es conductor rescan ellenorzes.

## Acceptance kriteriumok
- Egyetlen canonical registry audit riport elerheto.
- A duplikalt vagy stale agentek automatikusan jeloltek.
- Dashboard es CLI feluletrol is elerheto a riport.
- A track state manager az uj tracket active-kent listazza.
