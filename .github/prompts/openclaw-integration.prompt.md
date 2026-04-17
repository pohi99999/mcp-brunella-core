---
description: "Orchestrate an OpenClaw-to-Brunella integration using Brunella's architecture, policy gates, registry wiring, docs, and tests."
name: "OpenClaw Integration"
argument-hint: "Goal; constraints; modules affected; rollout expectations"
agent: "brunella-orchestrator"
---

# OpenClaw Integration Brief

## Goal

Integrate OpenClaw as a sandboxed execution layer for Brunella while keeping Brunella as the control plane.

## Operating principles

- Brunella owns orchestration, policy, canonical memory, verification, and human approval.
- OpenClaw owns execution, local tooling, sandboxed operations, and operational workspace memory.
- Use deny-by-default policy.
- Do not allow raw OpenClaw calls to spread across domain agents.
- Treat destructive, credential-touching, deployment, and external-message actions as red by default.

## Required delegation order

1. `brunella-architect` — define the boundary, file map, and safety contract.
2. `brunella-delivery-lead` — split the work into small, reviewable phases.
3. `brunella-implementer` — build the scaffold, policy, adapter, dispatcher, and wiring.
4. `robust-test-writer` — add focused tests for policy, adapter, evidence, and dispatch flows.
5. `brunella-reviewer` — review the change for regressions, coupling, and security.
6. `brunella-delivery-lead` — finalize docs, session notes, and release steps.

## Implementation phases

### Phase 1 — Audit
- Inspect the repository structure.
- Identify existing agent, registry, CLI, dashboard, logger, config, approval, and test patterns.
- Choose the safest integration layer.
- Do not edit files yet.

### Phase 2 — Scaffold
- Create or adapt `src/integrations/openclaw/` if the repo structure supports it.
- Add typed contracts for goal, execution, evidence, and decision packets.
- Add config and error types.
- Keep the surface small and typed.

### Phase 3 — Policy
- Implement deny-by-default policy translation.
- Add trust zones: green, amber, red.
- Support per-agent allowlists.
- Escalate amber and red work to approval or human review.
- Block dangerous tool combinations unless explicitly approved.

### Phase 4 — Adapter
- Add a single OpenClaw gateway adapter.
- Normalize errors.
- Attach correlation IDs.
- Enforce timeouts and bounded retries.
- Keep auth and config centralized.

### Phase 5 — Dispatcher and evidence
- Implement the task dispatcher.
- Route execution through policy and approval gates.
- Capture evidence, logs, diffs, and test results.
- Map outputs back into Brunella-native structures.

### Phase 6 — Verification and approval
- Reuse any existing critic or verifier flow.
- If none exists, add a minimal verifier service.
- Keep approval transport abstract.
- Do not assume a specific UI.

### Phase 7 — Registry, CLI, dashboard
- Add a dedicated bridge or executor entry point if needed.
- Wire only the minimal command or navigation surface.
- Do not make every domain agent call OpenClaw directly.
- Preserve backward compatibility.

### Phase 8 — Docs and tests
- Document the architecture, trust zones, lifecycle, config, and safety rules.
- Add focused tests for policy translation, redaction, approval escalation, error normalization, evidence mapping, and one mocked end-to-end dispatch flow.
- Keep the test surface deterministic.

### Phase 9 — Final validation
- Run the relevant build and test commands.
- Fix obvious issues.
- Summarize remaining risks and next steps.

## Output format

When this prompt is used, return:

1. Repo assessment
2. Chosen layer and why
3. File map
4. Ordered implementation plan
5. Validation plan
6. Risks and side effects
7. Handoff notes for the next agent

## Safety rules

- No hidden credentials.
- No broad refactors unless absolutely necessary.
- No destructive defaults.
- No silent failure swallowing.
- No raw OpenClaw prompt calls scattered around the codebase.
- Keep CLI, dashboard, docs, and tests aligned.
