import { describe, it, expect, beforeEach, vi } from 'vitest';
import { capabilityManifestManager } from '../../src/core/federation/capabilityManifest.js';

describe('CapabilityManifest', () => {
  beforeEach(() => {
    capabilityManifestManager.clear();
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

  it('should find valid manifest for peer', () => {
    capabilityManifestManager.issue('p1', [{ name: 'c1', description: 'd1' }]);
    const valid = capabilityManifestManager.getValidManifestForPeer('p1');
    expect(valid).toBeDefined();
    expect(valid?.peerId).toBe('p1');
  });
});
