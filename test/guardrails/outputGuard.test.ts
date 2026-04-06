import { describe, it, expect, vi, beforeEach } from 'vitest';

const { recordValidation, recordRedaction } = vi.hoisted(() => ({
  recordValidation: vi.fn(),
  recordRedaction: vi.fn(),
}));

vi.mock('../../src/server/guardrailsRoutes.js', () => ({
  recordValidation,
  recordRedaction,
}));

import { guardAgentResponseOutput, guardAgentResultOutput } from '../../src/core/outputGuard.js';

describe('outputGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adds guardrail metadata to responses and records validation', () => {
    const response = guardAgentResponseOutput(
      { status: 'success', message: 'Minden rendben.' },
      'TestAgent',
    );

    expect(response.metadata?.guardrails).toBeDefined();
    expect(recordValidation).toHaveBeenCalledWith(true, undefined);
  });

  it('redacts secrets and records redaction events', () => {
    const result = guardAgentResultOutput(
      {
        success: true,
        message: 'A token: ghp_abcdefghijklmnopqrstuvwxyz1234567890AB',
        data: { note: 'sk-12345678901234567890123456789012' },
      },
      'TestAgent',
    );

    expect(result.message).toContain('[GITHUB_TOKEN_REDACTED]');
    expect(JSON.stringify(result.data)).toContain('[OPENAI_KEY_REDACTED]');
    expect(recordRedaction).toHaveBeenCalledTimes(1);
  });

  it('does not throw on circular or bigint payloads', () => {
    const payload: { self?: unknown; count: bigint } = { count: 42n };
    payload.self = payload;

    expect(() => guardAgentResultOutput(
      {
        success: true,
        message: 'Komplex payload.',
        data: payload,
      },
      'TestAgent',
    )).not.toThrow();
  });
});