# Readiness Gates — Phase 9 (Emergent Superintelligence)

## Positioning
Phase 9 **kutatási+architektúra** fókuszú kritikus track. Nem kezdhető biztonságosan, amíg a Phase 8 planetáris alapréteg nincs stabilizálva.

## Entry criteria (to switch from proposed to active)

1. Phase 8 progress >= 30%
2. Phase 8 moduloknál legalább:
   - Planet Mesh route model
   - Emergent Layer state baseline
   - Orchestrator contract
3. Build + tests green a Phase 8 slice-ok után
4. Safety policy dokumentálva a goal evolution modulra

## Non-negotiable safety constraints
- No autonomous goal mutation without explicit policy gate
- No opaque consciousness-state persistence without audit trail
- Must expose explainable state snapshots per module

## First implementation slice once active

### Slice 1 — Cognitive API contracts only
- define interfaces for:
  - `SuperintelligenceSignal`
  - `MetaCognitionSnapshot`
  - `GoalMutationDecision`
- no autonomous execution yet (dry-run mode)

### Slice 2 — Goal evolution simulator
- deterministic simulation mode
- rule-based mutation scoring
- explicit reject reasons

### Slice 3 — Conscious kernel integration harness
- gather module snapshots
- produce explainable composite state
- no production action dispatch

## Exit criteria for 8% -> 20%
- contracts + dry-run simulator available
- full type-safe compile
- unit test baseline in place
