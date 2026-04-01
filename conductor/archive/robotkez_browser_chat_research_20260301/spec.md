# Robotkez browser chat research

## Forrás

- Legacy kutatási csomag: `tasks/robotkez-browser-chat-impl/RESEARCH.md`
- Kiegészítő diagnózis: `tasks/robotkez-browser-chat-impl/RESEARCH_PAIOS.md`

## Téma

Annak feltárása, miért tervez túl az Orchestrator, amikor a felhasználó csak böngészőnyitást és
böngészőchatet kér a Robotkéztől.

## Jelenlegi runtime kapcsolódás

- `src/agents/OrchestratorAgent.ts`
- `src/agents/RobotkezV2Agent.ts`
- `src/utils/llmPlanner.ts`
- `src/orchestrator/orchestratorCore.ts`

## Archiválási indok

A kutatás eredménye különálló feature-track helyett a későbbi Zero-Mock prompt- és runtime-fixekbe
olvadt be. Historical research note-ként marad meg a conductor archívumban.
