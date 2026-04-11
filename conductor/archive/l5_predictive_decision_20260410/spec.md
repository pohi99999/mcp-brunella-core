# L5 PredictiveDecisionEngine - Jovo Szimulalasa Monte Carlo — Spec

## Objective
Deliver a predictive decision layer that turns existing Brunella intelligence inputs into deterministic, auditable, and reversible internal actions. The track closes only when the engine, operator surfaces, scheduler, and hook flows are validated end-to-end.

## Problem Statement
Brunella already produces predictive alerts, world signals, review-queue items, and structured goals, but it still lacks the layer that compares possible futures and decides what safe internal action should happen next. Without this layer, operators can observe signals but cannot rely on a repeatable autonomous decision cycle.

## In Scope
- Build a predictive decision engine that consumes:
  - `src/core/predictiveIntelligence.ts`
  - `src/core/worldPerceptionLayer.ts`
  - `src/core/intelligenceMonitor.ts`
  - `src/core/goalEngine.ts`
- Generate deterministic Monte Carlo scenarios with configurable weights and seed support.
- Persist decision runs in SQLite, including:
  - source context
  - generated scenarios
  - selected scenario
  - executed action
  - rollback payload
  - timestamps and outcome
- Execute only safe reversible actions:
  - create a goal
  - acknowledge an alert
  - escalate a review item without destructive side effects
- Provide repo-native operator access through:
  - REST routes in `src/server/routes/predictiveDecision.ts`
  - CLI commands in `src/cli/predictiveDecisionCommands.ts`
  - dashboard API helper in `src/dashboard/lib/predictiveDecisionApi.ts`
  - dashboard panel in `src/dashboard/components/dashboard/PredictiveDecisionPanel.tsx`
  - scheduler integration in `src/server/schedulers/scheduledTasksRunner.ts`
  - hook catalog and advanced hook handlers

## Out of Scope
- External infrastructure mutation
- Non-reversible automation
- Multi-agent decision arbitration
- Human-facing financial strategy modeling beyond the existing internal signal set

## Acceptance Criteria
- [x] Decision analysis uses real repo inputs instead of placeholders or synthetic-only state.
- [x] Monte Carlo generation is deterministic for the same config and seed.
- [x] Executed actions persist rollback data and can be reversed through the public engine path.
- [x] REST, CLI, dashboard, scheduler, and hook surfaces all compile against the same data contract.
- [x] Focused backend and dashboard regression coverage exists for the new predictive slice.
- [x] `npm run build` and `npm run build:ui` pass with the predictive slice enabled.
- [x] The track can be archived without creating a follow-up unless validation reveals a distinct next scope.

## Current State
- Core predictive source files were manually rewritten to match BAS patterns after a delegated implementation introduced placeholders and regressions.
- PredictiveDecisionEngine now initializes its SQLite schema lazily, which removed import-time side effects that were polluting scheduler tests.
- Focused predictive validation is complete across engine, executor, route, CLI, scheduler, dashboard API, and dashboard panel surfaces.
- No predictive-specific follow-up track is required; the delivered scope closes at archive.

## Affected Files
- `src/core/decisionTypes.ts`
- `src/core/decisionExecutor.ts`
- `src/core/predictiveDecisionEngine.ts`
- `src/core/predictiveIntelligence.ts`
- `src/core/goalEngine.ts`
- `src/core/hooks/builtinHookCatalog.ts`
- `src/core/advancedHooks.ts`
- `src/server/routes/predictiveDecision.ts`
- `src/server/routes/index.ts`
- `src/server/schedulers/scheduledTasksRunner.ts`
- `src/cli.ts`
- `src/cli/predictiveDecisionCommands.ts`
- `src/dashboard/lib/predictiveDecisionApi.ts`
- `src/dashboard/lib/navigation.tsx`
- `src/dashboard/components/dashboard/PredictiveDecisionPanel.tsx`

## Validation Targets
- `test/predictiveDecisionEngine.test.ts`
- `test/decisionExecutor.test.ts`
- `test/predictiveDecisionRoute.test.ts`
- `test/predictiveDecisionCommands.test.ts`
- `test/scheduledTasksRunner_predictiveDecision.test.ts`
- `test/dashboard/lib/predictiveDecisionApi.test.ts`
- `test/dashboard/components/PredictiveDecisionPanel.test.tsx`

## Validation Summary
- Focused backend validation passed:
  - `npx vitest run test/predictiveDecisionEngine.test.ts test/decisionExecutor.test.ts test/predictiveDecisionRoute.test.ts test/predictiveDecisionCommands.test.ts test/scheduledTasksRunner_predictiveDecision.test.ts test/scheduledTasksRunner_selfModification.test.ts test/scheduledTasksRunner_worldPerception.test.ts`
- Focused dashboard validation passed:
  - `npx vitest run --config vitest.dashboard.config.ts test/dashboard/lib/predictiveDecisionApi.test.ts test/dashboard/components/PredictiveDecisionPanel.test.tsx`
- Build validation passed:
  - `npm run build`
  - `npm run build:ui`
- Repo-wide `npm run test:fast` still reports unrelated baseline CLI failures in `test/securityCommands.test.ts` and `test/swarmCommands.test.ts`; those files are outside the predictive slice and do not block this track closure.
