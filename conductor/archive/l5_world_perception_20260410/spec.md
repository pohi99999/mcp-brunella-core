# L5 WorldPerceptionLayer - Folyamatos Kulso Vilag Figyeles — Spec

## Objective
Build a world-perception layer that continuously watches external sources, converts observations into structured signals, and feeds Brunella decision-making with governed, reviewable situational awareness.

## Problem Statement
Brunella already has pieces of external knowledge ingest, intelligence monitoring, and a hook runtime, but there is no dedicated L5 world-perception layer that unifies continuous sensing, signal normalization, and downstream decision handoff. The conductor track was also missing, so the first step is to re-establish it as canonical work.

## Scope
- Define the perception loop for external events, signals, and source freshness.
- Normalize inbound observations into structured intelligence or knowledge signals.
- Integrate with the hook engine and existing intelligence/external-knowledge surfaces.
- Expose minimal operator visibility through REST/CLI/dashboard surfaces.
- Add focused tests for perception ingestion and signal shaping.

## Non-Goals
- Full autonomous actioning of every observed signal.
- Replacing the existing external knowledge approval workflow.
- Implementing predictive simulation inside this track.

## Candidate Implementation Targets
- `src/core/worldPerceptionLayer.ts`
- `src/core/worldSignalNormalizer.ts`
- `src/server/routes/worldPerception.ts`
- `src/cli/worldPerceptionCommands.ts`
- `src/dashboard/lib/worldPerceptionApi.ts`
- `src/dashboard/components/dashboard/WorldPerceptionPanel.tsx`
- `test/worldPerceptionLayer.test.ts`
- `test/worldPerceptionRoutes.test.ts`
- `test/worldPerceptionCommands.test.ts`
- `test/dashboard/components/WorldPerceptionPanel.test.tsx`

## Acceptance Criteria
- A continuous perception loop can ingest and normalize external observations.
- Perception output is structured enough for downstream intelligence or decision layers.
- Hook-triggered or scheduled perception runs are observable and testable.
- Operator-facing status is available through at least one backend and one UI/CLI surface.
- Focused tests cover normalization, routing, and operator controls.

## Dependency Note
`l5_hook_engine_20260410` is treated as the prerequisite event substrate. That prerequisite is now archived/complete, so this track can begin with discovery and source implementation.
