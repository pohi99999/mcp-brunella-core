# SpecWriterAgent

**Agent Name:** `SpecWriter`
**Source:** `src/agents/SpecWriterAgent.ts`
**Role:** EPP v2 Track Generator

## Description

Generates EPP v2 compliant tracks from creative ideas using 3-stage LLM pipeline.

## Capabilities

- `track_generation`
- `epp_v2_compliance`
- `requirement_extraction`
- `todo_breakdown`

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
