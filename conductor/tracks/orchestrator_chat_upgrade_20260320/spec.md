# Spec: Universal Orchestrator Chat Upgrade (2026-03-20)

## Track ID
`orchestrator_chat_upgrade_20260320`

## Cél
1. Dashboard chat felületet a modern universal orchestrator útvonalra kötni.
2. GitHub modellek előtérbe helyezése, de provider/model váltás megtartása.
3. CLI chatben opcionális orchestrator mód biztosítása agent delegálással.
4. Response UX javítása: delegált taskok, provider, model, thinking time.

## Scope
- `src/server/routes/paiosOrchestrator.ts`
- `src/core/universalOrchestratorService.ts`
- `src/dashboard/components/dashboard/PAIOSOrchestratorChat.tsx`
- `src/cli.ts`
- `test/paiosOrchestrator.test.ts`

## Elfogadási kritériumok
- `/api/paios/chat` kompatibilis marad, de universal orchestration backendet használ.
- Dashboard üzenetküldés provider+model+history paramétereket küld.
- CLI chat képes orchestrator módban futni és akciókat kijelezni.
- `npm run build` sikeres.
- `npm test` sikeres.
