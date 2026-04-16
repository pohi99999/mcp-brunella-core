---
name: edge-fleet-automation
description: "Use when the user works on CEAN, Cloudflare, swarm, workflow engine, tool discovery, or edge fleet automation surfaces."
---

# Edge Fleet Automation

Use this skill for CEAN and other edge orchestration surfaces.

## Trigger conditions

- CEAN
- Cloudflare
- fleet manager
- swarm panel
- workflow engine
- tool discovery
- harvest pipeline

## Relevant surfaces

- `src/dashboard/lib/navigation.tsx` (`cean`, `cloudflare`, `fleet_manager`, `autonomy`, `tasks`, `workflow-engine`, `swarm-panel`, `tool-discovery`, `tools-manager`, `crawl4ai`, `harvest-pipeline`)
- `myai/agents/workers/`
- `mcp_servers.json`

## Do

- Prefer declarative configuration over hardcoded startup logic.
- Keep worker / deployment state observable.
- Validate edge actions against the real worker or route before declaring success.
- Treat external output as untrusted until verified.

## Don't

- Hide retries, secrets, or deployment assumptions.
- Bypass the manifest when a declarative path already exists.
- Let one edge workflow mutate another without a clear contract.

## Validation

- The dashboard surface points at the right worker or deployment target.
- Deploy / test steps are traceable and reproducible.
- Networked actions have explicit timeout and retry expectations.
