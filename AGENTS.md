<!-- Purpose: Unified agent registry and coordination rules for all AI agents working on Brunella. -->

# Brunella Agent Registry

**Last Updated:** 2026-04-17
**Version:** 2.x

## ⚡ FIRST READ THIS

Every AI agent working on this repo MUST:

1. Read `BRUNELLA_MASTER_CONTEXT.md` first (system overview)
2. Read `HANDOFF.md` second (current state, active tasks)
3. Read `AGENT_MEMORY.md` third (accumulated knowledge)
4. Update `HANDOFF.md` BEFORE ending any session

## Active Agents

| Agent ID | Role | Entry Config | Memory Location |
| --- | --- | --- | --- |
| brunella-core | MCP Server Core | `src/index.ts` | `_KNOWLEDGE_BASE/` |
| brunella-orchestrator | Top-level multi-agent coordinator | `.github/agents/brunella-orchestrator.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/brunella-orchestrator/` |
| brunella-architect | Architecture and boundary decisions | `.github/agents/brunella-architect.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/brunella-architect/` |
| brunella-implementer | Feature implementation | `.github/agents/brunella-implementer.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/brunella-implementer/` |
| brunella-reviewer | Safety, regression, maintainability review | `.github/agents/brunella-reviewer.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/brunella-reviewer/` |
| brunella-delivery-lead | Planning, release sequencing, closure | `.github/agents/brunella-delivery-lead.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/brunella-delivery-lead/` |
| bas-lead-developer | End-to-end BAS feature delivery | `.github/agents/bas-lead-developer.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/bas-lead-developer/` |
| robust-test-writer | Focused unit/integration test authoring | `.github/agents/robust-test-writer.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/robust-test-writer/` |
| bas-self-reflect | Post-track reflection and backlog synthesis | `.github/agents/bas-self-reflect.agent.md` | `_KNOWLEDGE_BASE/agent-outputs/bas-self-reflect/` |

> `.agents/` currently contains the shared skill library (`.agents/skills/`) rather than standalone agent definitions. The authoritative active custom-agent set is under `.github/agents/`, while runtime agents are registered in `src/agents/registry.json`.

## Agent Communication Protocol

- Agents communicate via MCP tools defined in `mcp_servers.json`
- Shared memory is in `_KNOWLEDGE_BASE/` (NOT in individual `.claude/`, `.copilot-memory/` etc.)
- Each agent MUST write results to `_KNOWLEDGE_BASE/agent-outputs/[agent-id]/`

## Tool Registry

See `mcp_servers.json` for the authoritative list of available MCP tools.

## DO NOT CREATE NEW AGENT MEMORY IN

- `.claude/` (Claude-specific, not shared)
- `.copilot-memory/` (Copilot-specific, not shared)
- `.augment/` (Augment-specific, not shared)
- `.bob/`, `.cortex/`, `.pi/` etc.

## ALWAYS WRITE SHARED MEMORY TO

- `_KNOWLEDGE_BASE/` — vector store and documents
- `HANDOFF.md` — session state
- `AGENT_MEMORY.md` — accumulated facts and decisions
