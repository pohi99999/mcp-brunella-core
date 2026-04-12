import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailAgent } from '../src/agents/EmailAgent.js';

vi.mock('../src/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('EmailAgent', () => {
  let agent: EmailAgent;

  beforeEach(() => {
    agent = new EmailAgent();
  });

  it('returns a normalized invoice record for downstream workflow handoff', async () => {
    const result = await agent.execute('process invoice email');

    expect(result.status).toBe('success');
    expect(result.data).toEqual(expect.objectContaining({
      count: 1,
      invoice: expect.objectContaining({
        partner: 'TestKft',
        date: '2026-04-01',
        amount: '12500',
      }),
    }));

    const data = result.data as Record<string, unknown>;
    expect(data.invoice).toEqual(expect.objectContaining({
      partner: 'TestKft',
      amount: '12500',
    }));
    expect(Array.isArray(data.invoices)).toBe(true);
    expect((data.invoices as Array<Record<string, unknown>>)[0]).toEqual(data.invoice);
  });
});
