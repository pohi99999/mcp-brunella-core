import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { phoenixEventBus } from '../phoenixEventBus.js';
import { logError, logInfo, logWarn } from '@packages/utils/logger.js';
import {
  clearCapabilityManifests,
  loadCapabilityManifests,
  saveCapabilityManifest,
} from '../autonomyRuntimeStore.js';

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
type InternalManifestVerifyResult = ManifestVerifyResult | 'config_error';

// ============================================================================
// SIGNING
// ============================================================================

export class CapabilityManifestConfigError extends Error {
  constructor(message = 'Capability manifest signing requires MANIFEST_SIGNING_SECRET to be configured with at least 32 characters.') {
    super(message);
    this.name = 'CapabilityManifestConfigError';
  }
}

export function isCapabilityManifestConfigError(error: unknown): error is CapabilityManifestConfigError {
  return error instanceof CapabilityManifestConfigError
    || (
      error instanceof Error
      && error.name === 'CapabilityManifestConfigError'
    );
}

function getSigningSecret(): string {
  const secret = process.env.MANIFEST_SIGNING_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new CapabilityManifestConfigError();
  }
  return secret;
}

function buildManifestSigningPayload(manifest: Omit<CapabilityManifest, 'signature'>): string {
  return JSON.stringify({
    manifestId: manifest.manifestId,
    peerId: manifest.peerId,
    version: manifest.version,
    issuedAt: manifest.issuedAt,
    expiresAt: manifest.expiresAt,
    capabilities: manifest.capabilities.map((capability) => capability.name).sort(),
  });
}

function signManifest(manifest: Omit<CapabilityManifest, 'signature'>): string {
  const payload = buildManifestSigningPayload(manifest);
  return crypto.createHmac('sha256', getSigningSecret()).update(payload).digest('hex');
}

// ============================================================================
// MANAGER
// ============================================================================

const DEFAULT_MANIFEST_TTL_MS = 60 * 60 * 1000; // 1 hour

class CapabilityManifestManager {
  private readonly cache = new Map<string, CapabilityManifest>();
  private hydrated = false;

  constructor() {
    phoenixEventBus.subscribe('phoenix:federation_peer_revoked', ({ peerId }) => {
      const removed = this.purgePeer(peerId);
      if (removed > 0) {
        logWarn('CapabilityManifest', `Purged ${removed} cached manifest(s) for revoked peer ${peerId}`);
      }
    });
  }

  private inspectManifest(manifest: CapabilityManifest): { result: InternalManifestVerifyResult; configMessage?: string } {
    if (new Date(manifest.expiresAt) < new Date()) {
      return { result: 'expired' };
    }

    const { signature, ...base } = manifest;
    let expected: string;
    try {
      expected = signManifest(base);
    } catch (error: unknown) {
      if (isCapabilityManifestConfigError(error)) {
        return {
          result: 'config_error',
          configMessage: error.message,
        };
      }

      throw error;
    }

    try {
      const valid = crypto.timingSafeEqual(
        Buffer.from(expected, 'hex'),
        Buffer.from(signature, 'hex'),
      );
      return { result: valid ? 'valid' : 'invalid_signature' };
    } catch {
      return { result: 'invalid_signature' };
    }
  }

  private ensureHydrated(force = false): void {
    if (force) {
      this.cache.clear();
      this.hydrated = false;
    }

    if (this.hydrated) {
      return;
    }

    const restored = loadCapabilityManifests();
    const validManifests: CapabilityManifest[] = [];
    let expiredCount = 0;
    let invalidCount = 0;
    let configBlockedCount = 0;
    let configMessage: string | undefined;

    for (const manifest of restored) {
      const inspection = this.inspectManifest(manifest);
      switch (inspection.result) {
        case 'valid':
          validManifests.push(manifest);
          break;
        case 'expired':
          expiredCount += 1;
          break;
        case 'invalid_signature':
          invalidCount += 1;
          break;
        case 'config_error':
          configBlockedCount += 1;
          configMessage ??= inspection.configMessage;
          break;
      }
    }

    this.cache.clear();
    for (const manifest of validManifests) {
      this.cache.set(manifest.manifestId, manifest);
    }

    if (configBlockedCount > 0) {
      logWarn(
        'CapabilityManifest',
        `Hydration skipped ${configBlockedCount} persisted manifest(s): ${configMessage ?? 'manifest signing is not configured'}. Store left intact until configuration is restored.`,
      );
    } else if (expiredCount > 0 || invalidCount > 0) {
      clearCapabilityManifests();
      for (const manifest of validManifests) {
        saveCapabilityManifest(manifest);
      }
      logWarn(
        'CapabilityManifest',
        `Hydration discarded ${expiredCount} expired and ${invalidCount} unverifiable manifest(s); store compacted to ${validManifests.length} valid manifest(s).`,
      );
    }

    this.hydrated = true;
  }

  hydrateFromStore(force = false): number {
    this.ensureHydrated(force);
    return this.cache.size;
  }

  assertSigningSecretConfigured(): void {
    getSigningSecret();
  }

  /**
   * Issue a signed capability manifest for a peer.
   * The manifest is cached locally and published via PhoenixEventBus.
   */
  issue(
    peerId: string,
    capabilities: Capability[],
    ttlMs = DEFAULT_MANIFEST_TTL_MS,
  ): CapabilityManifest {
    this.ensureHydrated();
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
    saveCapabilityManifest(manifest);

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
    this.ensureHydrated();
    const inspection = this.inspectManifest(manifest);
    switch (inspection.result) {
      case 'expired':
        logWarn('CapabilityManifest', `Manifest ${manifest.manifestId} expired`);
        return 'expired';
      case 'config_error':
        logError(
          'CapabilityManifest',
          `Manifest ${manifest.manifestId} cannot be verified: ${inspection.configMessage ?? 'manifest signing is not configured'}`,
        );
        return 'invalid_signature';
      case 'invalid_signature':
        logWarn('CapabilityManifest', `Manifest ${manifest.manifestId} invalid signature`);
        return 'invalid_signature';
      default:
        return 'valid';
    }
  }

  getManifest(manifestId: string): CapabilityManifest | undefined {
    this.ensureHydrated();
    return this.cache.get(manifestId);
  }

  listManifestsForPeer(peerId: string): CapabilityManifest[] {
    this.ensureHydrated();
    return Array.from(this.cache.values()).filter((m) => m.peerId === peerId);
  }

  /**
   * Return the first valid (non-expired, valid signature) manifest for a peer.
   */
  getValidManifestForPeer(peerId: string): CapabilityManifest | undefined {
    this.ensureHydrated();
    return this.listManifestsForPeer(peerId).find((m) => this.verify(m) === 'valid');
  }

  purgePeer(peerId: string): number {
    this.ensureHydrated();
    const manifests = Array.from(this.cache.values());
    const remaining = manifests.filter((manifest) => manifest.peerId !== peerId);
    const removed = manifests.length - remaining.length;

    if (removed === 0) {
      return 0;
    }

    this.cache.clear();
    clearCapabilityManifests();

    for (const manifest of remaining) {
      this.cache.set(manifest.manifestId, manifest);
      saveCapabilityManifest(manifest);
    }

    return removed;
  }

  /** Clear manifest cache (for testing). */
  clear(): void {
    this.cache.clear();
    this.hydrated = true;
    clearCapabilityManifests();
  }
}

export const capabilityManifestManager = new CapabilityManifestManager();
export default capabilityManifestManager;
