import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { logInfo, logWarn } from '../../utils/logger.js';

// ============================================================================
// TYPES
// ============================================================================

export interface Capability {
  name: string;
  description: string;
  version?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  deprecated?: boolean;
  deprecatedMessage?: string;
}

export interface CapabilityManifest {
  manifestId: string;
  peerId: string;
  capabilities: Capability[];
  version: string;
  issuedAt: string;
  expiresAt: string;
  signature: string;
}

export type ManifestVerifyResult = 'valid' | 'invalid_signature' | 'expired';

// ============================================================================
// SIGNING
// ============================================================================

const DEFAULT_SIGNING_SECRET = 'brunella-manifest-signing-secret';

function getSigningSecret(): string {
  return process.env.MANIFEST_SIGNING_SECRET ?? DEFAULT_SIGNING_SECRET;
}

function signManifest(manifest: Omit<CapabilityManifest, 'signature'>): string {
  const payload = JSON.stringify({
    manifestId: manifest.manifestId,
    peerId: manifest.peerId,
    version: manifest.version,
    issuedAt: manifest.issuedAt,
    expiresAt: manifest.expiresAt,
    capabilities: manifest.capabilities.map((c) => c.name).sort(),
  });
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

// ============================================================================
// MANAGER
// ============================================================================

const DEFAULT_MANIFEST_TTL_MS = 60 * 60 * 1000; // 1 hour

class CapabilityManifestManager {
  private readonly cache = new Map<string, CapabilityManifest>();

  /**
   * Issue a signed capability manifest for a peer.
   * The manifest is cached locally and published via PhoenixEventBus.
   */
  issue(
    peerId: string,
    capabilities: Capability[],
    ttlMs = DEFAULT_MANIFEST_TTL_MS,
  ): CapabilityManifest {
    const now = new Date();
    const manifestId = uuidv4();

    const base: Omit<CapabilityManifest, 'signature'> = {
      manifestId,
      peerId,
      capabilities,
      version: '1.0',
      issuedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + ttlMs).toISOString(),
    };

    const signature = signManifest(base);
    const manifest: CapabilityManifest = { ...base, signature };

    this.cache.set(manifestId, manifest);

    phoenixEventBus.publish('phoenix:federation_manifest_issued', {
      manifestId,
      peerId,
      capabilityCount: capabilities.length,
      expiresAt: manifest.expiresAt,
      timestamp: manifest.issuedAt,
    });

    logInfo('CapabilityManifest', `Issued manifest ${manifestId} for peer ${peerId} (${capabilities.length} capabilities)`);
    return manifest;
  }

  /**
   * Verify a manifest's signature and expiry.
   */
  verify(manifest: CapabilityManifest): ManifestVerifyResult {
    if (new Date(manifest.expiresAt) < new Date()) {
      logWarn('CapabilityManifest', `Manifest ${manifest.manifestId} expired`);
      return 'expired';
    }

    const { signature, ...base } = manifest;
    const expected = signManifest(base);

    try {
      const valid = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
      if (!valid) {
        logWarn('CapabilityManifest', `Manifest ${manifest.manifestId} invalid signature`);
        return 'invalid_signature';
      }
    } catch {
      return 'invalid_signature';
    }

    return 'valid';
  }

  getManifest(manifestId: string): CapabilityManifest | undefined {
    return this.cache.get(manifestId);
  }

  listManifestsForPeer(peerId: string): CapabilityManifest[] {
    return Array.from(this.cache.values()).filter((m) => m.peerId === peerId);
  }

  /**
   * Return the first valid (non-expired, valid signature) manifest for a peer.
   */
  getValidManifestForPeer(peerId: string): CapabilityManifest | undefined {
    return this.listManifestsForPeer(peerId).find((m) => this.verify(m) === 'valid');
  }

  /** Clear manifest cache (for testing). */
  clear(): void {
    this.cache.clear();
  }
}

export const capabilityManifestManager = new CapabilityManifestManager();
export default capabilityManifestManager;
