/**
 * Test: OrchestratorAgent Chain Pipeline
 * Track: bas_orchestration_chain_20260221
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChainStep, AgentResponse } from '@packages/agents/types.js';

// ── Mock agentManager ────────────────────────────────────────────────────────
const mockDelegate = vi.fn();

vi.mock('@packages/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: mockDelegate,
    queueTask: vi.fn().mockResolvedValue(1),
    listAgentDefinitions: vi.fn().mockReturnValue([]),
    initialize: vi.fn(),
  },
}));

vi.mock('@packages/core-logic/llm_client.js', () => ({
  chatWithOllama: vi.fn().mockResolvedValue('[]'),
}));

vi.mock('@packages/core-logic/phoenixEventBus.js', () => ({
  phoenixEventBus: { subscribe: vi.fn(), emit: vi.fn() },
}));

vi.mock('@packages/utils/logger.js', () => ({
  Logger: class {
    info = vi.fn();
    error = vi.fn();
    warn = vi.fn();
  },
  logInfo: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
  setAgentStatus: vi.fn(),
}));

// ── Import after mocks ───────────────────────────────────────────────────────
const { OrchestratorAgent } = await import('@packages/agents/OrchestratorAgent.js');

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('OrchestratorAgent.executeChain()', () => {
  let orchestrator: InstanceType<typeof OrchestratorAgent>;

  beforeEach(() => {
    orchestrator = new OrchestratorAgent();
    vi.clearAllMocks();
  });

  it('3 lépéses chain: minden step megkapja a kontextust és szekvenciálisan fut', async () => {
    const step1Result: AgentResponse = { status: 'success', data: { found: 'TypeScript docs' } };
    const step2Result: AgentResponse = { status: 'success', data: { code: 'function greet() {}' } };
    const step3Result: AgentResponse = { status: 'success', data: { verdict: 'PASS' } };

    mockDelegate
      .mockResolvedValueOnce(step1Result)
      .mockResolvedValueOnce(step2Result)
      .mockResolvedValueOnce(step3Result);

    const steps: ChainStep[] = [
      { agentName: 'researcher', task: 'Keresd meg a TypeScript dokumentációt' },
      { agentName: 'developer', task: 'Írj egy üdvözlő függvényt' },
      { agentName: 'evaluator', task: 'Ellenőrizd a kódot' },
    ];

    const result = await orchestrator.executeChain(steps);

    expect(result.status).toBe('success');
    expect(mockDelegate).toHaveBeenCalledTimes(3);

    // Step 2 megkapta step 1 outputját a kontextusban
    const step2Context = mockDelegate.mock.calls[1][2];
    expect(step2Context.chainContext.accumulated).toHaveLength(1);
    expect(step2Context.chainContext.accumulated[0]).toEqual(step1Result);
    expect(step2Context.chainContext.currentStep).toBe(1);

    // Végeredmény
    expect((result.data as { finalOutput: AgentResponse }).finalOutput).toEqual(step3Result);
    expect((result.data as { stepsCount: number }).stepsCount).toBe(3);
  });

  it('ha step 2 hibázik, a chain leáll és step 3 nem fut', async () => {
    const step1Result: AgentResponse = { status: 'success', data: 'ok' };
    const step2Result: AgentResponse = { status: 'error', error: 'Agent crashed' };

    mockDelegate
      .mockResolvedValueOnce(step1Result)
      .mockResolvedValueOnce(step2Result);

    const steps: ChainStep[] = [
      { agentName: 'researcher', task: 'Kutatás' },
      { agentName: 'developer', task: 'Kódolás' },
      { agentName: 'evaluator', task: 'Ellenőrzés' },
    ];

    const result = await orchestrator.executeChain(steps);

    expect(result.status).toBe('error');
    expect(result.error).toContain('2. lépésnél');
    expect(result.error).toContain('developer');
    // Step 3 NEM hívódott meg
    expect(mockDelegate).toHaveBeenCalledTimes(2);
    // Accumulated tartalmazza az 1. lépés eredményét
    expect((result.data as { failedStep: number }).failedStep).toBe(1);
  });

  it('kivétel dobás esetén is leáll a chain', async () => {
    mockDelegate.mockResolvedValueOnce({ status: 'success', data: 'ok' });
    mockDelegate.mockRejectedValueOnce(new Error('Network timeout'));

    const steps: ChainStep[] = [
      { agentName: 'researcher', task: 'Kutatás' },
      { agentName: 'developer', task: 'Kódolás' },
    ];

    const result = await orchestrator.executeChain(steps);

    expect(result.status).toBe('error');
    expect(result.error).toContain('Network timeout');
    expect(mockDelegate).toHaveBeenCalledTimes(2);
  });

  it('1 lépéses chain is működik', async () => {
    mockDelegate.mockResolvedValueOnce({ status: 'success', data: 'single result' });

    const steps: ChainStep[] = [
      { agentName: 'researcher', task: 'Egyetlen feladat' },
    ];

    const result = await orchestrator.executeChain(steps);

    expect(result.status).toBe('success');
    expect(mockDelegate).toHaveBeenCalledTimes(1);
  });
});
