/**
 * src/mesh/edgeColonies.ts
 *
 * Edge Colonies Modul
 * Autonóm, lokális peremhálózatokon futó mikro-ügynökségek kezelésére,
 * melyek minimális késleltetéssel szinkronizálnak a központtal.
 */

import { logInfo, logError } from '../utils/logger.js';
import { PlanetMesh, MeshNode } from './planetMesh.js';

export interface ColonyStatus {
  colonyId: string;
  activeAgents: number;
  cpuLoad: number;
  lastHeartbeat: string;
}

export class EdgeColonies {
  private colonies: Map<string, ColonyStatus> = new Map();
  private planetMesh: PlanetMesh;

  constructor(planetMesh: PlanetMesh) {
    this.planetMesh = planetMesh;
    logInfo('EdgeColonies Manager initialized');
  }

  public registerColony(colonyId: string, regionId: string): void {
    if (!this.planetMesh.getRegions().find(r => r.regionId === regionId)) {
      logError('EdgeColonies', `Cannot register colony in unknown region: ${regionId}`);
      return;
    }

    this.colonies.set(colonyId, {
      colonyId,
      activeAgents: 0,
      cpuLoad: 0,
      lastHeartbeat: new Date().toISOString()
    });

    logInfo('EdgeColonies', `Colony ${colonyId} registered in region ${regionId}`);
  }

  public updateColonyHeartbeat(colonyId: string, activeAgents: number, cpuLoad: number): void {
    const colony = this.colonies.get(colonyId);
    if (colony) {
      colony.activeAgents = activeAgents;
      colony.cpuLoad = cpuLoad;
      colony.lastHeartbeat = new Date().toISOString();
      this.colonies.set(colonyId, colony);
    } else {
      logError('EdgeColonies', `Heartbeat from unknown colony: ${colonyId}`);
    }
  }

  public deployAgentToColony(colonyId: string, agentType: string, nodeId: string, regionId: string): void {
    const colony = this.colonies.get(colonyId);
    if (!colony) {
      throw new Error(`Colony ${colonyId} not found.`);
    }

    // Regisztráljuk a node-ot a PlanetMesh-be
    const node: MeshNode = {
      nodeId,
      regionId,
      agentType,
      capacity: 100 // default capacity
    };

    try {
      this.planetMesh.registerNode(node);
      colony.activeAgents += 1;
      logInfo('EdgeColonies', `Deployed agent ${agentType} (${nodeId}) to colony ${colonyId}`);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('EdgeColonies', `Failed to deploy agent: ${error}`);
    }
  }

  public getColoniesStatus(): ColonyStatus[] {
    return Array.from(this.colonies.values());
  }
}
