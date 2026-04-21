/**
 * AutoJoin — Automatic mesh node discovery and join protocol
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Handles automatic joining of new nodes to the mesh via:
 *   1. Well-known seed nodes
 *   2. Local network broadcast (mDNS-style, via HTTP)
 *   3. Cloudflare registry lookup
 */

import { logInfo, logWarn, logError } from '@packages/utils/logger.js';
import { MeshNode, type MeshNodeInfo } from './meshNode.js';
import type { MeshManager } from './meshManager.js';

export interface SeedNode {
  host: string;
  label?: string;
  region?: string;
}

export interface AutoJoinConfig {
  seedNodes: SeedNode[];
  cloudflareRegistryUrl?: string;
  retryIntervalMs: number;
  maxRetries: number;
}

const DEFAULT_CONFIG: AutoJoinConfig = {
  seedNodes: [],
  retryIntervalMs: 10_000,
  maxRetries: 5,
};

export class AutoJoin {
  private localNode: MeshNode;
  private meshManager: MeshManager;
  private config: AutoJoinConfig;
  private joined = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(localNode: MeshNode, meshManager: MeshManager, config?: Partial<AutoJoinConfig>) {
    this.localNode = localNode;
    this.meshManager = meshManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Attempt to join the mesh by contacting seed nodes */
  async join(): Promise<boolean> {
    if (this.joined) return true;

    let attempt = 0;
    while (attempt < this.config.maxRetries) {
      attempt++;
      logInfo('AutoJoin', `Join attempt ${attempt}/${this.config.maxRetries}`);

      // Try seed nodes
      for (const seed of this.config.seedNodes) {
        const success = await this.tryJoinViaSeed(seed);
        if (success) {
          this.joined = true;
          logInfo('AutoJoin', `Successfully joined mesh via seed ${seed.host}`);
          return true;
        }
      }

      // Try Cloudflare registry
      if (this.config.cloudflareRegistryUrl) {
        const success = await this.tryJoinViaCloudflare();
        if (success) {
          this.joined = true;
          logInfo('AutoJoin', `Successfully joined mesh via Cloudflare registry`);
          return true;
        }
      }

      if (attempt < this.config.maxRetries) {
        logWarn('AutoJoin', `All seeds failed, retrying in ${this.config.retryIntervalMs}ms...`);
        await this.sleep(this.config.retryIntervalMs);
      }
    }

    logWarn('AutoJoin', `Could not join mesh after ${this.config.maxRetries} attempts. Running standalone.`);
    return false;
  }

  /** Schedule periodic rejoin attempts (for recovery) */
  startAutoRejoin(intervalMs: number = 60_000): void {
    this.retryTimer = setInterval(async () => {
      if (!this.joined || this.meshManager.listPeers().length === 0) {
        logInfo('AutoJoin', 'Attempting periodic rejoin...');
        await this.join();
      }
    }, intervalMs);
  }

  /** Stop auto-rejoin */
  stop(): void {
    if (this.retryTimer) {
      clearInterval(this.retryTimer);
      this.retryTimer = null;
    }
  }

  /** Try to join via a specific seed node */
  private async tryJoinViaSeed(seed: SeedNode): Promise<boolean> {
    try {
      const url = `${seed.host.replace(/\/$/, '')}/api/v1/mesh/join`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.localNode.toInfo()),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        logWarn('AutoJoin', `Seed ${seed.host} returned ${res.status}`);
        return false;
      }

      const data = await res.json() as { peers: MeshNodeInfo[] };
      // Register all peers returned by the seed
      for (const peer of data.peers ?? []) {
        if (peer.nodeId !== this.localNode.nodeId) {
          this.meshManager.registerPeer(peer);
        }
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('AutoJoin', `Failed to reach seed ${seed.host}: ${msg}`);
      return false;
    }
  }

  /** Try to join via Cloudflare worker registry */
  private async tryJoinViaCloudflare(): Promise<boolean> {
    if (!this.config.cloudflareRegistryUrl) return false;

    try {
      const url = `${this.config.cloudflareRegistryUrl}/mesh/register`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.localNode.toInfo()),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        logWarn('AutoJoin', `Cloudflare registry returned ${res.status}`);
        return false;
      }

      const data = await res.json() as { peers: MeshNodeInfo[] };
      for (const peer of data.peers ?? []) {
        if (peer.nodeId !== this.localNode.nodeId) {
          this.meshManager.registerPeer(peer);
        }
      }
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError('AutoJoin', `Cloudflare registry failed: ${msg}`);
      return false;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

