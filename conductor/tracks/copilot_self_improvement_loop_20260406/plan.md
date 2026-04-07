# Copilot CLI Self-Improvement Loop — Implementation Plan

## Objective

Wire the Copilot CLI built-in agents as a **proactive external intelligence reinforcer** for Brunella's existing internal learning loop. The missing link is a `CopilotFeedbackChannel` bridge that translates Copilot code-review findings into `SelfModelSignal` events, completing the Data Flywheel cycle.

## Architecture

```
Copilot CLI Code-review agent
         ↓
copilotFeedbackChannel.ts  ← NEW (bridge / translation layer)
         ↓
selfModel.ts::ingestCopilotFeedback()  ← NEW method
         ↓
reflectionEngine.ts::reflect()  ← EXISTING
         ↓
patternReuse.ts + learningLoopService.ts  ← EXISTING
         ↓
goldenDatasetBridge.ts  ← EXISTING
         ↓
Copilot Plan agent (better next-task planning)  ← CLOSES THE LOOP
```

## Implementation Checklist

### Phase 1 — Structural files ✅
- [x] Conductor track created (`copilot_self_improvement_loop_20260406`)
- [ ] `.github/agents/bas-self-reflect.agent.md`
- [ ] `.github/agents/bas-golden-dataset-enricher.agent.md`
- [ ] `.github/agents/bas-pattern-scout.agent.md`
- [ ] `mcp_servers.json` — `brunella-self-improve` entry
- [ ] `.github/copilot-instructions.md` — Önellenőrzési protokoll section

### Phase 2 — TypeScript implementation
- [ ] `src/core/copilotFeedbackChannel.ts` — new singleton bridge
- [ ] `src/core/selfModel.ts` — add `ingestCopilotFeedback()` method
- [ ] `src/core/autonomousInfraRuntime.ts` — export `copilotFeedbackChannel` singleton

### Phase 3 — Automation
- [ ] `.github/workflows/self-improve.yml` — daily self-improve GitHub Actions

### Phase 4 — Tests
- [ ] `test/copilotFeedbackChannel.test.ts` — unit tests

## Acceptance Criteria

1. `npm run build` passes with zero errors
2. `npm run test:fast` passes with new tests (≥6 test cases)
3. `bas-self-reflect.agent.md` follows existing agent format (description frontmatter, trigger phrases, examples)
4. `copilotFeedbackChannel.ts` has zero `any` types
5. `self-improve.yml` uses `github-script` pattern consistent with `jules-test-coordinator.yml`
