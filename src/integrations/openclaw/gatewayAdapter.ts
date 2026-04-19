import { Logger } from '../../utils/logger.js';
import { OpenClawConfig, OpenClawGatewayRequest, OpenClawGatewayRequestSchema, OpenClawGatewayResponse, OpenClawGatewayResponseSchema, OpenClawStatusSnapshot, OpenClawStatusSnapshotSchema } from './contracts.js';
import { OpenClawConfigError, OpenClawError, OpenClawGatewayError, OpenClawUnconfiguredError, normalizeOpenClawError } from './errors.js';

export type OpenClawFetchLike = typeof fetch;

export interface OpenClawGatewayAdapter {
  dispatch(request: OpenClawGatewayRequest): Promise<OpenClawGatewayResponse>;
  getRun(runId: string): Promise<OpenClawGatewayResponse>;
  cancelRun(runId: string): Promise<void>;
  healthCheck(): Promise<OpenClawStatusSnapshot>;
}

export interface OpenClawGatewayAdapterOptions {
  fetchImpl?: OpenClawFetchLike;
  logger?: Logger;
}

async function delay(milliseconds: number): Promise<void> {
  if (milliseconds <= 0) {
    return;
  }
  await new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function buildBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
}

function buildHeaders(config: OpenClawConfig): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }
  if (config.apiKeyRef) {
    headers['X-OpenClaw-Api-Key-Ref'] = config.apiKeyRef;
  }
  if (config.tokenRef) {
    headers['X-OpenClaw-Token-Ref'] = config.tokenRef;
  }

  return headers;
}

function createSyntheticDryRunResponse(request: OpenClawGatewayRequest): OpenClawGatewayResponse {
  return OpenClawGatewayResponseSchema.parse({
    runId: `dry-run-${request.id}`,
    status: 'dry_run',
    output: {
      dryRun: true,
      requestId: request.id,
      goalId: request.packet.goalId,
      targetAgent: request.packet.targetAgent,
    },
    warnings: ['OpenClaw dry-run executed locally without contacting the remote gateway.'],
    receivedAt: new Date().toISOString(),
    correlationId: request.correlationId,
    metadata: {
      policyId: request.policy.id,
    },
  });
}

function parseFetchError(error: unknown): OpenClawError {
  return normalizeOpenClawError(error);
}

export class HttpOpenClawGatewayAdapter implements OpenClawGatewayAdapter {
  private readonly config: OpenClawConfig;
  private readonly fetchImpl: OpenClawFetchLike;
  private readonly logger: Logger;

  constructor(config: OpenClawConfig, options: OpenClawGatewayAdapterOptions = {}) {
    this.config = config;
    if (options.fetchImpl) {
      this.fetchImpl = options.fetchImpl;
    } else if (typeof globalThis.fetch === 'function') {
      this.fetchImpl = globalThis.fetch.bind(globalThis);
    } else {
      throw new OpenClawConfigError('OpenClaw gateway adapter requires fetch support in the runtime environment');
    }
    this.logger = options.logger ?? new Logger('OpenClawGateway');
  }

  async dispatch(request: OpenClawGatewayRequest): Promise<OpenClawGatewayResponse> {
    const normalizedRequest = OpenClawGatewayRequestSchema.parse(request);
    if (normalizedRequest.dryRun) {
      this.logger.debug('Executing OpenClaw dry-run dispatch', { requestId: normalizedRequest.id, correlationId: normalizedRequest.correlationId });
      return createSyntheticDryRunResponse(normalizedRequest);
    }

    return this.requestJson<OpenClawGatewayResponse>('/api/v1/openclaw/dispatch', {
      method: 'POST',
      body: JSON.stringify(normalizedRequest),
    }, OpenClawGatewayResponseSchema);
  }

  async getRun(runId: string): Promise<OpenClawGatewayResponse> {
    if (!runId.trim()) {
      throw new OpenClawConfigError('OpenClaw run id is required');
    }

    return this.requestJson<OpenClawGatewayResponse>(`/api/v1/openclaw/runs/${encodeURIComponent(runId)}`, {
      method: 'GET',
    }, OpenClawGatewayResponseSchema);
  }

  async cancelRun(runId: string): Promise<void> {
    if (!runId.trim()) {
      throw new OpenClawConfigError('OpenClaw run id is required');
    }

    await this.requestVoid(`/api/v1/openclaw/runs/${encodeURIComponent(runId)}/cancel`, {
      method: 'POST',
    });
  }

  async healthCheck(): Promise<OpenClawStatusSnapshot> {
    if (!this.config.enabled || !this.config.baseUrl) {
      return OpenClawStatusSnapshotSchema.parse({
        state: 'unconfigured',
        configured: false,
        reachable: false,
        baseUrl: this.config.baseUrl,
        defaultTrustZone: this.config.defaultTrustZone,
        approvalThreshold: this.config.approvalThreshold,
        enabledExecutors: this.config.allowedAgents,
        redactionEnabled: this.config.redaction.enabled,
        lastCheckedAt: new Date().toISOString(),
        message: 'OpenClaw is not configured',
        details: {
          allowedToolPresets: this.config.allowedToolPresets,
        },
      });
    }

    return this.requestJson<OpenClawStatusSnapshot>('/api/v1/openclaw/health', {
      method: 'GET',
    }, OpenClawStatusSnapshotSchema).catch((error: unknown) => {
      const normalized = normalizeOpenClawError(error);
      this.logger.warn('OpenClaw health check failed', { error: normalized.message });
      return OpenClawStatusSnapshotSchema.parse({
        state: 'offline',
        configured: true,
        reachable: false,
        baseUrl: this.config.baseUrl,
        defaultTrustZone: this.config.defaultTrustZone,
        approvalThreshold: this.config.approvalThreshold,
        enabledExecutors: this.config.allowedAgents,
        redactionEnabled: this.config.redaction.enabled,
        lastCheckedAt: new Date().toISOString(),
        message: normalized.message,
        details: {
          retryable: normalized.retryable,
        },
      });
    });
  }

  private async requestJson<T>(path: string, init: RequestInit, schema: { parse: (value: unknown) => T }): Promise<T> {
    if (!this.config.enabled || !this.config.baseUrl) {
      throw new OpenClawUnconfiguredError();
    }

    const attempts = Math.max(1, this.config.retryCount + 1);
    let lastError: OpenClawError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.fetchImpl(new URL(path, buildBaseUrl(this.config.baseUrl)), {
          ...init,
          headers: {
            ...buildHeaders(this.config),
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          const body = await response.text().catch(() => '');
          throw new OpenClawGatewayError(`OpenClaw request to ${path} failed with HTTP ${response.status}`, {
            details: {
              status: response.status,
              body,
            },
            retryable: response.status >= 500,
          });
        }

        const payload = await response.json() as unknown;
        return schema.parse(payload);
      } catch (error: unknown) {
        clearTimeout(timeoutHandle);
        const normalized = parseFetchError(error);
        lastError = normalized;

        if (!normalized.retryable || attempt === attempts) {
          break;
        }

        await delay(this.config.retryDelayMs * attempt);
      }
    }

    throw lastError;
  }

  private async requestVoid(path: string, init: RequestInit): Promise<void> {
    if (!this.config.enabled || !this.config.baseUrl) {
      throw new OpenClawUnconfiguredError();
    }

    const attempts = Math.max(1, this.config.retryCount + 1);
    let lastError: OpenClawError | undefined;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), this.config.timeoutMs);

      try {
        const response = await this.fetchImpl(new URL(path, buildBaseUrl(this.config.baseUrl)), {
          ...init,
          headers: {
            ...buildHeaders(this.config),
            ...(init.headers ?? {}),
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutHandle);

        if (!response.ok) {
          throw new OpenClawGatewayError(`OpenClaw request to ${path} failed with HTTP ${response.status}`, {
            details: { status: response.status },
            retryable: response.status >= 500,
          });
        }
        return;
      } catch (error: unknown) {
        clearTimeout(timeoutHandle);
        const normalized = parseFetchError(error);
        lastError = normalized;
        if (!normalized.retryable || attempt === attempts) {
          break;
        }
        await delay(this.config.retryDelayMs * attempt);
      }
    }

    throw lastError;
  }
}
