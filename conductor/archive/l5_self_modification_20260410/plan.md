# L5 SelfModificationEngine - Sandbox Onfejlesztes — Plan

## Phase 1 — Core rebuild
- [x] Restore the canonical self-modification core modules under `src/core/`.
- [x] Rebuild sandbox evaluation and worker orchestration.
- [x] Reinstate proposal lifecycle, approval, and apply flow.

## Phase 2 — Runtime surfaces
- [x] Add REST routes for overview, proposal review, and weekly cycle operations.
- [x] Add CLI commands for status, listing, manual run, approve, and reject flows.
- [x] Add dashboard API + panel integration for review and manual proposal triggers.

## Phase 3 — Wiring and safety
- [x] Persist DynamicAgent execution metrics from the live agent manager path.
- [x] Add weekly scheduler provisioning and `cron:weekly:self-improve` hook emission.
- [x] Keep protected agents out of the self-modification candidate pool.

## Phase 4 — Verification and closure
- [x] Build backend and dashboard after wiring the feature surfaces.
- [x] Add focused route, scheduler, CLI, engine, dashboard API, and panel tests.
- [x] Confirm that no separate follow-up conductor track is required and archive the track.
