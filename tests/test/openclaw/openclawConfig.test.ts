import { describe, expect, it } from 'vitest';
import { createOpenClawStatusSnapshot, loadOpenClawConfig } from '@packages/core-logic/openclaw/index.js';

describe('OpenClaw config loading', () => {
  it('parses env values and normalizes the base url', () => {
    const config = loadOpenClawConfig({
      env: {
        OPENCLAW_BASE_URL: 'https://openclaw.example.com/',
        OPENCLAW_API_KEY: 'secret-token',
        OPENCLAW_TIMEOUT_MS: '12000',
        OPENCLAW_RETRY_COUNT: '3',
        OPENCLAW_RETRY_DELAY_MS: '500',
        OPENCLAW_DEFAULT_TRUST_ZONE: 'green',
        OPENCLAW_APPROVAL_THRESHOLD: 'red',
        OPENCLAW_ENABLED: 'true',
        OPENCLAW_ALLOWED_AGENTS: 'research-agent, exec-agent',
        OPENCLAW_ALLOWED_TOOL_PRESETS: 'read-only, constrained-write',
        OPENCLAW_AGENT_ALLOWLISTS: '{"research-agent":["read_file","list_directory"]}',
        OPENCLAW_REDACTION_ENABLED: 'false',
        OPENCLAW_REDACTION_MASK: '[MASK]',
        OPENCLAW_REDACTION_SENSITIVE_KEYS: 'token,password',
      },
    });

    expect(config.baseUrl).toBe('https://openclaw.example.com');
    expect(config.apiKey).toBe('secret-token');
    expect(config.timeoutMs).toBe(12000);
    expect(config.retryCount).toBe(3);
    expect(config.retryDelayMs).toBe(500);
    expect(config.defaultTrustZone).toBe('green');
    expect(config.approvalThreshold).toBe('red');
    expect(config.enabled).toBe(true);
    expect(config.allowedAgents).toEqual(['research-agent', 'exec-agent']);
    expect(config.allowedToolPresets).toEqual(['read-only', 'constrained-write']);
    expect(config.agentAllowlists['research-agent']).toEqual(['read_file', 'list_directory']);
    expect(config.redaction.enabled).toBe(false);
    expect(config.redaction.mask).toBe('[MASK]');
    expect(config.redaction.sensitiveKeys).toEqual(['token', 'password']);
  });

  it('creates a ready status snapshot when the integration is configured', () => {
    const config = loadOpenClawConfig({
      env: {
        OPENCLAW_BASE_URL: 'https://openclaw.example.com',
      },
    });

    const snapshot = createOpenClawStatusSnapshot(config);

    expect(snapshot.state).toBe('ready');
    expect(snapshot.configured).toBe(true);
    expect(snapshot.reachable).toBe(true);
    expect(snapshot.baseUrl).toBe('https://openclaw.example.com');
    expect(snapshot.message).toContain('OpenClaw is configured');
  });

  it('falls back to the default disabled snapshot when env is empty', () => {
    const config = loadOpenClawConfig({});
    const snapshot = createOpenClawStatusSnapshot(config);

    expect(config.enabled).toBe(false);
    expect(config.baseUrl).toBeNull();
    expect(config.timeoutMs).toBe(10_000);
    expect(config.retryCount).toBe(2);
    expect(config.retryDelayMs).toBe(250);
    expect(config.defaultTrustZone).toBe('amber');
    expect(config.approvalThreshold).toBe('amber');
    expect(config.allowedAgents).toEqual([]);
    expect(config.allowedToolPresets).toEqual([]);
    expect(config.agentAllowlists).toEqual({});
    expect(config.redaction).toEqual({
      enabled: true,
      mask: '[REDACTED]',
      sensitiveKeys: ['authorization', 'apiKey', 'api_key', 'token', 'secret', 'password', 'bearer'],
    });

    expect(snapshot.state).toBe('unconfigured');
    expect(snapshot.configured).toBe(false);
    expect(snapshot.reachable).toBe(false);
    expect(snapshot.baseUrl).toBeNull();
    expect(snapshot.defaultTrustZone).toBe('amber');
    expect(snapshot.approvalThreshold).toBe('amber');
    expect(snapshot.enabledExecutors).toEqual([]);
    expect(snapshot.redactionEnabled).toBe(true);
  });

  it('falls back safely for malformed and blank env values', () => {
    const blankConfig = loadOpenClawConfig({
      env: {
        OPENCLAW_BASE_URL: '   ',
        OPENCLAW_ENABLED: 'maybe',
        OPENCLAW_AGENT_ALLOWLISTS: '[]',
      },
    });

    expect(blankConfig.baseUrl).toBeNull();
    expect(blankConfig.enabled).toBe(false);
    expect(blankConfig.agentAllowlists).toEqual({});

    const malformedConfig = loadOpenClawConfig({
      env: {
        OPENCLAW_BASE_URL: 'not-a-url',
        OPENCLAW_AGENT_ALLOWLISTS: '{not json}',
        OPENCLAW_DEFAULT_TRUST_ZONE: 'ultra-violet',
        OPENCLAW_APPROVAL_THRESHOLD: 'infra-red',
        OPENCLAW_ENABLED: 'false',
        OPENCLAW_REDACTION_ENABLED: '0',
      },
    });

    expect(malformedConfig.baseUrl).toBeNull();
    expect(malformedConfig.enabled).toBe(false);
    expect(malformedConfig.agentAllowlists).toEqual({});
    expect(malformedConfig.defaultTrustZone).toBe('amber');
    expect(malformedConfig.approvalThreshold).toBe('amber');
    expect(malformedConfig.redaction.enabled).toBe(false);
  });

  it('parses explicit token refs and invalid timeout fields without breaking defaults', () => {
    const config = loadOpenClawConfig({
      env: {
        OPENCLAW_API_KEY_REF: 'kv://openclaw/api-key',
        OPENCLAW_TOKEN_REF: 'kv://openclaw/token',
        OPENCLAW_TIMEOUT_MS: 'not-a-number',
        OPENCLAW_RETRY_COUNT: '',
        OPENCLAW_RETRY_DELAY_MS: 'NaN',
      },
    });

    expect(config.apiKeyRef).toBe('kv://openclaw/api-key');
    expect(config.tokenRef).toBe('kv://openclaw/token');
    expect(config.timeoutMs).toBeGreaterThan(0);
    expect(config.retryCount).toBeGreaterThanOrEqual(0);
    expect(config.retryDelayMs).toBeGreaterThanOrEqual(0);
  });
});
