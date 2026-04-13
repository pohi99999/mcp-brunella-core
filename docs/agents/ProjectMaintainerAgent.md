# ProjectMaintainerAgent

**Agent Name:** `ProjectMaintainer`
**Source:** `src/agents/ProjectMaintainerAgent.ts`
**Role:** Repository Maintenance & Hygiene Operator

## Description

Napi 22:00-kor futó karbantartó, aki a repo zajt tisztítja és ellenőrzi a projekt egészségét.

## Capabilities

- `root_cleanup`
- `log_rotation`
- `track_verification`
- `build_health_check`

## Inputs / Outputs

- **Primary input:** Task string + optional context object.
- **Primary output:** Agent result/response object.

## Operational Notes

- Generated automatically by `ProjectConductorAgent` during `conductor sync`.
- Replace placeholders and expand with concrete examples over time.

## TODO

- [ ] Add real-world usage examples
- [ ] Add failure modes and recovery notes
- [ ] Add integration touchpoints
