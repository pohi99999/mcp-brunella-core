import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateKeyPairSync } from 'crypto';
import { federatedGateway } from '../../src/core/federation/federatedGateway.js';
import { trustRegistry } from '../../src/core/federation/trustRegistry.js';
import { capabilityManifestManager } from '../../src/core/federation/capabilityManifest.js';
import { inspectFederationPublicKey } from '../../src/security/federationPeerProof.js';

describe('FederatedGateway', () => {
  const originalFetch = globalThis.fetch;
  const localKeyPair = generateKeyPairSync('ed25519');
  const remoteKeyPair = generateKeyPairSync('ed25519');
  const fallbackKeyPair = generateKeyPairSync('ed25519');
  const localPrivateKeyPem = localKeyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  const localPublicKeyPem = localKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const localFingerprint = inspectFederationPublicKey(localPublicKeyPem).publicKeyFingerprint;
  const remotePublicKeyPem = remoteKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const remoteFingerprint = inspectFederationPublicKey(remotePublicKeyPem).publicKeyFingerprint;
  const fallbackPublicKeyPem = fallbackKeyPair.publicKey.export({ type: 'spki', format: 'pem' }).toString();

  beforeEach(() => {
    trustRegistry.clear();
    capabilityManifestManager.clear();
    vi.clearAllMocks();
    process.env.FEDERATION_LOCAL_PRIVATE_KEY = localPrivateKeyPem;
    process.env.FEDERATION_LOCAL_PUBLIC_KEY = localPublicKeyPem;
    process.env.FEDERATION_LOCAL_PEER_ID = 'local-bas';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.FEDERATION_LOCAL_PRIVATE_KEY;
    delete process.env.FEDERATION_LOCAL_PUBLIC_KEY;
    delete process.env.FEDERATION_LOCAL_PEER_ID;
  });

  it('should discover capabilities from trusted peers with valid manifests', async () => {
    await trustRegistry.register({
      peerId: 'peer-1',
      displayName: 'Peer 1',
      endpoint: 'http://p1'
    });

    capabilityManifestManager.issue('peer-1', [
      { name: 'web_search', description: 'desc' }
    ]);

    const candidates = federatedGateway.discoverCapability('web_search');
    expect(candidates.length).toBe(1);
    expect(candidates[0].peerId).toBe('peer-1');
  });

  it('should NOT discover capabilities from non-trusted peers', async () => {
    await trustRegistry.register({
      peerId: 'peer-p',
      displayName: 'Pending',
      endpoint: 'http://pp'
    });
    // Manually set to pending
    const p = trustRegistry.getPeer('peer-p');
    if (p) p.trustState = 'pending';

    capabilityManifestManager.issue('peer-p', [{ name: 'c1', description: 'd1' }]);

    const candidates = federatedGateway.discoverCapability('c1');
    expect(candidates.length).toBe(0);
  });

  it('should route to the best candidate by trust score', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    await trustRegistry.register({ peerId: 'p2', displayName: 'D2', endpoint: 'e2' });

    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    capabilityManifestManager.issue('p2', [{ name: 'c1', description: 'd1' }]);

    // Default trust score is 80 for both.
    const decision = federatedGateway.route('c1');
    expect(decision.selectedPeer).toBeDefined();
    expect(decision.candidates.length).toBe(2);
  });

  it('should prefer requested peer if available', async () => {
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'e1' });
    await trustRegistry.register({ peerId: 'p2', displayName: 'D2', endpoint: 'e2' });

    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    capabilityManifestManager.issue('p2', [{ name: 'c1', description: 'd1' }]);

    const decision = federatedGateway.route('c1', 'p2');
    expect(decision.selectedPeer).toBe('p2');
  });

  it('should handle remote execution with HTTP call', async () => {
    await trustRegistry.register({
      peerId: 'p1',
      displayName: 'D1',
      endpoint: 'http://p1',
      publicKey: remotePublicKeyPem,
    });
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'remote-success' }),
    });
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const result = await federatedGateway.execute({
      capabilityName: 'c1',
      payload: { data: 'test' },
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ result: 'remote-success' });
    expect(fetchMock).toHaveBeenCalledWith(
      'http://p1/api/v1/federation/capabilities/execute',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-federation-peer-id': 'local-bas',
          'x-federation-signature-scheme': 'asymmetric-v1',
          'x-federation-key-id': localFingerprint,
          'x-federation-target-key-id': remoteFingerprint,
        }),
        body: JSON.stringify({
          capabilityName: 'c1',
          payload: { data: 'test' },
        }),
      }),
    );
  });

  it('falls back to the next trusted peer when the preferred peer keeps failing', async () => {
    await trustRegistry.register({
      peerId: 'p1',
      displayName: 'D1',
      endpoint: 'http://p1',
      publicKey: remotePublicKeyPem,
    });
    await trustRegistry.register({
      peerId: 'p2',
      displayName: 'D2',
      endpoint: 'http://p2',
      publicKey: fallbackPublicKeyPem,
    });
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    capabilityManifestManager.issue('p2', [{ name: 'c1', description: 'd1' }]);

    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error('primary peer down'))
      .mockRejectedValueOnce(new Error('primary peer still down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: 'fallback-success' }),
      } as Response);
    globalThis.fetch = fetchMock as typeof globalThis.fetch;

    const result = await federatedGateway.execute({
      capabilityName: 'c1',
      payload: { data: 'test' },
      preferredPeerId: 'p1',
    });

    expect(result.success).toBe(true);
    expect(result.peerId).toBe('p2');
    expect(result.data).toEqual({ result: 'fallback-success' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0]).toBe('http://p1/api/v1/federation/capabilities/execute');
    expect(fetchMock.mock.calls[2][0]).toBe('http://p2/api/v1/federation/capabilities/execute');
  });
});
