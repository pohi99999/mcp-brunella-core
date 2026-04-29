import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@packages/utils/logger.js', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
  setAgentStatus: vi.fn(),
}));

import {
  classifyToolError,
  formatToolObservation,
  ToolErrorType,
} from '@packages/core-logic/toolErrorClassifier.js';
import { withClassifiedRetry } from '@packages/core-logic/retryStrategy.js';

describe('toolErrorClassifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('classifies rate limit errors as retryable', () => {
    const descriptor = classifyToolError({ status: 429, message: 'Too many requests' });
    expect(descriptor.type).toBe(ToolErrorType.RATE_LIMITED);
    expect(descriptor.retryable).toBe(true);
    expect(descriptor.retryDelayMs).toBeGreaterThan(0);
  });

  it('classifies authorization errors as non-retryable', () => {
    const descriptor = classifyToolError(new Error('401 unauthorized token expired'));
    expect(descriptor.type).toBe(ToolErrorType.AUTH_FAILED);
    expect(descriptor.retryable).toBe(false);
    expect(descriptor.operatorActionRequired).toBe(true);
  });

  it('formats observations for scratchpad logging', () => {
    const descriptor = classifyToolError(new Error('network timeout while connecting'));
    const observation = formatToolObservation(descriptor);
    expect(descriptor.type).toBe(ToolErrorType.RETRYABLE);
    expect(observation).toContain('retryable=true');
    expect(observation).toContain('revision=');
  });

  it('stops classified retry immediately for bad input errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('bad request: invalid input payload'));

    await expect(
      withClassifiedRetry(fn, 'tool-call', { maxRetries: 5, baseDelay: 1, maxDelay: 5 }),
    ).rejects.toThrow('bad request: invalid input payload');

    expect(fn).toHaveBeenCalledTimes(1);
  });
});