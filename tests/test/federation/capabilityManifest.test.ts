import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CapabilityManifestConfigError, capabilityManifestManager } from '../../src/core/federation/capabilityManifest.js';
import { phoenixEventBus } from '../../src/core/phoenixEventBus.js';

describe('CapabilityManifest', () => {
  beforeEach(() => {
    capabilityManifestManager.clear();
    process.env.MANIFEST_SIGNING_SECRET = 'test-manifest-secret-0123456789abcd';
  });

  afterEach(() => {
    delete process.env.MANIFEST_SIGNING_SECRET;
  });

  it('should issue a signed manifest', () => {
    const peerId = 'peer-1';
    const capabilities = [
      { name: 'web_search', description: 'Search the web' },
      { name: 'vision', description: 'Analyze images' }
    ];

    const manifest = capabilityManifestManager.issue(peerId, capabilities);
    
    expect(manifest.peerId).toBe(peerId);
    expect(manifest.capabilities.length).toBe(2);
    expect(manifest.signature).toBeDefined();
    expect(manifest.issuedAt).toBeDefined();
    expect(manifest.expiresAt).toBeDefined();
  });

  it('should verify a valid manifest', () => {
    const manifest = capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    const result = capabilityManifestManager.verify(manifest);
    expect(result).toBe('valid');
  });

  it('should reject an expired manifest', () => {
    // Issue with negative TTL
    const manifest = capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }], -1000);
    const result = capabilityManifestManager.verify(manifest);
    expect(result).toBe('expired');
  });

  it('should reject a manifest with invalid signature', () => {
    const manifest = capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    manifest.signature = 'wrong-signature';
    const result = capabilityManifestManager.verify(manifest);
    expect(result).toBe('invalid_signature');
  });

  it('should fail closed when MANIFEST_SIGNING_SECRET is missing during issue', () => {
    delete process.env.MANIFEST_SIGNING_SECRET;

    expect(() => capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]))
      .toThrow(CapabilityManifestConfigError);
  });

  it('should fail closed when MANIFEST_SIGNING_SECRET is too short during issue', () => {
    process.env.MANIFEST_SIGNING_SECRET = 'short-secret';

    expect(() => capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]))
      .toThrow(CapabilityManifestConfigError);
  });

  it('should return invalid_signature when MANIFEST_SIGNING_SECRET is missing during verification', () => {
    const manifest = capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    delete process.env.MANIFEST_SIGNING_SECRET;

    expect(capabilityManifestManager.verify(manifest)).toBe('invalid_signature');
  });

  it('should return invalid_signature after manifest signing secret rotation', () => {
    const manifest = capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    process.env.MANIFEST_SIGNING_SECRET = 'rotated-manifest-secret-0123456789ab';

    expect(capabilityManifestManager.verify(manifest)).toBe('invalid_signature');
  });

  it('rehydrates only valid manifests after secret rotation cleanup', () => {
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    capabilityManifestManager.issue('p2', [{ name: 'c2', description: 'd2' }]);
    process.env.MANIFEST_SIGNING_SECRET = 'rotated-manifest-secret-0123456789ab';

    expect(capabilityManifestManager.hydrateFromStore(true)).toBe(0);
    expect(capabilityManifestManager.listManifestsForPeer('p1')).toEqual([]);
    expect(capabilityManifestManager.listManifestsForPeer('p2')).toEqual([]);
  });

  it('keeps persisted manifests untouched when hydration is blocked by missing config', () => {
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    delete process.env.MANIFEST_SIGNING_SECRET;

    expect(capabilityManifestManager.hydrateFromStore(true)).toBe(0);
    process.env.MANIFEST_SIGNING_SECRET = 'test-manifest-secret-0123456789abcd';

    expect(capabilityManifestManager.hydrateFromStore(true)).toBe(1);
    expect(capabilityManifestManager.listManifestsForPeer('p1')).toHaveLength(1);
  });

  it('should find valid manifest for peer', () => {
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    const valid = capabilityManifestManager.getValidManifestForPeer('p1');
    expect(valid).toBeDefined();
    expect(valid?.peerId).toBe('p1');
  });

  it('purges manifests for revoked peers when revoke is published', () => {
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    capabilityManifestManager.issue('p2', [{ name: 'c2', description: 'd2' }]);

    phoenixEventBus.publish('phoenix:federation_peer_revoked', {
      peerId: 'p1',
      displayName: 'Peer 1',
      reason: 'compromised',
      timestamp: new Date().toISOString(),
    });

    expect(capabilityManifestManager.listManifestsForPeer('p1')).toEqual([]);
    expect(capabilityManifestManager.listManifestsForPeer('p2')).toHaveLength(1);
  });
});
