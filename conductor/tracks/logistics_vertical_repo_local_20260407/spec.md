# Spec: Logistics vertical — repository-local boundary

## Goal
Separate the logistics work that can be done inside this Brunella repository from the external PohiAIProt2 frontend integration that is not available here.

## In scope for this repo
- Expose a dedicated logistics status surface in Brunella.
- Keep the current `LogisticsDispatcherAgent` boundary clear: shipment tracking / complaints only.
- Surface repo-local logistics capabilities for dashboard or API consumers.
- Add tests for the repo-local logistics surface.
- Document the split so the original vertical track can be archived safely.

## Out of scope
- Modifying the external PohiAIProt2 repository.
- Replacing localStorage in the external frontend.
- Copying external React components across repos.
- Timber B2B matchmaking parity with the external frontend.
- Any cross-repo deployment assumptions.

## Known blocker
The external frontend path mentioned in the original track is outside this workspace, so Brunella cannot complete the frontend wiring or confirm end-to-end integration from here.

## Repo-local implementation boundary
- A read-only logistics status/capability route is safe.
- A dashboard placeholder or panel is safe if it only points to Brunella-owned surfaces.
- A new timber-match agent would need a separate follow-up track if the domain is expanded beyond shipment tracking.

## Acceptance criteria
- The original track is marked as externally blocked/archived.
- The repo-local split is documented in a new track.
- Brunella exposes at least one safe logistics status endpoint.
- The safe endpoint is covered by tests.
