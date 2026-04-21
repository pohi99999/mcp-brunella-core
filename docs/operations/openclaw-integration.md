# OpenClaw Integration

## Purpose

This document defines the intended Brunella-to-OpenClaw integration workflow and the safety rules that must be respected before any runtime code is added.

## Current status

- Canonical Copilot prompt added: `.github/prompts/openclaw-integration.prompt.md`
- Orchestrator workflow updated: `.github/agents/brunella-orchestrator.agent.md`
- Runtime integration scaffold added under `src/integrations/openclaw/`.
- OpenClaw API route added at `src/server/routes/openclaw.ts` and registered in the route index.
- OpenClaw dashboard panel added at `src/dashboard/components/dashboard/OpenClawIntegrationPanel.tsx`.
- CLI helper handlers added at `src/cli/openclawCommands.ts` for the future command entrypoint.

## Architecture overview

- **Brunella** remains the control plane.
- **OpenClaw** is treated as a sandboxed execution plane.
- Brunella owns orchestration, policy, canonical memory, verification, and human approval.
- OpenClaw owns execution, local tooling, sandboxed operations, and short-term operational context.

## Trust zones

| Zone | Meaning | Default handling |
| --- | --- | --- |
| Green | Read-only, bounded, low-risk work | May auto-run if policy allows |
| Amber | Limited write or external action | Requires approval or human review |
| Red | Destructive, credential-touching, deployment, billing, or production-impacting work | Always requires explicit approval |

## Implementation phases

1. Audit the repo and identify safe insertion points.
2. Add typed contracts and config under an OpenClaw integration module.
3. Implement deny-by-default policy translation.
4. Add a single gateway adapter with correlation IDs, timeouts, retries, and normalized errors.
5. Implement dispatcher, evidence mapping, and run logging.
6. Add verifier and abstract approval handling.
7. Wire the integration into the correct CLI / dashboard / registry surfaces if needed.
8. Add focused tests for policy, adapter, evidence, approval, and one mocked end-to-end flow.
9. Validate build and tests before release.

## Safety rules

- No raw OpenClaw calls scattered across agents.
- No hidden credentials.
- No destructive defaults.
- No silent failure swallowing.
- No canonical memory updates without verification.
- No broad refactors unless the architecture requires them.
- Keep CLI, dashboard, docs, and tests aligned.

## How to use the prompt

Use `.github/prompts/openclaw-integration.prompt.md` as the canonical Copilot CLI workflow for the integration effort. It delegates the task to the appropriate Brunella agents and keeps the work in reviewable phases.

## Next step

Implement the runtime integration scaffold under `src/integrations/openclaw/` after the repo audit confirms the final insertion point.
