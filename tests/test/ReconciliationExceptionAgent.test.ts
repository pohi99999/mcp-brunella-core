import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentContext } from '@packages/agents/BaseAgent.js';

vi.mock('@packages/agents/BaseAgent.js', () => ({
  BaseAgent: class {},
}));

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
}));

import { logInfo } from '@packages/utils/logger.js';
import { ReconciliationExceptionAgent } from '@packages/agents/ReconciliationExceptionAgent.js';

describe('ReconciliationExceptionAgent', () => {
  const agent = new ReconciliationExceptionAgent();
  const logInfoMock = vi.mocked(logInfo);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a failure when the entry is missing', async () => {
    const context: AgentContext = {
      task: 'analyze unmatched entry',
      payload: {},
    };

    const result = await agent.executeTask(context);

    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationExceptionAgent', 'Analyzing reconciliation exception: analyze unmatched entry');
    expect(result.success).toBe(false);
    expect(result.message).toBe('No entry provided for analysis.');
  });

  it('returns a failure when the entry is invalid', async () => {
    const context: AgentContext = {
      task: 'analyze unmatched entry',
      payload: {
        entry: null,
      },
    };

    const result = await agent.executeTask(context);

    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationExceptionAgent', 'Analyzing reconciliation exception: analyze unmatched entry');
    expect(result.success).toBe(false);
    expect(result.message).toBe('No entry provided for analysis.');
  });

  it('returns the expected analysis when the entry is present', async () => {
    const context: AgentContext = {
      task: 'analyze unmatched entry',
      payload: {
        entry: {
          id: 'entry-1',
        },
      },
    };

    const result = await agent.executeTask(context);

    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationExceptionAgent', 'Analyzing reconciliation exception: analyze unmatched entry');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Exception analyzed successfully.');
    expect(result.data).toMatchObject({
      entry_id: 'entry-1',
      reason_identified: 'Unclear reference',
      suggested_action: 'SEND_COMMUNICATION',
      confidence: 0.75,
    });
  });
});
