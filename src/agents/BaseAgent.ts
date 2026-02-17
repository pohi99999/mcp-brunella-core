/**
 * BaseAgent - Alaposztály az AgentContext/AgentResult használó ügynököknek
 * EdgeProxyAgent, ProjectConductorAgent öröklik
 *
 * IAgent-kompatibilis: az execute(task, context?) bridge automatikusan
 * átalakítja az IAgent hívást AgentContext formátumra.
 */

import { IAgent, ISwarmContext, AgentHandoff, AgentResponse } from './types.js';
import { formatAgentResult } from '../utils/responseFormatter.js';

export interface AgentContext {
  task?: string;
  swarm?: ISwarmContext;
  [key: string]: unknown;
}

export interface AgentResult {
  success: boolean;
  message: string;
  data?: unknown;
  handoff?: AgentHandoff;
  thoughts?: string;
  contextUsed?: string[];
  metadata?: any;        // Egyéb metaadatok (pl. source, confidence)
}

export abstract class BaseAgent implements IAgent {
  abstract name: string;
  abstract description: string;
  abstract role: string;
  capabilities: string[] = [];

  // Opcionális Swarm Context (ha az AgentManager/SwarmManager átadja)
  protected swarmContext?: ISwarmContext;

  /**
   * Belső végrehajtás – a leszármazottak ezt implementálják.
   */
  abstract executeTask(context: AgentContext): Promise<AgentResult>;

  /**
   * IAgent-kompatibilis execute bridge.
   * Az AgentManager és az MCP eszközök egységesen hívhatják:
   *   agent.execute(task, context?)
   *
   * Magyar nyelvű válaszokat ad vissza az AgentResult formázásával.
   */
  async execute(task: string, context?: any): Promise<AgentResponse> {
    const agentContext: AgentContext = {
      task,
      ...(context || {})
    };

    const result = await this.executeTask(agentContext);

    // Format result as Hungarian human-readable text
    const formattedMessage = formatAgentResult(result, this.name, { useEmojis: true });

    return {
      success: result.success,
      status: result.success ? 'success' : 'error',
      message: formattedMessage, // Magyar nyelvű szöveg
      data: result.data,
      error: result.success ? undefined : result.message,
      handoff: result.handoff,
    };
  }

  /**
   * Helper a végrehajtás átadásához
   */
  protected createHandoff(targetAgent: string, instruction: string, reason: string): AgentResult {
    return {
      success: true, // A handoff maga sikeres művelet
      message: `Handoff to ${targetAgent}: ${reason}`,
      handoff: {
        type: 'handoff',
        targetAgent,
        instruction,
        reason
      }
    };
  }
}
