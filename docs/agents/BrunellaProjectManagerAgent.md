# BrunellaProjectManagerAgent

**Agent Name:** `BrunellaProjectManager`
**Source:** `src/agents/BrunellaProjectManagerAgent.ts`
**Role:** Project Manager Status Operator

## Description

Projekt állapot, FOSZAL összegzés és RAG alapú rövid project review.

## Capabilities

- `project_status`
- `track_snapshot`
- `foszal_summary`
- `rag_summary`

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
