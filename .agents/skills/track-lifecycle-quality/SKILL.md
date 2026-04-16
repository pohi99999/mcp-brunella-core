---
name: track-lifecycle-quality
description: "Use when the user works on tracks, conductor planning, lifecycle state, or closure quality checks."
---

# Track Lifecycle and Quality

Use this skill for Brunella's conductor tracks and closure discipline.

## Trigger conditions

- track generator
- Conductor Tracks Monitor
- track plan / spec / meta
- closure evidence
- DoD / completion checks

## Relevant surfaces

- `conductor/tracks.md`
- `conductor/tracks/<id>/meta.json`
- `conductor/tracks/<id>/plan.md`
- `conductor/tracks/<id>/spec.md`
- `scripts/sync_foszal.py`

## Do

- Keep the lifecycle evidence-backed.
- Update plan, spec, and meta in the same story when possible.
- Record build / test / commit evidence before closure.
- Use the conductor docs as the source of truth.

## Don't

- Mark a track complete from metadata alone.
- Skip the DoD block or the validation trail.
- Mix closure work with unrelated feature edits.

## Validation

- The track state matches the code reality.
- Closure notes reference real build / test evidence.
- The sync / reflection artifacts are current.
