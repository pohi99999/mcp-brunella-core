# L5 Predictive Decision Engine - Monte Carlo Simulation & Actionable Decision Records — Spec

## Objective
Build a predictive decision engine that consumes existing intelligence sources (predictiveIntelligence, worldPerceptionLayer, intelligenceMonitor, goalEngine) to produce actionable decision records through deterministic Monte Carlo scenario simulation, enabling Brunella to autonomously decide and execute safe, reversible internal actions.

## Problem Statement
The repository has predictive intelligence alerts and world perception signals, but no automated decision-making layer that evaluates multiple future scenarios and executes safe actions autonomously. Manual intervention is still required for most operational decisions, limiting Brunella's autonomous capability maturity.

## Scope
- Create a predictive decision engine that:
  - Consumes alerts from `predictiveIntelligence.ts`
  - Integrates world perception signals from `worldPerceptionLayer.ts`
  - Uses intelligence context from `intelligenceMonitor.ts`
  - Leverages goal state from `autonomousInfraRuntime.ts` goalEngine
- Implement deterministic Monte Carlo scenario scoring:
  - Generate N future scenarios per decision point
  - Score each scenario based on risk, impact, alignment with goals
  - Select optimal action based on weighted scenario outcomes
  - Ensure deterministic execution for testing (seeded random if needed)
- Produce actionable decision records persisted to SQLite
- Execute safe, reversible internal actions only:
  - Create autonomous goal via goalEngine with rollback to 'abandoned' status
  - Acknowledge predictive alert with rollback capability
  - Escalate to human review with logging (no destructive side effects)
- Expose end-to-end:
  - REST API route `/api/v1/predictive-decision`
  - CLI command group `decision` (alias `predictive-decision`)
  - Dashboard API helper in dedicated file
  - Dashboard panel component
  - Scheduled task integration for periodic decision cycles
  - Hook catalog + advanced hook handlers

## Non-Goals
- External infrastructure mutations (cloud provisioning, DNS changes, etc.)
- Speculative risky actions without human approval
- Real-time streaming decisions (batch/scheduled is sufficient for L5)
- Complex multi-agent negotiation (single-engine decision authority)

## Candidate Implementation Targets

### Core Engine
- `src/core/decisionTypes.ts` - Shared types for decision records, scenarios, actions
- `src/core/decisionExecutor.ts` - Safe action executor with rollback capability
- `src/core/predictiveDecisionEngine.ts` - Main Monte Carlo decision engine

### Integration Points
- `src/server/routes/predictiveDecision.ts` - REST API routes
- `src/server/routes/index.ts` - Route registration
- `src/cli/predictiveDecisionCommands.ts` - CLI commands
- `src/cli/cli.ts` - CLI registration
- `src/dashboard/lib/predictiveDecisionApi.ts` - Dashboard API helper
- `src/dashboard/components/dashboard/PredictiveDecisionPanel.tsx` - Dashboard UI
- `src/dashboard/lib/navigation.tsx` - Navigation registration
- `src/core/scheduledTasksRunner.ts` - Scheduled task integration
- `src/core/builtinHookCatalog.ts` - Hook catalog entries
- `src/core/advancedHooks.ts` - Advanced hook handlers

### Tests
- `test/predictiveDecisionEngine.test.ts` - Core engine logic
- `test/predictiveDecisionRoutes.test.ts` - REST API routes
- `test/predictiveDecisionCommands.test.ts` - CLI commands
- `test/scheduledTasksRunner_predictiveDecision.test.ts` - Scheduler integration
- `test/dashboard/lib/predictiveDecisionApi.test.ts` - Dashboard API
- `test/dashboard/components/PredictiveDecisionPanel.test.tsx` - Dashboard component

## Acceptance Criteria
- [ ] Predictive decision engine successfully consumes alerts and signals
- [ ] Monte Carlo scenario simulation produces deterministic scores
- [ ] Decision records are persisted to SQLite global DB
- [ ] Safe actions execute with rollback capability
- [ ] REST API routes expose decision history and trigger capabilities
- [ ] CLI commands allow manual decision triggering and history review
- [ ] Dashboard panel displays decision history and scenario analysis
- [ ] Scheduled task runs periodic decision cycles
- [ ] Hook catalog entries fire on decision events
- [ ] All tests pass with >80% coverage on new code
- [ ] No `any` types, all imports use `.js` extensions
- [ ] No debug artifacts (`console.log`, etc.)
- [ ] Phoenix Protocol error handling throughout

## Safe Action Constraints
Actions must be:
1. **Reversible** - All actions must support rollback/undo
2. **Internal** - No external API calls or infrastructure mutations
3. **Auditable** - All actions logged to audit trail
4. **Non-destructive** - No data deletion or irreversible state changes
5. **Rate-limited** - Maximum N actions per decision cycle to prevent runaway automation

## Monte Carlo Implementation Notes
- Use deterministic seed for reproducibility in tests
- Generate 100-1000 scenarios per decision point (configurable)
- Score dimensions: risk (0-1), impact (0-1), goal alignment (0-1)
- Weighted average: `score = 0.3*risk + 0.4*impact + 0.3*alignment`
- Select top scenario or use threshold-based decision logic
- Store scenario distribution for post-hoc analysis

## Dependency Note
This track depends on `l5_memory_architecture_20260410` for structured memory patterns and cognitive enrichment integration. All other dependencies (predictiveIntelligence, worldPerceptionLayer, intelligenceMonitor, goalEngine) already exist in the repo.
