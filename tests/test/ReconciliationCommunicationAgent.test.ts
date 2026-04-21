import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AgentContext } from '../src/agents/BaseAgent.js';

vi.mock('../src/agents/BaseAgent.js', () => ({
  BaseAgent: class {},
}));

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
}));

import { logInfo } from '../src/utils/logger.js';
import { ReconciliationCommunicationAgent } from '../src/agents/ReconciliationCommunicationAgent.js';

describe('ReconciliationCommunicationAgent', () => {
  const agent = new ReconciliationCommunicationAgent();
  const logInfoMock = vi.mocked(logInfo);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('drafts the email using the provided reconciliation payload', async () => {
    const context: AgentContext = {
      task: 'draft partner email',
      payload: {
        partner: 'Acme Kft.',
        reference: 'REF-123',
        amount: 1250,
        email: 'billing@acme.hu',
      },
    };

    const result = await agent.executeTask(context);

    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationCommunicationAgent', 'Drafting communication: draft partner email');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Email draft generated.');
    expect(result.data).toMatchObject({
      to: 'billing@acme.hu',
      subject: 'Pénzügyi egyeztetés - REF-123',
    });

    const data = result.data as { body: string };
    expect(data.body).toContain('Tisztelt Acme Kft.!');
    expect(data.body).toContain('REF-123');
    expect(data.body).toContain('1250 HUF');
  });

  it('falls back to defaults when optional payload fields are missing', async () => {
    const context: AgentContext = {
      task: 'draft partner email',
      payload: {},
    };

    const result = await agent.executeTask(context);

    expect(logInfoMock).toHaveBeenCalledWith('ReconciliationCommunicationAgent', 'Drafting communication: draft partner email');
    expect(result.success).toBe(true);
    expect(result.message).toBe('Email draft generated.');
    expect(result.data).toMatchObject({
      to: 'N/A',
      subject: 'Pénzügyi egyeztetés - Unknown',
    });

    const data = result.data as { body: string };
    expect(data.body).toContain('Valued Partner');
    expect(data.body).toContain('Unknown');
    expect(data.body).toContain('0 HUF');
  });
});
