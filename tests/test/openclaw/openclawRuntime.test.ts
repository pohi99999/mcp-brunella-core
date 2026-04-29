import { describe, expect, it } from 'vitest';
import { Logger } from '@packages/utils/logger.js';
import { createOpenClawRuntime, OpenClawConfigSchema } from '@packages/core-logic/openclaw/index.js';

describe('OpenClaw runtime bundle', () => {
  it('returns a safe snapshot without exposing secret config fields', () => {
    const config = OpenClawConfigSchema.parse({
      baseUrl: 'https://openclaw.example.com',
      apiKey: 'secret-token',
      timeoutMs: 5_000,
      retryCount: 0,
      retryDelayMs: 0,
      defaultTrustZone: 'amber',
      approvalThreshold: 'amber',
      enabled: true,
      allowedAgents: ['research-agent'],
      allowedToolPresets: ['read-only'],
      agentAllowlists: {},
      redaction: {
        enabled: true,
        mask: '[REDACTED]',
        sensitiveKeys: ['token'],
      },
    });

    const runtime = createOpenClawRuntime({
      config,
      gatewayOptions: {
        fetchImpl: (async () => new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })) as unknown as typeof fetch,
      },
    });
    const snapshot = runtime.snapshot();

    expect(snapshot.config.baseUrl).toBe('https://openclaw.example.com');
    expect((snapshot.config as { apiKey?: string }).apiKey).toBeUndefined();
    expect(snapshot.status.state).toBe('ready');
  });

  it('prefers the explicit runtime logger over nested logger options', () => {
    const config = OpenClawConfigSchema.parse({
      baseUrl: 'https://openclaw.example.com',
      timeoutMs: 5_000,
      retryCount: 0,
      retryDelayMs: 0,
      defaultTrustZone: 'amber',
      approvalThreshold: 'amber',
      enabled: true,
      allowedAgents: ['research-agent'],
      allowedToolPresets: ['read-only'],
      agentAllowlists: {},
      redaction: {
        enabled: true,
        mask: '[REDACTED]',
        sensitiveKeys: ['token'],
      },
    });

    const runtime = createOpenClawRuntime({
      config,
      logger: new Logger('ExplicitRuntimeLogger'),
      gatewayOptions: {
        logger: new Logger('GatewayLoggerShouldNotWin'),
        fetchImpl: (async () => new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })) as unknown as typeof fetch,
      },
      dispatcherOptions: {
        logger: new Logger('DispatcherLoggerShouldNotWin'),
      },
    });

    expect(runtime.snapshot().status.state).toBe('ready');
  });

  it('falls back to the dispatcher logger when no runtime logger is provided', () => {
    const config = OpenClawConfigSchema.parse({
      baseUrl: 'https://openclaw.example.com',
      timeoutMs: 5_000,
      retryCount: 0,
      retryDelayMs: 0,
      defaultTrustZone: 'amber',
      approvalThreshold: 'amber',
      enabled: true,
      allowedAgents: ['research-agent'],
      allowedToolPresets: ['read-only'],
      agentAllowlists: {},
      redaction: {
        enabled: true,
        mask: '[REDACTED]',
        sensitiveKeys: ['token'],
      },
    });

    const runtime = createOpenClawRuntime({
      config,
      gatewayOptions: {
        fetchImpl: (async () => new Response('{}', {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        })) as unknown as typeof fetch,
      },
      dispatcherOptions: {
        logger: new Logger('DispatcherLoggerWins'),
      },
    });

    expect(runtime.snapshot().status.state).toBe('ready');
  });
});
