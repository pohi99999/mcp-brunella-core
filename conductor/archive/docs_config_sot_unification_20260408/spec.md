# Specifikacio: Documentation/Config Single Source of Truth Unification

## Hatter
A Brunella rendszerben a dokumentacio es a config tobb master doksiban, scriptben es env fajlban oszlik meg. Ez a track olyan SOT reteg bevezeteset celzi, amelybol a tobbi dokumentum es health check szarmaztathato.

## Scope
- Canonical SOT adatmodell.
- Read-only dokumentacio unifier.
- Config drift es schema ellenorzes.
- Derived dokumentum generacio.
- Dashboard + CLI health felulet.

## Outside scope
- Automatizalt destructive config modositás.
- Kulfoldi repo szinkron.
- Teljes README rewrite egyetlen lepesben.

## Implementacios celpontok
- `src/tools/docUnifier.ts`
- `src/tools/configGuardian.ts`
- `src/config/schema.ts`
- `src/config/paiosConfig.ts`
- `scripts/sync_docs.ts`
- `scripts/update_master_context.ts`
- `src/dashboard/components/dashboard/DocsSotPanel.tsx`
- `src/dashboard/components/dashboard/ConfigHealthPanel.tsx`
- `src/cli/docsCommands.ts`
- `test/docUnifier.test.ts`
- `test/configGuardian.test.ts`

## Acceptance kriteriumok
- A SOT model egyetlen helyen definialja a Brunella alap strukturat.
- A docs/config drift riport automatizalhato.
- A dashboard es CLI feluletek ugyanazt a health allapotot mutatjak.
- A trackhez tartozó tesztek es a build sikeres.

## Rollout
1. SOT adatmodell.
2. Read-only unifier.
3. Config guardian.
4. Derived docs + health surfaces.
