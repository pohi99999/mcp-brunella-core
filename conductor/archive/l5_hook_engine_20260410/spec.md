# L5 Hook Engine - Esemenyvezérelt Reflex Rendszer — Spec

## Objective
Maintain a canonical hook engine layer that can capture runtime events, route them through a registry-driven execution model, and expose observability plus control surfaces across the Brunella stack.

## Problem Statement
The hook engine implementation exists in source, but the conductor track truth drifted out of the repository. Before downstream L5 work such as world perception can proceed safely, the hook-engine track needs a restored conductor record with the already verified devops evidence and the remaining implementation/closure scope.

## Scope
- Canonical hook registry and hook engine core.
- Builtin hook catalog and runtime bootstrap.
- Route and CLI surfaces for hook inspection/control.
- Runtime emit points for tool, scheduler, webhook, and workflow events.
- Audit/DLQ/circuit-breaker observability.
- Focused regression coverage for hook registry, route, and CLI surfaces.

## Non-Goals
- Replacing every existing event system in a single pass.
- Building world-perception logic directly inside the hook engine track.
- Reworking unrelated scheduler or security CLI suites.

## Implementation Targets
- `src/core/hookRegistry.ts`
- `src/core/hookEngine.ts`
- `src/core/hookDlq.ts`
- `src/core/hookCircuitBreaker.ts`
- `src/core/hookAuditTrail.ts`
- `src/core/hooks/builtinHookCatalog.ts`
- `src/core/hooks/builtinHooks.ts`
- `src/core/advancedHooks.ts`
- `src/server/routes/hooks.ts`
- `src/cli/hooksCommands.ts`
- `test/hookRegistry.test.ts`
- `test/hooksRoutes.test.ts`
- `test/hooksCommands.test.ts`

## Acceptance Criteria
- Hook registry remains the canonical source for runtime hook execution.
- Hook route and CLI surfaces expose the live registry state.
- Builtin hooks are idempotently bootstrapped into the runtime.
- Hook runtime failures are isolated through DLQ/circuit-breaker style protections.
- Focused hook regression tests and build stay green.
- The track can safely unblock downstream hook-dependent L5 work.

## Current State
Devops verification is already complete and restored as conductor phase evidence. The next active slice is the coder/implementation phase that decides whether any remaining source deltas still exist before the track can move toward QA and closure.
