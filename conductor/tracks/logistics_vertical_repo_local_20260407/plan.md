# Plan: Logistics vertical — repository-local Brunella boundary

## Objective
Create the smallest safe Brunella-local implementation surface for logistics while explicitly excluding the unavailable PohiAIProt2 frontend repo.

## Tasks
- [x] P1 Archive the original external-integration track and add a split note.
- [x] P2 Add a read-only logistics status/capability route under Brunella.
- [x] P3 Mount the route in the API router.
- [x] P4 Add tests for the new logistics route.
- [x] P5 Decide whether a future timber-match agent track is needed for full B2B matchmaking.
  <!-- Deferred: Timber-match agent deferred to separate follow-up conductor track per spec.md scope boundary. Out of scope for this track. -->

## Repo-local scope
- Read-only status and capability discovery only.
- No cross-repo writes.
- No frontend migration work.
- No timber-match semantics unless a new track is created.

## Exit criteria
- The original track is archived or clearly marked as blocked.
- The repo-local status route returns stable metadata.
- Tests pass for the new route.
- The split boundary is documented for future contributors.
