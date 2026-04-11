# L5 Predictive Decision Engine - Implementation Plan

## Status
Track created: 2026-04-11
Status: Active
Progress: 93% (13/14 tasks completed)

## Implementation Tasks

### Phase 1: Core Types & Engine
- [x] **TASK-1**: Create `src/core/decisionTypes.ts` with core interfaces ✅
  - DecisionScenario: { id, action, riskScore, impactScore, alignmentScore, totalScore, timestamp }
  - DecisionResult: { id, triggeredBy, scenarios, selectedScenario, executedAction, rollbackCapability, outcome, timestamp }
  - DecisionAction: { type: 'create_goal' | 'acknowledge_alert' | 'escalate_to_review', payload, reversible, executionLog }
  - MonteCarloConfig: { scenarioCount, riskWeight, impactWeight, alignmentWeight, seed }

- [x] **TASK-2**: Implement `src/core/decisionExecutor.ts` with safe action execution ✅
  - `executeAction(action: DecisionAction): Promise<ActionResult>` - Execute with logging
  - `rollbackAction(actionId: string): Promise<RollbackResult>` - Undo safely
  - Support actions: goal creation (via goalEngine), alert acknowledgment (via predictiveIntelligence), escalation (log-only)
  - Phoenix Protocol error handling with try-catch-finally
  - Logger integration for all execution traces

- [x] **TASK-3**: Implement `src/core/predictiveDecisionEngine.ts` - main engine ✅
  - `analyzeDecisionPoint(): Promise<DecisionResult>` - Run full analysis
  - `generateScenarios(config: MonteCarloConfig): DecisionScenario[]` - Monte Carlo simulation
  - `scoreScenario(scenario: DecisionScenario): number` - Weighted scoring
  - `selectOptimalScenario(scenarios: DecisionScenario[]): DecisionScenario` - Threshold-based selection
  - Integration with predictiveIntelligence.getActiveAlerts()
  - Integration with worldPerceptionLayer.getSignals()
  - Integration with intelligenceMonitor.getContext()
  - Integration with goalEngine.getAllGoals()
  - SQLite persistence for `decision_runs` table (id, triggered_by, scenario_distribution, selected_action, executed_at, rolled_back_at, outcome)

### Phase 2: REST API Integration
- [x] **TASK-4**: Create `src/server/routes/predictiveDecision.ts` ✅
  - `GET /api/v1/predictive-decision/history` - Recent decision records
  - `POST /api/v1/predictive-decision/trigger` - Manual trigger
  - `GET /api/v1/predictive-decision/:id` - Single decision details
  - `POST /api/v1/predictive-decision/:id/rollback` - Rollback action
  - `GET /api/v1/predictive-decision/stats` - Decision statistics
  - Express router with proper error handling
  - Input validation with Zod schemas

- [x] **TASK-5**: Wire route into `src/server/routes/index.ts` ✅
  - Add lazy import: `router.use("/api/v1/predictive-decision", lazy(() => import("./predictiveDecision.js"), "router"))`

### Phase 3: CLI Integration
- [x] **TASK-6**: Create `src/cli/predictiveDecisionCommands.ts` ✅
  - `decision history [--limit N]` - Show recent decisions
  - `decision trigger [--config-file PATH]` - Manual trigger
  - `decision show <id>` - Show decision details with scenario distribution
  - `decision rollback <id>` - Rollback action
  - `decision stats` - Statistics summary
  - Use Commander.js patterns from existing CLI commands
  - Colorful table output with chalk

- [x] **TASK-7**: Wire CLI into `src/cli/cli.ts` ✅
  - Import and register decision command group
  - Add alias `predictive-decision` for discoverability

### Phase 4: Dashboard Integration
- [x] **TASK-8**: Create `src/dashboard/lib/predictiveDecisionApi.ts` ✅
  - `getDecisionHistory(): Promise<DecisionResult[]>` - Fetch history
  - `triggerDecision(config?: Partial<MonteCarloConfig>): Promise<DecisionResult>` - Trigger
  - `getDecisionDetails(id: string): Promise<DecisionResult>` - Single decision
  - `rollbackDecision(id: string): Promise<RollbackResult>` - Rollback
  - `getDecisionStats(): Promise<Stats>` - Statistics
  - Use apiService.ts patterns for consistent error handling

- [x] **TASK-9**: Create `src/dashboard/components/dashboard/PredictiveDecisionPanel.tsx` ✅
  - Display recent decision history table (timestamp, action type, outcome, rollback status)
  - Scenario distribution visualization (bar chart or histogram)
  - Manual trigger button with config modal
  - Rollback button for reversible actions
  - Real-time updates via polling or WebSocket
  - Use shadcn/ui components for consistency
  - Responsive design with Tailwind

- [x] **TASK-10**: Wire panel into `src/dashboard/lib/navigation.tsx` ✅
  - Add navigation item: `{ name: 'Predictive Decisions', path: '/predictive-decisions', icon: ... }`
  - Update `SidebarItems.ts` if needed

### Phase 5: Scheduled Task & Hooks
- [x] **TASK-11**: Add scheduled task to `src/server/schedulers/scheduledTasksRunner.ts` ✅
  - Add `scheduleDecisionCycle()` function
  - Run every 15 minutes (configurable via environment variable)
  - Call `predictiveDecisionEngine.analyzeDecisionPoint()`
  - Log results and errors

- [x] **TASK-12**: Add hook catalog entries to `src/core/hooks/builtinHookCatalog.ts` ✅
  - `decision:triggered` - Decision analysis triggered
  - `decision:scenarios_generated` - After scenario generation
  - `decision:action_selected` - After scenario selection
  - `decision:action_executed` - After action execution
  - `decision:rolled_back` - After rollback
  - `decision:no_action` - When no action meets threshold
  - Include metadata: { decisionId, scenarioCount, actionType, outcome }

- [x] **TASK-13**: Add advanced hook handlers to `src/core/advancedHooks.ts` ✅
  - Handler for `decision:triggered` - Log analysis start
  - Handler for `decision:scenarios_generated` - Log scenario stats
  - Handler for `decision:action_selected` - Log selected action
  - Handler for `decision:action_executed` - Log execution result
  - Handler for `decision:rolled_back` - Log rollback event
  - Handler for `decision:no_action` - Log no-action decision
  - Emit hooks from appropriate points in predictiveDecisionEngine.ts

### Phase 6: Testing
- [ ] **TASK-14**: Write comprehensive tests
  - `test/predictiveDecisionEngine.test.ts` - Core engine logic (scenario generation, scoring, selection, determinism)
  - `test/predictiveDecisionRoutes.test.ts` - REST API routes (all endpoints, error cases)
  - `test/predictiveDecisionCommands.test.ts` - CLI commands (all commands, output formatting)
  - `test/scheduledTasksRunner_predictiveDecision.test.ts` - Scheduler integration
  - `test/dashboard/lib/predictiveDecisionApi.test.ts` - Dashboard API
  - `test/dashboard/components/PredictiveDecisionPanel.test.tsx` - Dashboard component
  - Target >80% coverage on new code
  - Use Vitest patterns from existing tests
  - Test determinism with seeded Monte Carlo

## Success Criteria
All 14 tasks completed, all tests passing, no linter errors, no debug artifacts, strict types, Phoenix Protocol compliance.

## Rollout Notes
- Start with conservative scenario count (100) to validate performance
- Enable scheduled task only after manual testing confirms stability
- Monitor decision execution rates to prevent runaway automation
- Add kill switch environment variable for emergency shutdown

## Current Blockers
None - all dependencies exist in repo.
