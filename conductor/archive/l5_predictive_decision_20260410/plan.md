# L5 PredictiveDecisionEngine - Jovo Szimulalasa Monte Carlo — Plan

## Phase 1 — Stabilize the implementation baseline
- [x] Replace delegated placeholder logic with repo-native predictive engine and executor flows.
- [x] Restore unrelated regressions introduced in CLI, route registration, scheduler wiring, and dashboard navigation.
- [x] Align hook catalog and advanced hook handlers with the predictive event contract.

## Phase 2 — Add focused regression coverage
- [x] Add engine tests for deterministic scenario generation, persisted execution, and rollback behavior.
- [x] Add executor tests for reversible goal and alert actions.
- [x] Add REST and CLI tests for history, stats, trigger, show, and rollback flows.
- [x] Add scheduler tests that prove predictive scheduling does not break self/world scheduled paths.
- [x] Add dashboard API and panel tests against the current response envelope.

## Phase 3 — Validate and close
- [x] Run predictive-focused tests and fix any compile/runtime regressions.
- [x] Run `npm run build` and `npm run build:ui`.
- [x] Decide archive vs follow-up based on validated scope, then update `.ai/copilot.md`, regenerate `.ai/FOSZAL.md`, and sync conductor state.
