/**
 * src/agents/evolution/MetaEvolutionManager.ts
 *
 * Menedzseli a Meta-Evolúciós folyamatot. 
 */

import { EmergentLayer } from '../../core/emergentLayer.js';
import { PlanetMesh } from '../../mesh/planetMesh.js';
import { MetaEvolutionAgent, EvolutionProposal } from './MetaEvolutionAgent.js';
import { logInfo, logError } from '../../utils/logger.js';

export class MetaEvolutionManager {
  private agent: MetaEvolutionAgent;

  constructor(emergentLayer: EmergentLayer, planetMesh: PlanetMesh) {
    this.agent = new MetaEvolutionAgent(emergentLayer, planetMesh);
  }

  public async runEvolutionCycle(): Promise<EvolutionProposal[]> {
    logInfo('MetaEvolutionManager', 'Starting evolution cycle');
    const response = await this.agent.execute('Analyze emergent patterns and propose network evolution');
    
    if (response.status === 'success' && response.data) {
      const resultData = response.data as { proposals: EvolutionProposal[] };
      return resultData.proposals;
    } else {
      logError('MetaEvolutionManager', `Evolution cycle failed: ${response.error}`);
      return [];
    }
  }
}
