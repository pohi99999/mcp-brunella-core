# Spec — Safe Autopilot Orchestrator (Level 3)

## Cél
A Brunella orchestrator ne csak reagáljon, hanem biztonságosan, proaktívan végrehajtson többfázisú operátori workflow-kat.

## Követelmények
1. Cél → többfázisú akcióterv automatikus indítása
2. Approval checkpoint high-risk műveletek előtt
3. Monitor + auto-heal loop (timeout/error/stall detektálás)
4. Incident Commander mód (diagnózis → terv → delegálás → státusz)
5. Runbook memory 2.0 (sikeres minták és agent kombók)
6. Mission Timeline kimenet dashboard/CLI megjelenítéssel

## Kimenetek
- `UniversalOrchestratorService` intent-router + safe-autopilot workflow-k
- Route/DTO bővítés approval/timeline mezőkkel
- Dashboard PAIOS timeline + approval UI
- CLI timeline + approval parancs
