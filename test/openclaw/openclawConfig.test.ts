import { describe, expect, it } from 'vitest';
import { createOpenClawStatusSnapshot, loadOpenClawConfig } from '../../src/integrations/openclaw/index.js';

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
});
