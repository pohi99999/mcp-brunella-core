# Spec: Brunella Remote Layer — Fázis 6: Evolutionary Collective Intelligence

## Track ID

`remote_layer_phase6_collective_evolution_20260322`

## Forrás

- `f:\mcp-brunella-core\.worktrees\Brunella_superinnteligencia.md`
- Implementációs prompt: Fázis 6.
- Fő témák: evolutionary agents, GeneticFlow, Topology AI, Collective Mind, Meta Reasoner, Unified Runtime, autonóm kernel.

## Cél

1. A Brunella legyen képes saját agentjei és workflow-i evolúciós fejlesztésére.
2. A mesh topológia és a kollektív reasoning váljon prediktívvé és meta-szintűvé.
3. A PAIOS + Brunella kapcsolat lépjen át bridge-ből közös runtime-ba.
4. A kernel kapjon valós autonóm koordinációs és meta-reasoning képességeket.

## Scope

- `src/agents/evolution/EvolutionaryAgent.ts`
- `src/agents/evolution/EvolutionManager.ts`
- `src/core/geneticFlow.ts`
- `src/mesh/topologyAI.ts`
- `src/core/collectiveMind.ts`
- `src/core/metaReasoner.ts`
- `src/core/unifiedRuntime.ts`
- `src/kernel/BrunellaKernel.ts` autonóm bővítései
- dashboard panelek Evolution Lab, Genetic Flows, Topology AI, Collective Mind, Meta Reasoner, Unified Runtime, Kernel autonómia témákra

## Kimenetek

- Sandboxolt evolutionary agent framework
- GeneticFlow workflow optimalizációs motor
- Topology AI mesh topológia-javaslatokkal
- Collective Mind és Meta Reasoner szolgáltatások
- Unified Runtime PAIOS + Brunella közös memóriával és workflow-val
- Autonóm kernel állapot- és döntésréteg

## Nem része ennek a fázisnak

- Self-replicating infrastruktúra
- Planet-scale mesh
- Tudat-, superintelligence- vagy singularity kernel szint

## Elfogadási kritériumok

- Az evolutionary agent framework képes legalább prompt/tool/workflow mutációkra biztonságos sandboxban.
- A GeneticFlow több workflow-variánst értékel és választ.
- A Topology AI képes topológia-optimalizációs javaslatot adni.
- A Collective Mind és Meta Reasoner API-kból lekérdezhető állapot és reasoning érhető el.
- A Unified Runtime demonstrálja a PAIOS + Brunella közös contextet.
- `npm run build` sikeres.
- `npm test` sikeres.

## Függőségek

- `remote_layer_phase5_adaptive_swarms_20260322`

## Megjegyzés

Ez a fázis választja szét a “jó remote platform” és az “önfejlesztő kollektív intelligencia” kategóriáit.
