import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { trustRegistry } from '../../src/core/federation/trustRegistry.js';
import { phoenixEventBus } from '../../src/core/phoenixEventBus.js';
import { inspectFederationPublicKey } from '../../src/security/federationPeerProof.js';

describe('TrustRegistry', () => {
  beforeEach(() => {
    trustRegistry.clear();
    vi.clearAllMocks();
  });

  it('should register a new peer in trusted state if no approval required', async () => {
    const peer = {
      peerId: 'peer-1',
      displayName: 'Test Peer',
      endpoint: 'http://localhost:8080',
    };

    const result = await trustRegistry.register(peer);
    
    expect(result.peerId).toBe('peer-1');
    expect(result.trustState).toBe('trusted');
    expect(result.trustedAt).toBeDefined();
    expect(trustRegistry.checkTrust('peer-1')).toBe('trusted');
  });

  it('should revoke a trusted peer', async () => {
    await trustRegistry.register({
      peerId: 'peer-1',
      displayName: 'Test Peer',
      endpoint: 'http://localhost:8080',
    });

    const revoked = await trustRegistry.revoke('peer-1', 'Security breach');
    
    expect(revoked?.trustState).toBe('revoked');
    expect(revoked?.revokedAt).toBeDefined();
    expect(trustRegistry.checkTrust('peer-1')).toBe('revoked');
  });

  it('should return unknown for non-registered peers', () => {
    expect(trustRegistry.checkTrust('unknown-peer')).toBe('unknown');
  });

  it('should allow routing only for trusted peers', async () => {
    await trustRegistry.register({
      peerId: 'trusted-1',
      displayName: 'Trusted',
      endpoint: 'http://localhost:8081',
    });

    await trustRegistry.register({
      peerId: 'pending-1',
      displayName: 'Pending',
      endpoint: 'http://localhost:8082',
    });
    // Manually set to pending for test
    const peer = trustRegistry.getPeer('pending-1');
    if (peer) peer.trustState = 'pending';

    expect(await trustRegistry.isPeerAllowedForRouting('trusted-1')).toBe(true);
    expect(await trustRegistry.isPeerAllowedForRouting('pending-1')).toBe(false);
    expect(await trustRegistry.isPeerAllowedForRouting('unknown-1')).toBe(false);
  });

  it('should list peers by state', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    await trustRegistry.register({ peerId: 'p2', displayName: 'D2', endpoint: 'e2' });
    
    const peer2 = trustRegistry.getPeer('p2');
    if (peer2) peer2.trustState = 'revoked';

    expect(trustRegistry.listPeers('trusted').length).toBe(1);
    expect(trustRegistry.listPeers('revoked').length).toBe(1);
    expect(trustRegistry.listPeers().length).toBe(2);
  });

  it('returns current and next federation runtime keys from peer metadata', async () => {
    const currentKeyPair = generateKeyPairSync('ed25519');
    const nextKeyPair = generateKeyPairSync('ed25519');
    const currentPublicKeyPem = currentKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const nextPublicKeyPem = nextKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
    const currentFingerprint = inspectFederationPublicKey(currentPublicKeyPem).publicKeyFingerprint;
    const nextFingerprint = inspectFederationPublicKey(nextPublicKeyPem).publicKeyFingerprint;

    await trustRegistry.register({
      peerId: 'peer-runtime-keys',
      displayName: 'Runtime Keys',
      endpoint: 'http://localhost:8083',
      publicKey: currentPublicKeyPem,
      metadata: {
        nextPublicKey: nextPublicKeyPem,
      },
    });

    const runtimeKeys = trustRegistry.getPeerRuntimeKeys('peer-runtime-keys');
    expect(runtimeKeys).toEqual([
      expect.objectContaining({ keyId: currentFingerprint, status: 'current' }),
      expect.objectContaining({ keyId: nextFingerprint, status: 'next' }),
    ]);
    expect(trustRegistry.getPeerRuntimeKeyId('peer-runtime-keys')).toBe(currentFingerprint);
  });
});
