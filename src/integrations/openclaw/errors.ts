import { ensureError } from '../../utils/ensureError.js';

export type OpenClawErrorCode =
  | 'OPENCLAW_ERROR'
  | 'OPENCLAW_CONFIG_ERROR'
  | 'OPENCLAW_POLICY_ERROR'
  | 'OPENCLAW_GATEWAY_ERROR'
  | 'OPENCLAW_DISPATCH_ERROR'
  | 'OPENCLAW_TIMEOUT'
  | 'OPENCLAW_UNCONFIGURED';

export interface OpenClawErrorOptions {
  code?: OpenClawErrorCode;
  retryable?: boolean;
  details?: unknown;
}

export class OpenClawError extends Error {
  readonly code: OpenClawErrorCode;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(message: string, options: OpenClawErrorOptions = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = options.code ?? 'OPENCLAW_ERROR';
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class OpenClawConfigError extends OpenClawError {
  constructor(message: string, options: OpenClawErrorOptions = {}) {
    super(message, { code: 'OPENCLAW_CONFIG_ERROR', retryable: false, ...options });
  }
}

export class OpenClawPolicyError extends OpenClawError {
  constructor(message: string, options: OpenClawErrorOptions = {}) {
    super(message, { code: 'OPENCLAW_POLICY_ERROR', retryable: false, ...options });
  }
}

export class OpenClawGatewayError extends OpenClawError {
  constructor(message: string, options: OpenClawErrorOptions = {}) {
    super(message, { code: 'OPENCLAW_GATEWAY_ERROR', retryable: true, ...options });
  }
}

export class OpenClawDispatchError extends OpenClawError {
  constructor(message: string, options: OpenClawErrorOptions = {}) {
    super(message, { code: 'OPENCLAW_DISPATCH_ERROR', retryable: false, ...options });
  }
}

export class OpenClawTimeoutError extends OpenClawGatewayError {
  constructor(message = 'OpenClaw request timed out', options: OpenClawErrorOptions = {}) {
    super(message, { code: 'OPENCLAW_TIMEOUT', retryable: true, ...options });
  }
}

export class OpenClawUnconfiguredError extends OpenClawConfigError {
  constructor(message = 'OpenClaw is not configured', options: OpenClawErrorOptions = {}) {
    super(message, { code: 'OPENCLAW_UNCONFIGURED', retryable: false, ...options });
  }
}

export function normalizeOpenClawError(error: unknown): OpenClawError {
  if (error instanceof OpenClawError) {
    return error;
  }

  const normalized = ensureError(error);
  if (normalized.name === 'AbortError' || /timeout/i.test(normalized.message)) {
    return new OpenClawTimeoutError(normalized.message, { details: error });
  }

  return new OpenClawGatewayError(normalized.message || 'OpenClaw operation failed', {
    details: error,
    retryable: false,
  });
}
