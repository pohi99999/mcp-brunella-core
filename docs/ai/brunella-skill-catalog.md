# Brunella Skill Catalog

This catalog maps the major Brunella dashboard surfaces to the repo-level Copilot skill library.

Canonical source of truth:

- `.agents/skills/<skill-name>/SKILL.md`

Compatibility mirror:

- `.claude/skills/<skill-name>/SKILL.md` only when another runtime explicitly needs the duplicate.

Use this catalog when you want a dashboard action to resolve to a narrow, reusable Copilot skill instead of a broad agent or a one-off prompt.

## Skill map

| Skill | Dashboard surface | Typical triggers | Intent |
| --- | --- | --- | --- |
| `paios` | `PAIOS Orchestrator` / `paios` | `/paios`, PAIOS chat, orchestrator steering | Conversation-driven control of the Brunella brain from VS Code Insiders or Copilot CLI |
| `brunella-studio` | `Brunella Studio` / `studio` / `campaign-studio` | `/Brunella_Studio`, studio workflow, video pipeline | Video / post-production workflow across probe, ingest, rough-cut, render, and QC |
| `mission-control-ops` | `Mission Control`, `dashboard`, `neural-map`, `system-arch`, `process-control`, `service-control` | system health, runtime status, service control | Core system operations, state checks, and safe operational actions |
| `ai-agent-governance` | `AI & Agents` group | registry, kernel pipeline, agent factory, self-improvement | Agent lifecycle, registry hygiene, prompt assets, and agent governance |
| `knowledge-memory-intelligence` | `knowledge`, `memory`, `cognitive-memory`, `user-preferences`, `vector-stats` | search memory, recall, semantic context | Knowledge retrieval, memory hygiene, preference handling, and vector insight |
| `track-lifecycle-quality` | `tracks`, `Conductor Tracks Monitor` | track planning, lifecycle, closure evidence | Track creation, DoD checks, closure discipline, and conductor reporting |
| `edge-fleet-automation` | `cean`, `cloudflare`, `fleet_manager`, `autonomy`, `tasks`, `workflow-engine`, `swarm-panel`, `tool-discovery`, `tools-manager`, `crawl4ai`, `harvest-pipeline` | edge agents, Cloudflare, orchestration, deployment | Edge fleet automation, workflow execution, and declarative deployment flows |
| `enterprise-services` | `enterprise-suite`, `digital-hr`, `hr-timesheet`, `hr-onboarding`, `grant-hunter`, `law-detective`, `property-visionary`, `property-sales`, `psales-intake`, `psales-research`, `psales-strategy`, `enterprise-analytics`, `intelligence-monitor` | HR, legal, property, enterprise ops | Business-domain operational workflows with strict data boundaries |
| `revenue-finance-ops` | `trojan-horse`, `lead-monitor`, `lead-mining`, `marketwatcher`, `demo-factory`, `showcase`, `campaign-studio`, `leads-master`, `innovation-bridge`, `invoice-sync`, `invoice-automation`, `bookkeeping`, `finance-reconciliation`, `kp-penztar`, `inventory` | leads, invoice, reconciliation, sales ops | Revenue and finance workflows with auditable numbers and confirmation gates |
| `system-observability-admin` | `telemetry`, `llm-observability`, `security-panel`, `trace-viewer`, `log-viewer`, `audit-log`, `hook-monitor`, `model-router`, `scheduled-tasks` | logs, traces, admin, router, scheduler | Observability, admin, model routing, and scheduled task hygiene |

## How to use the catalog

1. Pick the narrowest skill that matches the dashboard surface.
2. If the request spans multiple surfaces, start with the control-plane skill (`mission-control-ops`, `ai-agent-governance`, or `system-observability-admin`) and then branch out.
3. If the task needs a new transport or process boundary, promote it to an MCP adapter instead of expanding a skill.
4. If the task changes the dashboard contract, update the corresponding docs, prompts, and navigation references together.

## Notes

- Skills should stay thin and reusable.
- Skills should not hide side effects or invent new hidden automation.
- Dashboard-facing skills should reference the existing navigation ids and runtime files instead of generic descriptions only.
