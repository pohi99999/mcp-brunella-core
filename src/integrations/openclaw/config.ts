import { OpenClawConfig, OpenClawConfigSchema, OpenClawStatusSnapshot, OpenClawTrustZone, OpenClawTrustZoneSchema } from './contracts.js';

export interface OpenClawConfigLoaderOptions {
  env?: Record<string, string | undefined>;
}

export const DEFAULT_OPENCLAW_CONFIG: Omit<OpenClawConfig, 'baseUrl' | 'apiKey' | 'apiKeyRef' | 'tokenRef'> = {
  timeoutMs: 10_000,
  retryCount: 2,
  retryDelayMs: 250,
  defaultTrustZone: 'amber',
  approvalThreshold: 'amber',
  enabled: false,
  allowedAgents: [],
  allowedToolPresets: [],
  agentAllowlists: {},
  redaction: {
    enabled: true,
    mask: '[REDACTED]',
    sensitiveKeys: ['authorization', 'apiKey', 'api_key', 'token', 'secret', 'password', 'bearer'],
  },
};

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return fallback;
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseList(value: string | undefined): string[] {
  if (!value) {
    return [];
  }
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseAgentAllowlists(value: string | undefined): Record<string, string[]> {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const output: Record<string, string[]> = {};
      for (const [agent, scopes] of Object.entries(parsed as Record<string, unknown>)) {
        if (Array.isArray(scopes)) {
          output[agent] = scopes.filter((scope): scope is string => typeof scope === 'string' && scope.trim().length > 0);
        }
      }
      return output;
    }
  } catch {
    return {};
  }

  return {};
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function normalizeTrustZone(value: string | undefined, fallback: OpenClawTrustZone): OpenClawTrustZone {
  const parsed = OpenClawTrustZoneSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

export function loadOpenClawConfig(options: OpenClawConfigLoaderOptions = {}): OpenClawConfig {
  const env = options.env ?? process.env;
  const baseUrl = normalizeBaseUrl(env.OPENCLAW_BASE_URL);
  const config = OpenClawConfigSchema.parse({
    ...DEFAULT_OPENCLAW_CONFIG,
    baseUrl,
    apiKey: env.OPENCLAW_API_KEY?.trim() || undefined,
    apiKeyRef: env.OPENCLAW_API_KEY_REF?.trim() || undefined,
    tokenRef: env.OPENCLAW_TOKEN_REF?.trim() || undefined,
    timeoutMs: parseNumber(env.OPENCLAW_TIMEOUT_MS, DEFAULT_OPENCLAW_CONFIG.timeoutMs),
    retryCount: parseNumber(env.OPENCLAW_RETRY_COUNT, DEFAULT_OPENCLAW_CONFIG.retryCount),
    retryDelayMs: parseNumber(env.OPENCLAW_RETRY_DELAY_MS, DEFAULT_OPENCLAW_CONFIG.retryDelayMs),
    defaultTrustZone: normalizeTrustZone(env.OPENCLAW_DEFAULT_TRUST_ZONE, DEFAULT_OPENCLAW_CONFIG.defaultTrustZone),
    approvalThreshold: normalizeTrustZone(env.OPENCLAW_APPROVAL_THRESHOLD, DEFAULT_OPENCLAW_CONFIG.approvalThreshold),
    enabled: parseBoolean(env.OPENCLAW_ENABLED, Boolean(baseUrl)),
    allowedAgents: parseList(env.OPENCLAW_ALLOWED_AGENTS),
    allowedToolPresets: parseList(env.OPENCLAW_ALLOWED_TOOL_PRESETS),
    agentAllowlists: parseAgentAllowlists(env.OPENCLAW_AGENT_ALLOWLISTS),
    redaction: {
      enabled: parseBoolean(env.OPENCLAW_REDACTION_ENABLED, DEFAULT_OPENCLAW_CONFIG.redaction.enabled),
      mask: env.OPENCLAW_REDACTION_MASK?.trim() || DEFAULT_OPENCLAW_CONFIG.redaction.mask,
      sensitiveKeys: parseList(env.OPENCLAW_REDACTION_SENSITIVE_KEYS).length > 0
        ? parseList(env.OPENCLAW_REDACTION_SENSITIVE_KEYS)
        : DEFAULT_OPENCLAW_CONFIG.redaction.sensitiveKeys,
    },
  });

  return config;
}

export function snapshotOpenClawConfig(config: OpenClawConfig): Omit<OpenClawConfig, 'apiKey'> {
  const { apiKey: _apiKey, ...snapshot } = config;
  return snapshot;
}

export function createOpenClawStatusSnapshot(
  config: OpenClawConfig,
  overrides: Partial<OpenClawStatusSnapshot> = {},
): OpenClawStatusSnapshot {
  const configured = Boolean(config.enabled && config.baseUrl);
  return {
    state: configured ? 'ready' : 'unconfigured',
    configured,
    reachable: configured,
    baseUrl: config.baseUrl,
    defaultTrustZone: config.defaultTrustZone,
    approvalThreshold: config.approvalThreshold,
    enabledExecutors: config.allowedAgents,
    redactionEnabled: config.redaction.enabled,
    lastCheckedAt: new Date().toISOString(),
    message: configured ? 'OpenClaw is configured' : 'OpenClaw is not configured',
    details: {
      allowedToolPresets: config.allowedToolPresets,
      agentAllowlists: config.agentAllowlists,
    },
    ...overrides,
  };
}
