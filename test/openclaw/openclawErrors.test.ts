import { describe, expect, it } from 'vitest';
import {
  OpenClawConfigError,
  OpenClawDispatchError,
  OpenClawError,
  OpenClawGatewayError,
  OpenClawPolicyError,
  OpenClawTimeoutError,
  OpenClawUnconfiguredError,
  normalizeOpenClawError,
} from '../../src/integrations/openclaw/index.js';

describe('OpenClaw error normalization', () => {
  it('returns OpenClawError instances unchanged', () => {
    const original = new OpenClawGatewayError('gateway exploded', {
      code: 'OPENCLAW_GATEWAY_ERROR',
      retryable: true,
      details: {
        status: 502,
      },
    });

    const normalized = normalizeOpenClawError(original);

    expect(normalized).toBe(original);
  });

  it('maps abort-like errors to timeout errors', () => {
    const abortError = Object.assign(new Error('Request aborted'), {
      name: 'AbortError',
    });

    const normalized = normalizeOpenClawError(abortError);

    expect(normalized).toBeInstanceOf(OpenClawTimeoutError);
    expect(normalized.code).toBe('OPENCLAW_TIMEOUT');
    expect(normalized.retryable).toBe(true);
    expect(normalized.message).toContain('Request aborted');
  });

  it('maps generic errors to non-retryable gateway errors', () => {
    const normalized = normalizeOpenClawError(new Error('boom'));

    expect(normalized).toBeInstanceOf(OpenClawGatewayError);
    expect(normalized.code).toBe('OPENCLAW_GATEWAY_ERROR');
    expect(normalized.retryable).toBe(false);
    expect(normalized.message).toContain('boom');
  });

  it('preserves the dedicated config and unconfigured error classes', () => {
    const configError = new OpenClawConfigError('missing api key');
    const unconfiguredError = new OpenClawUnconfiguredError('status');

    expect(configError).toBeInstanceOf(OpenClawError);
    expect(configError.code).toBe('OPENCLAW_CONFIG_ERROR');
    expect(configError.retryable).toBe(false);
    expect(configError.message).toContain('missing api key');
    expect(unconfiguredError.code).toBe('OPENCLAW_UNCONFIGURED');
    expect(unconfiguredError.retryable).toBe(false);
  });

  it('preserves the policy and dispatch error classes', () => {
    const policyError = new OpenClawPolicyError('policy blocked');
    const dispatchError = new OpenClawDispatchError('dispatch failed', {
      details: {
        runId: 'run-1',
      },
    });

    expect(policyError).toBeInstanceOf(OpenClawError);
    expect(policyError.code).toBe('OPENCLAW_POLICY_ERROR');
    expect(policyError.retryable).toBe(false);
    expect(dispatchError).toBeInstanceOf(OpenClawError);
    expect(dispatchError.code).toBe('OPENCLAW_DISPATCH_ERROR');
    expect(dispatchError.retryable).toBe(false);
    expect(dispatchError.details).toEqual({
      runId: 'run-1',
    });
  });

  it('falls back to the generic normalized message for empty primitive errors', () => {
    const normalized = normalizeOpenClawError('');

    expect(normalized.code).toBe('OPENCLAW_GATEWAY_ERROR');
    expect(normalized.message).toBe('OpenClaw operation failed');
    expect(normalized.retryable).toBe(false);
  });
});
