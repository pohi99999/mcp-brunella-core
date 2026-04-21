/**
 * EdgeRouter — Cloudflare-aware routing with fallback
 * Phase 4: Distributed Mesh & Edge Routing
 *
 * Routes requests to the best available node, preferring:
 *   1. Local node (if capability is available)
 *   2. Same-region edge peer
 *   3. Any available peer
 *   4. Cloudflare worker fallback
 */

import { logInfo, logWarn, logError } from '@packages/utils/logger.js';
import type { MeshNodeInfo } from '@packages/core-logic/meshNode.js';
import type { MeshManager } from '@packages/core-logic/meshManager.js';

export interface RouteDecision {
  target: 'local' | 'peer' | 'edge';
  nodeId: string;
  host: string;
  region?: string;
  latencyHint?: number;
  fallback: boolean;
}

export interface EdgeRouterConfig {
  localNodeId: string;
  localRegion?: string;
  cloudflareWorkerUrl?: string;  // e.g. "https://cean-orchestrator.iam-dd1.workers.dev"
  preferLocal: boolean;
  maxRetries: number;
}

const DEFAULT_CONFIG: EdgeRouterConfig = {
  localNodeId: 'local',
  preferLocal: true,
  maxRetries: 2,
  cloudflareWorkerUrl: process.env.CF_EDGE_WORKER_URL,
};

export class EdgeRouter {
  private config: EdgeRouterConfig;
  private meshManager: MeshManager;
  private routeCache = new Map<string, { decision: RouteDecision; cachedAt: number }>();
  private static CACHE_TTL_MS = 10_000;

  constructor(meshManager: MeshManager, config?: Partial<EdgeRouterConfig>) {
    this.meshManager = meshManager;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Resolve the best node for a given capability.
   * Priority: local → same-region peer → any peer → CF edge fallback
   */
  resolve(capability: string): RouteDecision {
    // Check cache
    const cached = this.routeCache.get(capability);
    if (cached && Date.now() - cached.cachedAt < EdgeRouter.CACHE_TTL_MS) {
      return cached.decision;
    }

    const topology = this.meshManager.getTopology();

    // 1. Local node
    if (this.config.preferLocal && topology.local.capabilities.includes(capability) && topology.local.status === 'online') {
      const decision: RouteDecision = {
        target: 'local',
        nodeId: topology.local.nodeId,
        host: topology.local.host,
        region: topology.local.region,
        fallback: false,
      };
      this.cacheDecision(capability, decision);
      return decision;
    }

    // 2. Same-region peer
    const sameRegion = topology.peers.filter(p =>
      p.status === 'online' &&
      p.capabilities.includes(capability) &&
      p.region === this.config.localRegion
    );
    if (sameRegion.length > 0) {
      const best = sameRegion[0];
      const decision: RouteDecision = {
        target: 'peer',
        nodeId: best.nodeId,
        host: best.host,
        region: best.region,
        fallback: false,
      };
      this.cacheDecision(capability, decision);
      return decision;
    }

    // 3. Any online peer with capability
    const anyPeer = topology.peers.filter(p =>
      p.status === 'online' && p.capabilities.includes(capability)
    );
    if (anyPeer.length > 0) {
      const best = anyPeer[0];
      const decision: RouteDecision = {
        target: 'peer',
        nodeId: best.nodeId,
        host: best.host,
        region: best.region,
        fallback: false,
      };
      this.cacheDecision(capability, decision);
      return decision;
    }

    // 4. Cloudflare edge fallback
    if (this.config.cloudflareWorkerUrl) {
      const decision: RouteDecision = {
        target: 'edge',
        nodeId: 'cf-edge',
        host: this.config.cloudflareWorkerUrl,
        region: 'cf-global',
        fallback: true,
      };
      logWarn('EdgeRouter', `No mesh peer for "${capability}", falling back to CF edge`);
      this.cacheDecision(capability, decision);
      return decision;
    }

    // No route found
    throw new Error(`EdgeRouter: No route found for capability "${capability}"`);
  }

  /**
   * Execute a routed request with retry + fallback logic
   */
  async executeRouted(capability: string, toolName: string, input: Record<string, unknown>): Promise<unknown> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const decision = attempt === 0
          ? this.resolve(capability)
          : this.resolveFallback(capability, attempt);

        logInfo('EdgeRouter', `Routing ${capability}/${toolName} → ${decision.target}:${decision.nodeId} (attempt ${attempt + 1})`);

        if (decision.target === 'local') {
          // Local execution — caller handles this
          return { routed: 'local', nodeId: decision.nodeId };
        }

        // Remote execution via peer or edge
        const url = `${decision.host}/api/v1/mesh/execute`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15_000);

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ capability, toolName, input, fromNode: this.config.localNodeId }),
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          throw new Error(`Remote execution failed: ${res.status} ${res.statusText}`);
        }

        return await res.json();
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        logWarn('EdgeRouter', `Attempt ${attempt + 1} failed for ${capability}: ${lastError.message}`);
        // Invalidate cache so next attempt picks a different route
        this.routeCache.delete(capability);
      }
    }

    logError('EdgeRouter', `All attempts failed for ${capability}/${toolName}`);
    throw lastError ?? new Error(`EdgeRouter: all attempts failed for ${capability}`);
  }

  /** Get a fallback route for retry attempts */
  private resolveFallback(capability: string, attempt: number): RouteDecision {
    const topology = this.meshManager.getTopology();
    const available = topology.peers.filter(p =>
      p.status === 'online' && p.capabilities.includes(capability)
    );

    if (attempt <= available.length && available[attempt - 1]) {
      const peer = available[attempt - 1];
      return {
        target: 'peer',
        nodeId: peer.nodeId,
        host: peer.host,
        region: peer.region,
        fallback: true,
      };
    }

    // Ultimate fallback: CF edge
    if (this.config.cloudflareWorkerUrl) {
      return {
        target: 'edge',
        nodeId: 'cf-edge',
        host: this.config.cloudflareWorkerUrl,
        region: 'cf-global',
        fallback: true,
      };
    }

    throw new Error(`EdgeRouter: No fallback route for "${capability}"`);
  }

  private cacheDecision(capability: string, decision: RouteDecision): void {
    this.routeCache.set(capability, { decision, cachedAt: Date.now() });
  }

  /** Clear route cache */
  invalidateCache(): void {
    this.routeCache.clear();
  }
}

