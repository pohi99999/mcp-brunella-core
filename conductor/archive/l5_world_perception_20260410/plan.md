# L5 WorldPerceptionLayer - Folyamatos Kulso Vilag Figyeles — Plan

## Phase 1 — Discovery and framing
- [x] Map the existing external-knowledge, intelligence, and hook-engine surfaces this layer should compose.
- [x] Define the minimal perception loop input/output contract.
- [x] Decide which external sources are in-scope for the first delivery slice.

## Phase 2 — Core implementation
- [x] Implement the perception coordinator and signal normalizer.
- [x] Add hook or scheduler entry points for recurring perception runs.
- [x] Persist or hand off normalized signals to the existing intelligence layer.

## Phase 3 — Operator surfaces
- [x] Add a route or CLI surface for perception status and recent runs.
- [x] Add a dashboard panel for world-perception visibility.
- [x] Document how operators can review or replay perception output through the track spec and operator-facing surfaces.

## Phase 4 — Verification
- [x] Add focused backend and UI tests for the first perception slice.
- [x] Validate dependency alignment with hook-engine and intelligence services.
- [x] Reassess whether a follow-up track is needed before closure.
