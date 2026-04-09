# Specifikacio: Agent Registry Governance & Consolidation

## Hatter
A Brunella rendszerben az agent lista, a Master Context es a rendszerleiras mar most tobbszorosen tavolodo igazsagforrasok. Ez a track a registry-higieniat es a konszolidacios javaslatokat egyetlen governable folyamattabba szervezi.

## Scope
- Canonical agent registry normalizalas.
- Duplikalt agent nevek es capability atfedesek detektalasa.
- Stale vagy never-used agentek azonositasa.
- Audit riportok generalasa es megjelenitese.
- Dashboard + CLI felszin bekotese.

## Outside scope
- Automatikus agent torles vagy merge.
- Agent viselkedes atirasa.
- Kulso registry szinkronizacio mas repo-kkal.

## Implementacios celpontok
- `src/tools/agentRegistryAudit.ts`
- `src/tools/agentRegistryRecommendations.ts`
- `src/server/registry.ts`
- `src/dashboard/components/dashboard/AgentRegistryCard.tsx`
- `src/dashboard/components/dashboard/AgentRegistryHealthPanel.tsx`
- `src/cli/agentGovernanceCommands.ts`
- `test/agentRegistryAudit.test.ts`
- `test/dashboard/components/AgentRegistryHealthPanel.test.tsx`

## Acceptance kriteriumok
- A registry audit reprodukalhato.
- A duplikaciok es stale agentek explicit listazva vannak.
- A dashboard panel es a CLI ugyanazt a canonical riportot jeleniti meg.
- A trackhez tartozó tesztek zoldre futnak.

## Rollout
1. Schema es audit engine.
2. Javaslat generacio.
3. Dashboard/CLI integracio.
4. Verifikacio es track rescan.
