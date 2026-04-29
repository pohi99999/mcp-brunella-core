import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as validateOutputModule from '@packages/agents/middleware/validateOutput.js';
import * as criticQuickReviewModule from '@packages/core-logic/criticQuickReview.js';
import * as redactorModule from '@packages/core-logic/redactor.js';

const { recordValidation, recordRedaction } = vi.hoisted(() => ({
  recordValidation: vi.fn(),
  recordRedaction: vi.fn(),
}));

vi.mock('@apps/mcp-core/server/guardrailsRoutes.js', () => ({
  recordValidation,
  recordRedaction,
}));

import { guardAgentResponseOutput, guardAgentResultOutput } from '@packages/core-logic/outputGuard.js';

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

  it('fails open when result validation and validation telemetry throw', () => {
    vi.spyOn(validateOutputModule, 'validateAgentResult').mockImplementationOnce(() => {
      throw new Error('validator offline');
    });
    recordValidation.mockImplementationOnce(() => {
      throw new Error('validation telemetry offline');
    });

    const result = guardAgentResultOutput(
      { success: true, message: 'Maradjon sikeres.' },
      'TestAgent',
    );

    expect(result.success).toBe(true);
    expect(result.metadata?.guardrails).toMatchObject({
      validationPassed: true,
      criticApproved: true,
    });
    expect(recordValidation).toHaveBeenCalledTimes(1);
  });

  it('fails open when result critic and redactor throw', () => {
    vi.spyOn(criticQuickReviewModule, 'quickReviewOutput').mockImplementationOnce(() => {
      throw new Error('critic unavailable');
    });
    vi.spyOn(redactorModule, 'redactObject').mockImplementationOnce(() => {
      throw new Error('redactor unavailable');
    });

    const result = guardAgentResultOutput(
      { success: true, message: 'Fallback eredmény.' },
      'TestAgent',
    );

    expect(result.success).toBe(true);
    expect(result.metadata?.guardrails).toMatchObject({
      criticApproved: true,
      criticReason: expect.stringContaining('critic_failed_open'),
      redactionsTriggered: 0,
    });
  });

  it('fails open when response guardrails and redaction telemetry throw', () => {
    vi.spyOn(validateOutputModule, 'validateAgentResponse').mockImplementationOnce(() => {
      throw new Error('response validator offline');
    });
    vi.spyOn(criticQuickReviewModule, 'quickReviewOutput').mockImplementationOnce(() => {
      throw new Error('response critic offline');
    });
    recordRedaction.mockImplementationOnce(() => {
      throw new Error('redaction telemetry offline');
    });

    const response = guardAgentResponseOutput(
      {
        status: 'success',
        message: 'Titok: ghp_abcdefghijklmnopqrstuvwxyz1234567890AB',
      },
      'TestAgent',
    );

    expect(response.status).toBe('success');
    expect(response.message).toContain('[GITHUB_TOKEN_REDACTED]');
    expect(response.metadata?.guardrails).toMatchObject({
      validationPassed: true,
      criticApproved: true,
      criticReason: expect.stringContaining('critic_failed_open'),
    });
    expect(recordRedaction).toHaveBeenCalledTimes(1);
  });
});
