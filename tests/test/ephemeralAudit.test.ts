import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock('../src/core/auditLog.js', () => ({
  record: vi.fn().mockResolvedValue(undefined),
}));

// -----------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------

describe('EphemeralAudit', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { clearPostmortems } = await import('../src/core/ephemeralAudit.js');
    clearPostmortems();
  });

  it('generates a postmortem with correct fields', async () => {
    vi.resetModules();
    const { generatePostmortem, clearPostmortems } = await import('../src/core/ephemeralAudit.js');
    clearPostmortems();

    const record = {
      id: 'agt-uuid-001',
      spec: {
        parentAgentName: 'OrchestratorAgent',
        purpose: 'Schema analysis',
        allowedTools: ['read_file'],
        ttlMs: 60_000,
        tokenBudget: 500,
      },
      state: 'terminated' as const,
      spawnedAt: '2026-03-29T10:00:00.000Z',
      terminatedAt: '2026-03-29T10:00:05.000Z',
      terminationReason: 'task_done',
      tokenUsed: 250,
      costUsed: 0.005,
      stepsUsed: 3,
      auditTrail: [
        { timestamp: '2026-03-29T10:00:00.000Z', event: 'spawned', detail: 'Schema analysis' },
        { timestamp: '2026-03-29T10:00:05.000Z', event: 'terminated', detail: 'task_done' },
      ],
    };

    const pm = generatePostmortem(record);

    expect(pm.agentId).toBe('agt-uuid-001');
    expect(pm.parentAgentName).toBe('OrchestratorAgent');
    expect(pm.purpose).toBe('Schema analysis');
    expect(pm.state).toBe('terminated');
    expect(pm.durationMs).toBe(5000);
    expect(pm.tokenUsed).toBe(250);
    expect(pm.budgets.tokenBudget).toBe(500);
    expect(pm.summary).toContain('Schema analysis');
    expect(pm.summary).toContain('terminated');
    expect(pm.summary).toContain('tokens 50%');
    expect(pm.auditTrail).toHaveLength(2);
  });

  it('getPostmortems returns newest first', async () => {
    vi.resetModules();
    const { generatePostmortem, getPostmortems, clearPostmortems } = await import('../src/core/ephemeralAudit.js');
    clearPostmortems();

    const makeRecord = (id: string, spawnedAt: string, terminatedAt: string) => ({
      id,
      spec: {
        parentAgentName: 'P',
        purpose: 'Test',
        allowedTools: [],
        ttlMs: 1000,
      },
      state: 'terminated' as const,
      spawnedAt,
      terminatedAt,
      terminationReason: 'done',
      tokenUsed: 0,
      costUsed: 0,
      stepsUsed: 0,
      auditTrail: [],
    });

    generatePostmortem(makeRecord('a', '2026-03-29T10:00:00.000Z', '2026-03-29T10:00:01.000Z'));
    generatePostmortem(makeRecord('b', '2026-03-29T11:00:00.000Z', '2026-03-29T11:00:01.000Z'));
    generatePostmortem(makeRecord('c', '2026-03-29T12:00:00.000Z', '2026-03-29T12:00:01.000Z'));

    const results = getPostmortems(10);
    expect(results[0]?.agentId).toBe('c');
    expect(results[1]?.agentId).toBe('b');
    expect(results[2]?.agentId).toBe('a');
  });

  it('getPostmortem finds by agent ID', async () => {
    vi.resetModules();
    const { generatePostmortem, getPostmortem, clearPostmortems } = await import('../src/core/ephemeralAudit.js');
    clearPostmortems();

    const record = {
      id: 'target-id',
      spec: { parentAgentName: 'P', purpose: 'Find me', allowedTools: [], ttlMs: 1000 },
      state: 'expired' as const,
      spawnedAt: '2026-03-29T10:00:00.000Z',
      terminatedAt: '2026-03-29T10:00:10.000Z',
      terminationReason: 'ttl_expired',
      tokenUsed: 0,
      costUsed: 0,
      stepsUsed: 0,
      auditTrail: [],
    };

    generatePostmortem(record);

    expect(getPostmortem('target-id')?.purpose).toBe('Find me');
    expect(getPostmortem('missing-id')).toBeUndefined();
  });

  it('clearPostmortems empties the store', async () => {
    vi.resetModules();
    const { generatePostmortem, getPostmortems, clearPostmortems } = await import('../src/core/ephemeralAudit.js');
    clearPostmortems();

    generatePostmortem({
      id: 'x',
      spec: { parentAgentName: 'P', purpose: 'X', allowedTools: [], ttlMs: 1000 },
      state: 'terminated' as const,
      spawnedAt: '2026-03-29T10:00:00.000Z',
      terminatedAt: '2026-03-29T10:00:01.000Z',
      terminationReason: 'done',
      tokenUsed: 0,
      costUsed: 0,
      stepsUsed: 0,
      auditTrail: [],
    });

    expect(getPostmortems(10)).toHaveLength(1);
    clearPostmortems();
    expect(getPostmortems(10)).toHaveLength(0);
  });
});
