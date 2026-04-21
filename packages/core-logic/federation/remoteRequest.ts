import type { PeerRuntimeKeyBinding } from './trustRegistry.js';
import { signFederationRequest } from '@packages/security/federationPeerAuth.js';
import { logWarn } from '@packages/utils/logger.js';

const RETRYABLE_HTTP_STATUS_CODES = new Set([408, 429]);

export class FederationRemoteHttpError extends Error {
  readonly status: number;
  readonly responseBody: string;

  constructor(status: number, statusText: string, responseBody: string) {
    const suffix = responseBody ? ` ${responseBody}` : '';
    super(`HTTP ${status}: ${statusText}${suffix}`);
    this.name = 'FederationRemoteHttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

function getOrderedTargetKeys(keys: PeerRuntimeKeyBinding[]): PeerRuntimeKeyBinding[] {
  const current = keys.filter((key) => key.status === 'current');
  const next = keys.filter((key) => key.status === 'next');
  const remaining = keys.filter((key) => key.status !== 'current' && key.status !== 'next');

  return Array.from(
    new Map(
      [...current, ...next, ...remaining].map((key) => [key.keyId, key]),
    ).values(),
  );
}

export function isFederationRemoteErrorRetryable(error: unknown): boolean {
  if (!(error instanceof FederationRemoteHttpError)) {
    return true;
  }

  return error.status >= 500 || RETRYABLE_HTTP_STATUS_CODES.has(error.status);
}

export async function postSignedFederationJson<T>(input: {
  endpointBase: string;
  path: string;
  body?: unknown;
  timeoutMs: number;
  targetKeys: PeerRuntimeKeyBinding[];
  headers?: Record<string, string>;
  method?: 'GET' | 'POST';
}): Promise<T> {
  const method = input.method ?? 'POST';
  const orderedTargetKeys = getOrderedTargetKeys(input.targetKeys);
  if (orderedTargetKeys.length === 0) {
    throw new Error('Federation peer has no runtime public key configured');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    for (let index = 0; index < orderedTargetKeys.length; index += 1) {
      const targetKey = orderedTargetKeys[index];
      const headers: Record<string, string> = {
        ...input.headers,
        ...signFederationRequest({
          method,
          path: input.path,
          body: input.body,
          targetKeyId: targetKey.keyId,
          targetPeerPublicKey: targetKey.publicKey,
        }),
      };
      if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
      }

      const requestInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };
      if (method !== 'GET') {
        requestInit.body = JSON.stringify(input.body);
      }

      const response = await fetch(
        `${input.endpointBase.replace(/\/+$/, '')}${input.path}`,
        requestInit,
      );

      if (response.ok) {
        return await response.json() as T;
      }

      const responseBody = await response.text();
      if (response.status === 401 && index < orderedTargetKeys.length - 1) {
        logWarn(
          'FederationRemoteRequest',
          `Peer rejected runtime key ${targetKey.keyId}; retrying with next key ${orderedTargetKeys[index + 1]?.keyId ?? 'unknown'}`,
        );
        continue;
      }

      throw new FederationRemoteHttpError(response.status, response.statusText, responseBody);
    }

    throw new Error('Federation remote request failed without an eligible target key');
  } finally {
    clearTimeout(timer);
  }
}
