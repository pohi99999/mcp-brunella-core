# DailyAgentBriefingAgent

**Agent Name:** `DailyAgentBriefing`
**Source:** `src/agents/DailyAgentBriefingAgent.ts`
**Role:** Napi AI Agent Összefoglaló Kutató

## Description

Napi, ismétlődő kutató-felderítő ügynök, amely GitHub Search API és webcrawling segítségével összegyűjti az AI agent ökoszisztéma napi híreit, és strukturált magyar összefoglalót generál a Brunella architektúra rétegeihez.

## Capabilities

- Daily AI-agent market scan with GitHub Search API and web crawl inputs
- Brunella layer mapping for Cortex / Memoria / Nexus / Fabrica / Interface / Conductor
- Deterministic adoption tagging for research signals: `adopt`, `prototype`, `watch`

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
- [ ] Add a worked example for `skill-optimizer`, `zt-agentshield`, and `Chaeos-env`
