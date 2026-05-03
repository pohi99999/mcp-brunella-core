/**
 * src/orchestration/planetaryOrchestrator.ts
 *
 * Planetary Orchestrator
 * Globális vezérlés, amely koordinálja a Planet Mesh, az Emergent Layer, 
 * és az Edge Colonies működését, elosztva a feladatokat regionálisan és globálisan.
 */

import { logInfo, logError } from '../utils/logger.js';
import { PlanetMesh, RouteResult } from '../mesh/planetMesh.js';
import { EmergentLayer } from '../core/emergentLayer.js';
import { EdgeColonies } from '../mesh/edgeColonies.js';

export interface PlanetaryTask {
  taskId: string;
  requiredAgentType: string;
  payload: any;
  originRegionId?: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
}

export class PlanetaryOrchestrator {
  private mesh: PlanetMesh;
  private emergentLayer: EmergentLayer;
  private edgeColonies: EdgeColonies;

  constructor(mesh: PlanetMesh, emergentLayer: EmergentLayer, edgeColonies: EdgeColonies) {
    this.mesh = mesh;
    this.emergentLayer = emergentLayer;
    this.edgeColonies = edgeColonies;
    logInfo('PlanetaryOrchestrator', 'Planetary orchestrator initialized');
  }

  public async dispatchGlobalTask(task: PlanetaryTask): Promise<{ success: boolean; handledByNode?: string; error?: string }> {
    logInfo('PlanetaryOrchestrator', `Dispatching global task ${task.taskId} of type ${task.requiredAgentType}`);

    const route: RouteResult | null = this.mesh.routeRequest(task.requiredAgentType, task.originRegionId);

    if (!route) {
      logError('PlanetaryOrchestrator', `No available route found for agent type: ${task.requiredAgentType}`);
      // Tanulás a hálózattól - regisztráljuk a sikertelen interakciót az EmergentLayer felé
      this.emergentLayer.recordInteraction('Orchestrator', task.requiredAgentType, false);
      return { success: false, error: 'No suitable agent node available on the Planet Mesh' };
    }

    try {
      logInfo('PlanetaryOrchestrator', `Task ${task.taskId} routed to node ${route.targetNodeId} in region ${route.regionId} (Est. Latency: ${route.estimatedLatency}ms)`);
      
      // Sikeres interakció rögzítése
      this.emergentLayer.recordInteraction('Orchestrator', task.requiredAgentType, true);

      // (A tényleges task execution logika itt hívná meg az adott node backend-jét, most szimuláljuk)
      return { success: true, handledByNode: route.targetNodeId };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('PlanetaryOrchestrator', `Execution failed: ${error}`);
      this.emergentLayer.recordInteraction('Orchestrator', task.requiredAgentType, false);
      return { success: false, error };
    }
  }

  public getSystemOverview(): Record<string, any> {
    return {
      meshTopology: this.mesh.getMeshTopologyStatus(),
      cohesionScore: this.emergentLayer.getGlobalCohesionScore(),
      edgeColonies: this.edgeColonies.getColoniesStatus()
    };
  }
}
