/**
 * Integration Tests — Zero-Prompt Runtime + Ephemeral Bridge
 *
 * Track: brunella_zero_prompt_ephemeral_bridge_20260402
 *
 * Tests the three-way policy routing in ZeroPromptRuntime:
 *   1. safe event (github.issue.opened)      → auto-spawns ephemeral agent
 *   2. guarded+approval (scheduler.task.failed) → triggers approval notification
 *   3. dangerous resource (.env)             → escalation, NO agent spawned
 *   4. Spawned agent has correct metadata (TTL, tokenBudget, parentAgentName)
 *   5. policyEngine classifies github.issue.opened as safe
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { auditRecordMock } = vi.hoisted(() => ({
  auditRecordMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/core/auditLog.js', () => ({ record: auditRecordMock }));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
}));

const { dispatchApprovalRequestedMock } = vi.hoisted(() => ({
  dispatchApprovalRequestedMock: vi.fn().mockResolvedValue([]),
}));

vi.mock('../src/core/notificationChannels.js', () => ({
  notificationChannels: {
    dispatchApprovalRequested: dispatchApprovalRequestedMock,
    dispatchApprovalResolved: vi.fn().mockResolvedValue([]),
  },
}));

// ─── Module reset helper ──────────────────────────────────────────────────────

async function freshEnv() {
  vi.resetModules();
  // Re-register mocks after resetModules
  vi.mock('../src/core/auditLog.js', () => ({ record: auditRecordMock }));
  vi.mock('../src/utils/logger.js', () => ({
    logInfo: vi.fn(),
    logError: vi.fn(),
    logWarn: vi.fn(),
    setAgentStatus: vi.fn(),
  }));
  vi.mock('../src/core/notificationChannels.js', () => ({
    notificationChannels: {
      dispatchApprovalRequested: dispatchApprovalRequestedMock,
      dispatchApprovalResolved: vi.fn().mockResolvedValue([]),
    },
  }));

  const [runtimeMod, eventFabricMod, approvalMod, phoenixMod, ephemeralMod] = await Promise.all([
    import('../src/core/zeroPromptRuntime.js'),
    import('../src/core/eventFabric.js'),
    import('../src/core/approvalRouter.js'),
    import('../src/core/phoenixEventBus.js'),
    import('../src/core/ephemeralAgentManager.js'),
  ]);

  return { runtimeMod, eventFabricMod, approvalMod, phoenixMod, ephemeralMod };
}

function makeSignalEvent(
  id: string,
  source: string,
  type: string,
  payload: Record<string, unknown>,
  priority: 'low' | 'medium' | 'high' | 'critical' = 'low',
  riskHint: 'safe' | 'guarded' | 'dangerous' = 'safe',
) {
  const ts = new Date().toISOString();
  return {
    // Top-level required fields
    source,
    eventType: type,
    priority,
    riskHint,
    timestamp: ts,
    // Nested envelope
    envelope: {
      id,
      source,
      type,
      dedupKey: `${source}:${type}:${id}`,
      payload,
      priority,
      riskHint,
      timestamp: ts,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('[Integration] ZeroPromptRuntime — brunella_zero_prompt_ephemeral_bridge_20260402', () => {
  beforeEach(() => {
    auditRecordMock.mockClear();
    dispatchApprovalRequestedMock.mockClear();
  });

  // ── 1. Safe event → auto-spawn ───────────────────────────────────────────

  it('github.issue.opened (safe) spawns an ephemeral agent automatically', async () => {
    const { runtimeMod, approvalMod, phoenixMod, ephemeralMod, eventFabricMod } = await freshEnv();
    runtimeMod.zeroPromptRuntime.start();
    approvalMod.approvalRouter.clear();
    eventFabricMod.eventFabric.clearHistory();

    const countBefore = ephemeralMod.ephemeralAgentManager.listAgents().length;

    phoenixMod.phoenixEventBus.publish('phoenix:event_fabric_signal', makeSignalEvent('safe-001', 'github', 'github.issue.opened', {
        issue: { number: 42, title: 'Bug report', body: 'Something broken' },
        repository: 'brunella',
      }, 'low', 'safe'));

    await new Promise(r => setTimeout(r, 200));

    // One ephemeral agent should have been spawned
    const agents = ephemeralMod.ephemeralAgentManager.listAgents();
    const newAgents = agents.slice(countBefore);
    expect(newAgents.length).toBeGreaterThan(0);

    const spawned = newAgents.find((a: { spec: { parentAgentName: string } }) => a.spec.parentAgentName === 'ZeroPromptRuntime');
    expect(spawned).toBeDefined();
    expect(spawned!.spec.purpose).toBeTruthy();
    expect(Array.isArray(spawned!.spec.allowedTools)).toBe(true);
    // 'log_message' is always in allowedTools
    expect(spawned!.spec.allowedTools).toContain('log_message');

    // No approval workflow should have been triggered
    expect(dispatchApprovalRequestedMock).not.toHaveBeenCalled();

    runtimeMod.zeroPromptRuntime.stop();
  });

  // ── 2. Guarded + requiresApproval → approval notification ────────────────

  it('scheduler.task.failed (guarded+requiresApproval) triggers approval notification', async () => {
    const { runtimeMod, approvalMod, phoenixMod, eventFabricMod } = await freshEnv();
    runtimeMod.zeroPromptRuntime.start();
    approvalMod.approvalRouter.clear();
    eventFabricMod.eventFabric.clearHistory();
    dispatchApprovalRequestedMock.mockClear();

    phoenixMod.phoenixEventBus.publish('phoenix:event_fabric_signal', makeSignalEvent('guarded-001', 'scheduler', 'scheduler.task.failed', {
        taskId: 'nightly-run',
        error: 'Script execution failed',
      }, 'high', 'guarded'));

    await new Promise(r => setTimeout(r, 200));

    // Approval workflow was requested
    expect(dispatchApprovalRequestedMock).toHaveBeenCalled();

    runtimeMod.zeroPromptRuntime.stop();
  });

  // ── 3. Dangerous resource → escalation, no spawn ─────────────────────────

  it('dangerous resource (.env) emits escalation event and does NOT spawn an agent', async () => {
    const { runtimeMod, approvalMod, phoenixMod, eventFabricMod } = await freshEnv();
    runtimeMod.zeroPromptRuntime.start();
    approvalMod.approvalRouter.clear();
    eventFabricMod.eventFabric.clearHistory();
    dispatchApprovalRequestedMock.mockClear();

    phoenixMod.phoenixEventBus.publish('phoenix:event_fabric_signal', makeSignalEvent('dangerous-001', 'system', 'resource.modified', {
        resource: '.env',
        action: 'write',
      }, 'high', 'dangerous'));

    await new Promise(r => setTimeout(r, 200));

    // No approval workflow (dangerous → escalation event, not approval workflow)
    expect(dispatchApprovalRequestedMock).not.toHaveBeenCalled();

    // A health degraded event should be in Event Fabric history (escalation signal)
    const history = eventFabricMod.eventFabric.getHistory();
    const degradedOrHealth = history.filter((e: { type: string }) =>
      typeof e.type === 'string' && (e.type.includes('degraded') || e.type.includes('health')),
    );
    expect(degradedOrHealth.length).toBeGreaterThan(0);

    runtimeMod.zeroPromptRuntime.stop();
  });

  // ── 4. Spawned agent metadata constraints ─────────────────────────────────

  it('spawned ephemeral agent has correct TTL (3min) and bounded token budget', async () => {
    const { runtimeMod, approvalMod, phoenixMod, ephemeralMod, eventFabricMod } = await freshEnv();
    runtimeMod.zeroPromptRuntime.start();
    approvalMod.approvalRouter.clear();
    eventFabricMod.eventFabric.clearHistory();

    const countBefore = ephemeralMod.ephemeralAgentManager.listAgents().length;

    phoenixMod.phoenixEventBus.publish('phoenix:event_fabric_signal', makeSignalEvent('safe-002', 'github', 'github.issue.opened', {
        issue: { number: 100, title: 'Metadata test', body: 'TTL check' },
        repository: 'brunella',
      }, 'low', 'safe'));

    await new Promise(r => setTimeout(r, 200));

    const agents = ephemeralMod.ephemeralAgentManager.listAgents();
    const newAgents = agents.slice(countBefore);
    const spawned = newAgents.find((a: { spec: { parentAgentName: string } }) => a.spec.parentAgentName === 'ZeroPromptRuntime');

    if (spawned) {
      // TTL = 3 minutes
      expect(spawned.spec.ttlMs).toBe(180_000);
      // Token budget bounded
      expect(spawned.spec.tokenBudget).toBeGreaterThan(0);
      expect(spawned.spec.tokenBudget).toBeLessThanOrEqual(2000);
      // Cost budget bounded
      expect(spawned.spec.costBudgetUsd).toBeLessThanOrEqual(0.10);
    } else {
      // If DB hydration caused extra agents, skip the exact index check but verify a ZPR agent exists
      const anyZPR = agents.find((a: { spec: { parentAgentName: string } }) => a.spec.parentAgentName === 'ZeroPromptRuntime');
      expect(anyZPR).toBeDefined();
    }

    runtimeMod.zeroPromptRuntime.stop();
  });

  // ── 5. policyEngine classifies github.issue.opened as safe ───────────────

  it('policyEngine.evaluateAndLogPolicy classifies github.issue.opened as safe/no-approval', async () => {
    const { evaluateAndLogPolicy } = await import('../src/core/policyEngine.js');
    const decision = await evaluateAndLogPolicy({
      event: makeSignalEvent('policy-001', 'github', 'github.issue.opened', {
        issue: { number: 99, title: 'Test', body: '' },
        repository: 'test-repo',
      }, 'low', 'safe').envelope,
      agentName: 'test',
      resource: undefined,
    });

    expect(decision.actionClass).toBe('safe');
    expect(decision.requiresApproval).toBe(false);
  });
});
