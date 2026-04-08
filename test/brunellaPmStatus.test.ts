import { beforeEach, describe, expect, it, vi } from 'vitest';
import { brunellaPmStatusHandler } from '../src/tools/brunellaPmStatus.js';
import { agentManager } from '../src/agents/AgentManager.js';

vi.mock('../src/agents/AgentManager.js', () => ({
  agentManager: {
    delegate: vi.fn(),
  },
}));

describe('brunellaPmStatusHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delegates to the BrunellaProjectManager agent', async () => {
    vi.mocked(agentManager.delegate).mockResolvedValue({
      success: true,
      message: '# status report',
      data: { ok: true },
    });

    const result = await brunellaPmStatusHandler({
      limit: 2,
      ragLimit: 4,
      ragQuery: 'project manager',
      question: 'Show PM status',
    });

    expect(agentManager.delegate).toHaveBeenCalledWith(
      'BrunellaProjectManager',
      'Show PM status',
      {
        payload: {
          limit: 2,
          ragLimit: 4,
          ragQuery: 'project manager',
        },
      },
    );
    expect(result).toEqual({ success: true, report: '# status report' });
  });

  it('surfaces agent failures as tool errors', async () => {
    vi.mocked(agentManager.delegate).mockResolvedValue({
      success: false,
      message: 'agent failed',
    });

    const result = await brunellaPmStatusHandler({
      question: 'Show PM status',
    });

    expect(result).toEqual({
      success: false,
      error: 'agent failed',
    });
  });
});
