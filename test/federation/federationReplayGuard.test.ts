import { beforeEach, describe, expect, it } from 'vitest';
import { FederationReplayGuard, FEDERATION_REPLAY_TTL_MS } from '../../src/core/federation/federationReplayGuard.js';
import { clearFederationReplayNonces } from '../../src/core/autonomyRuntimeStore.js';

describe('FederationReplayGuard', () => {
  beforeEach(() => {
    clearFederationReplayNonces();
  });

  it('persists consumed nonce/requestId pairs so a fresh guard instance still blocks replay', () => {
    const nowMs = Date.now();
    const firstGuard = new FederationReplayGuard();
    const secondGuard = new FederationReplayGuard();

    expect(firstGuard.consume('peer-1', 'nonce-1', 'request-1', nowMs)).toBe(true);
    expect(secondGuard.consume('peer-1', 'nonce-1', 'request-1', nowMs + 1_000)).toBe(false);
  });

  it('allows the same nonce after the persisted TTL has expired', () => {
    const nowMs = Date.now();
    const firstGuard = new FederationReplayGuard();
    const secondGuard = new FederationReplayGuard();

    expect(firstGuard.consume('peer-1', 'nonce-2', 'request-2', nowMs)).toBe(true);
    expect(secondGuard.consume('peer-1', 'nonce-2', 'request-2', nowMs + FEDERATION_REPLAY_TTL_MS + 1)).toBe(true);
  });
});
