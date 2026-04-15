# Plan — Brunella Studio Agent v2

## Goal
Deliver a reviewer-loop follow-up for Brunella Studio runs with CLI and dashboard controls, webhook-aware notifications, and testable production hardening.

## Phase 1 — Track activation and gap mapping
- [x] Activate the track metadata and move the track into the active workstream.
- [x] Map the existing Studio surfaces (`StudioSupervisorAgent`, `src/cli/studioCommands.ts`, `BrunellaStudio`) to the v2 gaps.
- [x] Identify the first implementation slice: reviewer-loop backend plus CLI/dashboard surface wiring.

## Phase 2 — Reviewer-loop backend
- [x] Add `StudioReviewerAgent` under `src/agents/` with a deterministic review result model.
- [x] Register the new agent in `src/agents/registry.json` and wire its runtime module.
- [x] Extend `src/cli/studioCommands.ts` and `src/cli/studioRuntime.ts` with a `studio review` command that reads a pipeline report and emits reviewer output.
- [x] Add webhook/callback-friendly review output fields so downstream automation can consume the result without parsing free text.
- [x] Add optional callback URL delivery for Studio review results and return structured callback delivery metadata.
- [x] Add focused tests for the callback delivery path, CLI option, and dashboard command preview.

## Phase 3 — Dashboard surface
- [x] Extend `src/dashboard/components/dashboard/BrunellaStudio.tsx` with reviewer-loop controls and a visible review status lane.
- [x] Keep the existing `src/dashboard/lib/navigation.tsx` registration aligned; reuse the Brunella Studio panel instead of introducing a duplicate surface.
- [x] Add rerun/status affordances that mirror the new CLI review command.
- [x] Surface callback URL entry in the dashboard review command preview.
- [x] Validate the callback slice with targeted Vitest coverage.

## Phase 4 — Validation
- [x] Add focused Vitest coverage for the reviewer agent, CLI command, and dashboard rendering changes.
- [x] Run `npm run build` after the implementation slice lands.
- [x] Run `npm run test:fast` after the implementation slice lands.

## Phase 5 — Closeout
- [x] Update `.ai/copilot.md` and regenerate `.ai/FOSZAL.md` after the milestone.
- [x] Sync conductor metadata and review whether the track is ready for the next slice or remains active. (Track remains active for music intelligence / hardening follow-up.)

## Phase 6 — Music intelligence slice
- [x] Add audio-plan heuristics to Studio review results so music-track fit, beat density, ducking, and LUFS issues become structured findings.
- [x] Update the Studio reviewer agent metadata, registry entry, CLI description, and dashboard copy to advertise music intelligence support.
- [x] Add focused Vitest coverage for the music-intelligence review slice.
- [x] Run build and fast-suite validation for the music slice.

## Phase 7 — Dashboard reviewer signals
- [x] Add a dedicated reviewer-signals card to the Brunella Studio dashboard so the music intelligence and webhook review posture are visible at a glance.
- [x] Add dashboard test coverage for the reviewer-signals copy and visibility.
- [x] Validate the UI slice with build and fast-suite runs.
