/**
 * src/agents/evolution/MetaEvolutionAgent.ts
 *
 * Meta-Evolution Agent (Meta-Evolúciós Ágens)
 *
 * Ez az ágens folyamatosan vizsgálja az Emergent Layer adatait és
 * a Planet Mesh topológiát. Célja, hogy javaslatokat tegyen új
 * struktúrák kódolására vagy meglévő kapcsolatok optimalizálására.
 */

import { IAgent, AgentResponse } from '../types.js';
import { logInfo, logError, setAgentStatus } from '../../utils/logger.js';
import { EmergentLayer } from '../../core/emergentLayer.js';
import { PlanetMesh } from '../../mesh/planetMesh.js';

export interface EvolutionProposal {
  patternId: string;
  recommendation: 'optimize_route' | 'create_new_agent' | 'deprecate_connection';
  reasoning: string;
  confidence: number;
}

export class MetaEvolutionAgent implements IAgent {
  name = 'MetaEvolutionAgent';
  role = 'Kollektív intelligencia struktúrák evolúciós menedzsere';
  description = 'Önvizsgáló ágens, amely a meglévő ágens-topológiákat figyeli, és javaslatokat tesz új struktúrák kódolására a rendszerben lévő mintázatok alapján.';
  capabilities = ['analyze_patterns', 'propose_evolution', 'network_optimization'];

  private emergentLayer: EmergentLayer;
  private planetMesh: PlanetMesh;

  constructor(emergentLayer: EmergentLayer, planetMesh: PlanetMesh) {
    this.emergentLayer = emergentLayer;
    this.planetMesh = planetMesh;
  }

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      logInfo(this.name, `Executing evolution analysis task: ${task}`);
      
      const patterns = this.emergentLayer.getEmergentPatterns(2);
      const cohesion = this.emergentLayer.getGlobalCohesionScore();
      
      const proposals: EvolutionProposal[] = [];

      for (const pattern of patterns) {
        if (pattern.successRate < 0.6 && pattern.frequency > 10) {
          proposals.push({
            patternId: pattern.id,
            recommendation: 'optimize_route',
            reasoning: `Interaction success rate is dropping (${(pattern.successRate * 100).toFixed(1)}%). Consider introducing a proxy agent or optimizing the Planet Mesh routing for ${pattern.sourceAgentType}.`,
            confidence: 0.85
          });
        }

        if (pattern.successRate > 0.95 && pattern.frequency > 50) {
          proposals.push({
            patternId: pattern.id,
            recommendation: 'create_new_agent',
            reasoning: `Highly successful and frequent pattern detected. Consider merging ${pattern.sourceAgentType} and ${pattern.targetAgentType} capabilities into a specialized composite agent.`,
            confidence: 0.72
          });
        }
      }

      const resultData = {
        cohesionScore: cohesion,
        patternsAnalyzed: patterns.length,
        proposals
      };

      return { status: 'success', data: resultData };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
