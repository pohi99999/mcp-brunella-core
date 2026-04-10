# Specifikacio: Phoenix + Data Flywheel Observability & Self-Healing

## Hatter
A Phoenix Protocol es a Data Flywheel jelenleg kulon jelenti a rendszer allapotanak reszeit. Ez a track ezeket egyetlen observability es self-healing view-va fuzzi ossze.

## Scope
- Phoenix error / retry / checkpoint metrikak.
- Data Flywheel pipeline health metrikak.
- Mitigation recommendation output.
- Dashboard panel es CLI status felszin.
- Track generation output a gyakori mintakhoz.

## Outside scope
- Runtime policy rewrite.
- Agent viselkedes automatikus atirasa.
- Teljes ML modellcsere ebben a trackben.

## Implementacios celpontok
- `src/core/phoenixEventBus.ts`
- `src/core/checkpoint.ts`
- `src/core/goldenDatasetBridge.ts`
- `src/core/metricsArchiveService.ts`
- `src/core/telemetry.ts`
- `src/tools/phoenixInsights.ts`
- `src/tools/dataFlywheelMetrics.ts`
- `src/dashboard/components/dashboard/PhoenixPanel.tsx`
- `src/dashboard/components/dashboard/PhoenixEventsPanel.tsx`
- `src/dashboard/components/dashboard/RemediationRunsPanel.tsx`
- `src/cli/observabilityCommands.ts`
- `test/phoenixInsights.test.ts`
- `test/dataFlywheelMetrics.test.ts`

## Acceptance kriteriumok
- A hibak es trendek csoportositottan latszanak.
- A self-healing javaslatok konkretak es reprodukalhatok.
- A dashboard es CLI azonos metrikakat mutat.
- A trackhez kapcsolodo tesztek zoldre futnak.

## Rollout
1. Metric aggregation.
2. Mitigation engine.
3. Dashboard/CLI integration.
4. Verification and rollout.
