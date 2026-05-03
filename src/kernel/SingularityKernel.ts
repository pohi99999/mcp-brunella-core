/**
 * src/kernel/SingularityKernel.ts
 *
 * Singularity Kernel
 * Ez a kernel fogja össze az új planetáris modulokat, és biztosítja az 
 * autonóm AI-operációs rendszer magját. Integrálja a hálózatot, az evolúciót
 * és a tudásgráf feletti szuperstruktúrát.
 */

import { logInfo, logError } from '../utils/logger.js';
import { PlanetMesh } from '../mesh/planetMesh.js';
import { EmergentLayer } from '../core/emergentLayer.js';
import { EdgeColonies } from '../mesh/edgeColonies.js';
import { PlanetaryOrchestrator } from '../orchestration/planetaryOrchestrator.js';
import { KnowledgeSuperstructure } from '../core/knowledgeSuperstructure.js';
import { MetaEvolutionManager } from '../agents/evolution/MetaEvolutionManager.js';

export class SingularityKernel {
  public planetMesh: PlanetMesh;
  public emergentLayer: EmergentLayer;
  public edgeColonies: EdgeColonies;
  public orchestrator: PlanetaryOrchestrator;
  public knowledge: KnowledgeSuperstructure;
  public metaEvolution: MetaEvolutionManager;

  private isRunning: boolean = false;

  constructor() {
    logInfo('SingularityKernel', 'Initializing Singularity Kernel components...');
    
    this.planetMesh = new PlanetMesh();
    this.emergentLayer = new EmergentLayer();
    this.edgeColonies = new EdgeColonies(this.planetMesh);
    
    this.orchestrator = new PlanetaryOrchestrator(
      this.planetMesh, 
      this.emergentLayer, 
      this.edgeColonies
    );
    
    this.knowledge = new KnowledgeSuperstructure();
    this.metaEvolution = new MetaEvolutionManager(this.emergentLayer, this.planetMesh);

    logInfo('SingularityKernel', 'Core initialization complete.');
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      logInfo('SingularityKernel', 'Kernel is already running.');
      return;
    }
    
    this.isRunning = true;
    logInfo('SingularityKernel', 'Kernel started. Autonomous operations active.');
    
    // Első meta-evolúciós ciklus szimulálása / indítása async módon
    setTimeout(() => this.runEvolutionCycleTask(), 5000);
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }
    
    this.isRunning = false;
    logInfo('SingularityKernel', 'Kernel stopped.');
  }

  private async runEvolutionCycleTask(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const proposals = await this.metaEvolution.runEvolutionCycle();
      if (proposals.length > 0) {
        logInfo('SingularityKernel', `Received ${proposals.length} evolution proposals.`);
        // További automatizált implementáció (kódgenerálás, review, deploy) helye
      } else {
        logInfo('SingularityKernel', 'No evolution proposals in this cycle.');
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('SingularityKernel', `Error during evolution cycle: ${error}`);
    }

    // Ütemezzük a következőt (pl. percenként)
    if (this.isRunning) {
      setTimeout(() => this.runEvolutionCycleTask(), 60000);
    }
  }
}
