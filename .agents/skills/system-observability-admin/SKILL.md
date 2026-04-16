---
name: system-observability-admin
description: "Use when the user works on telemetry, logs, traces, model routing, admin, scheduled tasks, or the System dashboard surfaces."
---

# System Observability and Administration

Use this skill for Brunella's admin, tracing, and runtime-control surfaces.

## Trigger conditions

- telemetry
- LLM observability
- security panel
- trace viewer
- log viewer
- audit log
- hook monitor
- model router
- scheduled tasks
- remote console

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`telemetry`, `llm-observability`, `security-panel`, `chrome-acp`, `settings`, `n8n`, `langflow`, `remote-console`, `admin-check`, `trace-viewer`, `log-viewer`, `audit-log`, `hook-monitor`, `model-router`, `scheduled-tasks`, `vector-stats`)

## Do

- Inspect logs and traces before recommending changes.
- Keep admin actions reversible where possible.
- Document retries, timeouts, and failure modes for background jobs.
- Use the model router and scheduled-task surfaces as observable control planes.

## Don't

- Hide failures behind generic success states.
- Change admin settings without stating the blast radius.
- Treat observability output as trusted until it is correlated.

## Validation

- Log, trace, and audit views show the same story.
- Scheduled tasks and router settings match the requested state.
- Any admin action has a visible, reviewable consequence.
