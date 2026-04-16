---
name: mission-control-ops
description: "Use when the user asks about Mission Control, system health, process control, service control, logs, or the top-level dashboard shell."
---

# Mission Control Operations

Use this skill for the Brunella cockpit / health / runtime control surfaces.

## Trigger conditions

- Mission Control
- system health
- process control
- service control
- logs, traces, or dashboard shell questions

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`dashboard`, `system-arch`, `process-control`, `service-control`, `settings`, `log-viewer`, `trace-viewer`)
- `src/components/dashboard/SystemArchitectureWidget.tsx`
- `src/components/dashboard/LogViewer.tsx`
- `src/components/dashboard/TraceViewer.tsx`

## Do

- Check the current state before suggesting a change.
- Prefer read-only diagnostics first, then a minimal action.
- Keep operational changes observable and reversible.
- Use the dashboard shell to explain what subsystem is being touched.

## Don't

- Restart or mutate services without explicit intent.
- Mix health checks with feature work.
- Hide failures behind generic success messages.

## Validation

- The dashboard section loads the expected health and control panels.
- Any action has a visible side effect, log, or trace.
- The response clearly separates diagnosis from remediation.
