# System-Wide Zero-Mock & ReAct Upgrade

## Forrás

- Legacy taskcsomag: `tasks/system-wide-zero-mock/`
- Audit dátum: `2026-04-01`

## Cél

A Brunella Agent System kulcs-ügynökeinek átváltása olyan működésre, ahol nem fiktív terveket vagy
szöveges „mock” válaszokat adnak vissza, hanem valós eszközhívásokkal hajtanak végre fájlműveletet,
tesztfuttatást, státuszüzenetet és böngészőindítást.

## Verifikált implementációs bizonyítékok

- `src/agents/OrchestratorAgent.ts`
  - `getBifrostGateway()` használat
  - `delegate_task`, `get_agent_status`, `send_message_to_user` toolok
  - prompt hardening az azonnali cselekvéshez
- `src/agents/DeveloperAgent.ts`
  - `read_file`, `write_file`, `replace_in_file`, `run_shell_command` eszközkészlet
  - explicit „NINCS MOCK KÓD” szabályrendszer
- `src/agents/EvaluatorAgent.ts`
  - `EVALUATOR_TOOLS`
  - valós `run_shell_command` és `get_system_health` futtatás
- `src/utils/llmPlanner.ts`
  - URL nélküli böngészőindítás esetén `about:blank` fallback logika
- `src/agents/RobotkezV2Agent.ts`
  - böngészőnyitási terv `about:blank` lappal
- `src/orchestrator/orchestratorCore.ts`
  - a PAIOS chat route a Zero-Mock `OrchestratorAgent`-hez delegál

## Definition of Done

- [x] Az Orchestrator nem generál felesleges markdown végrehajtási terveket egyértelmű parancsokra.
- [x] A Robotkez URL nélkül is képes üres böngészőt nyitni.
- [x] A DeveloperAgent valós fájlműveleteket és shell parancsokat használ.
- [x] Az EvaluatorAgent csak tényleges ellenőrzés után ad teszteredményt.
- [x] A legacy task conductor completed trackként rögzítve.

## Kapcsolódó canonical trackek

- `conductor/archive/orchestrator_cognition_upgrade_20260320/`
- `conductor/archive/robotkezv2-full-comet-20260215/`
