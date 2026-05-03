/**
 * src/mesh/planetMesh.ts
 *
 * Planet-scale mesh topológiai modell és API a Brunella Agent Systemhez.
 *
 * Jellemzők:
 * - Regionális zónákon átívelő (multi-region) elosztott kommunikációs réteg
 * - Szolgáltatófüggetlen absztrakció a routinghoz
 * - Regionális optimalizációs képességek az ágensek között
 */

export interface RegionConfig {
  regionId: string;
  provider: 'cloudflare' | 'gcp' | 'aws' | 'local' | string;
  latencyMs: number;
  status: 'active' | 'degraded' | 'offline';
}

export interface MeshNode {
  nodeId: string;
  regionId: string;
  agentType: string;
  capacity: number;
}

export interface RouteResult {
  targetNodeId: string;
  regionId: string;
  estimatedLatency: number;
  routePath: string[];
}

export class PlanetMesh {
  private regions: Map<string, RegionConfig> = new Map();
  private nodes: Map<string, MeshNode> = new Map();

  constructor() {
    // Alapértelmezett lokális régió regisztrálása
    this.registerRegion({
      regionId: 'local-core',
      provider: 'local',
      latencyMs: 1,
      status: 'active',
    });
  }

  public registerRegion(config: RegionConfig): void {
    this.regions.set(config.regionId, config);
  }

  public registerNode(node: MeshNode): void {
    if (!this.regions.has(node.regionId)) {
      throw new Error(`Region ${node.regionId} is not registered in the Planet Mesh.`);
    }
    this.nodes.set(node.nodeId, node);
  }

  public removeNode(nodeId: string): void {
    this.nodes.delete(nodeId);
  }

  public getRegions(): RegionConfig[] {
    return Array.from(this.regions.values());
  }

  public getNodesInRegion(regionId: string): MeshNode[] {
    return Array.from(this.nodes.values()).filter(node => node.regionId === regionId);
  }

  /**
   * Globális routing és regionális optimalizációs képesség.
   * Megkeresi a legmegfelelőbb node-ot a kért agentType alapján, minimalizálva a késleltetést.
   */
  public routeRequest(agentType: string, sourceRegionId?: string): RouteResult | null {
    const candidates = Array.from(this.nodes.values()).filter(node => node.agentType === agentType);
    
    if (candidates.length === 0) {
      return null;
    }

    let bestNode: MeshNode | null = null;
    let lowestLatency = Infinity;

    for (const candidate of candidates) {
      const region = this.regions.get(candidate.regionId);
      if (region && region.status === 'active') {
        // Egyszerű optimalizációs logika: ha ugyanabban a régióban van, preferáljuk
        let effectiveLatency = region.latencyMs;
        if (sourceRegionId && sourceRegionId === candidate.regionId) {
          effectiveLatency = 0; // Lokális hívás
        }

        if (effectiveLatency < lowestLatency) {
          lowestLatency = effectiveLatency;
          bestNode = candidate;
        }
      }
    }

    if (!bestNode) {
      return null;
    }

    return {
      targetNodeId: bestNode.nodeId,
      regionId: bestNode.regionId,
      estimatedLatency: lowestLatency,
      routePath: sourceRegionId ? [sourceRegionId, bestNode.regionId] : [bestNode.regionId],
    };
  }

  public getMeshTopologyStatus(): Record<string, any> {
    return {
      activeRegions: this.regions.size,
      activeNodes: this.nodes.size,
      regions: Array.from(this.regions.entries()).map(([id, config]) => ({ id, status: config.status })),
    };
  }
}
