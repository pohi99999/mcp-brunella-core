import { describe, it, expect, beforeEach, vi } from 'vitest';
import { federatedGateway } from '../../src/core/federation/federatedGateway.js';
import { trustRegistry } from '../../src/core/federation/trustRegistry.js';
import { capabilityManifestManager } from '../../src/core/federation/capabilityManifest.js';

describe('FederatedGateway', () => {
  beforeEach(() => {
    trustRegistry.clear();
    capabilityManifestManager.clear();
    vi.clearAllMocks();
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
    await trustRegistry.register({ peerId: 'p1', displayName: 'D1', endpoint: 'http://p1' });
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);

    // Mock fetch
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: 'remote-success' })
    });

    const result = await federatedGateway.execute({
      capabilityName: 'c1',
      payload: { data: 'test' }
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ result: 'remote-success' });
    expect(globalThis.fetch).toHaveBeenCalled();

    globalThis.fetch = originalFetch;
  });
});
