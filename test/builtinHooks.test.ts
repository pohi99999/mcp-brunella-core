import Database from 'better-sqlite3';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const builtinHarness = vi.hoisted(() => ({
  db: null as unknown as Database.Database,
  captureToolRunCandidates: vi.fn(() => []),
  getAgent: vi.fn(),
  delegate: vi.fn(async () => ({ success: true })),
  publish: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('../src/utils/globalDb.js', () => ({
  getGlobalDb: () => builtinHarness.db,
}));

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    getAgent: builtinHarness.getAgent,
    delegate: builtinHarness.delegate,
  },
}));

vi.mock('../src/core/phoenixEventBus.js', () => ({
  phoenixEventBus: {
    publish: builtinHarness.publish,
  },
}));

vi.mock('../src/core/goldenDatasetBridge.js', () => ({
  captureToolRunCandidates: builtinHarness.captureToolRunCandidates,
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: builtinHarness.logInfo,
  logWarn: builtinHarness.logWarn,
  logError: builtinHarness.logError,
}));

import {
  clearHookAuditTrail,
  clearHookDlq,
  clearHooks,
  fireHook,
  getHookRegistrySnapshot,
} from '../src/core/hookRegistry.js';
import { initializeBuiltinHooks, resetBuiltinHooksForTests } from '../src/core/hooks/builtinHooks.js';

builtinHarness.db = new Database(':memory:');

describe('builtin hooks bootstrap', () => {
  beforeEach(() => {
    clearHooks();
    clearHookAuditTrail();
    clearHookDlq();
    resetBuiltinHooksForTests();
    vi.clearAllMocks();
    builtinHarness.getAgent.mockImplementation((name: string) => (
      ['InvoiceAutomation', 'SalesHunter', 'DigitalHeadhunter', 'ProjectMaintainer', 'Orchestrator'].includes(name)
        ? { name }
        : null
    ));
    initializeBuiltinHooks();
  });

  afterAll(() => {
    builtinHarness.db.close();
  });

  it('registers the builtin hook catalog', () => {
    const snapshot = getHookRegistrySnapshot();
    expect(snapshot.some((entry) => entry.event === 'tool:after')).toBe(true);
    expect(snapshot.some((entry) => entry.event === 'crm:lead:created')).toBe(true);
    expect(snapshot.some((entry) => entry.event === 'track:status:changed')).toBe(true);
  });

  it('captures curated candidates on successful tool completions', async () => {
    builtinHarness.captureToolRunCandidates.mockReturnValue([{ id: 'sample-1' }]);

    await fireHook('tool:after', { toolName: 'workspace.read', success: true }, { source: 'test' });

    expect(builtinHarness.captureToolRunCandidates).toHaveBeenCalledWith(1);
  });

  it('routes invoice emails into the invoice automation pipeline', async () => {
    await fireHook('email:classified', {
      classification: 'invoice',
      subject: 'Invoice #123',
      from: 'billing@example.com',
      triage: {},
    }, { source: 'test' });

    expect(builtinHarness.delegate).toHaveBeenCalledWith(
      'InvoiceAutomation',
      expect.any(String),
      expect.objectContaining({ hookEvent: 'invoice:received' }),
    );
  });

  it('delegates new CRM leads to SalesHunter', async () => {
    await fireHook('crm:lead:created', {
      eventType: 'created',
      lead: { id: 'lead-1', company: 'Hot Kft' },
    }, { source: 'test' });

    expect(builtinHarness.delegate).toHaveBeenCalledWith(
      'SalesHunter',
      expect.any(String),
      expect.objectContaining({ hookEvent: 'crm:lead:created' }),
    );
  });

  it('publishes phoenix degraded events on LLM provider failures', async () => {
    await fireHook('llm:provider:failed', {
      provider: 'github',
      error: 'provider down',
    }, { source: 'test' });

    expect(builtinHarness.publish).toHaveBeenCalledWith(
      'phoenix:degraded',
      expect.objectContaining({
        services: ['llm'],
      }),
    );
  });
});
