/**
 * BaseAgent - Alaposztály az AgentContext/AgentResult használó ügynököknek
 * EdgeProxyAgent, ProjectConductorAgent öröklik
 *
 * IAgent-kompatibilis: az execute(task, context?) bridge automatikusan
 * átalakítja az IAgent hívást AgentContext formátumra.
 */

import { IAgent, ISwarmContext, AgentHandoff, AgentResponse } from './types.js';
import { formatAgentResult } from '../utils/responseFormatter.js';
import { searchRAG, addToIndex } from '../utils/rag.js';
import { logInfo, logError } from '../utils/logger.js';

export interface AgentContext {
  task?: string;
  swarm?: ISwarmContext;
  [key: string]: unknown;
}

export interface AgentResult {
  success: boolean;
  message: string;
  status?: string;       // Opcionális státusz (pl. 'success', 'error' - teszt kompatibilitás)
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
    // 1. Kognitív memória lekérdezése végrehajtás előtt
    const pastExperiences = await this.queryMemory(task, 3);
    
    const agentContext: AgentContext = {
      task,
      pastExperiences, // Átadjuk az ügynöknek a múltbeli tapasztalatokat
      ...(context || {})
    };

    const result = await this.executeTask(agentContext);

    // 2. Tapasztalat mentése a memóriába (siker és hiba is)
    const outcome = result.success ? 'SIKER' : 'HIBA';
    const experienceContent = `Feladat: "${task}" | Eredmény: ${outcome} | Üzenet: ${result.message}`;
    await this.saveToMemory(experienceContent, { 
      status: result.success ? 'success' : 'error',
      taskId: context?.taskId 
    });

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

  /**
   * Query the agent's cognitive memory (LanceDB)
   */
  protected async queryMemory(query: string, limit = 5): Promise<Array<{ text: string; score?: number }>> {
    logInfo(this.name, `Memória lekérdezése: "${query.substring(0, 50)}..."`);
    try {
      const results = await searchRAG(query, limit);
      return results.map(r => ({ text: r.text, score: r.score }));
    } catch (e) {
      logError(this.name, `Memória lekérdezés hiba: ${e}`);
      return [];
    }
  }

  /**
   * Save an experience to the cognitive memory
   */
  protected async saveToMemory(content: string, metadata: any = {}): Promise<void> {
    const memoryContent = `[${this.name}] ${content}`;
    const memoryId = metadata.id || `${this.name.toLowerCase()}_${Date.now()}`;
    
    logInfo(this.name, `Tapasztalat mentése a memóriába: ${memoryId}`);
    try {
      await addToIndex(memoryId, memoryContent);
    } catch (e) {
      logError(this.name, `Memória mentési hiba: ${e}`);
    }
  }
}
