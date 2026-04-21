/**
 * BaseAgent - Alaposztály az AgentContext/AgentResult használó ügynököknek
 * EdgeProxyAgent, ProjectConductorAgent öröklik
 *
 * IAgent-kompatibilis: az execute(task, context?) bridge automatikusan
 * átalakítja az IAgent hívást AgentContext formátumra.
 */

import { IAgent, ISwarmContext, AgentHandoff, AgentResponse } from './types.js';
import { formatAgentResult } from '@packages/utils/responseFormatter.js';
import { searchRAG, addToIndex } from '@packages/utils/rag.js';
import { logInfo, logError, logWarn, setAgentStatus } from '@packages/utils/logger.js';
import { ensureError } from '@packages/utils/ensureError.js';
import { calculateConfidence } from './scoring/confidenceCalculator.js';
import { wrapWithSpan } from '@packages/utils/otelTracing.js';
import { checkPattern, getPatternReuseThreshold } from '@packages/core-logic/patternReuse.js';
import { queryMemory as queryStructuredMemory, saveMemory as saveStructuredMemory, type StoredAgentMemory } from '@packages/core-logic/structuredMemory.js';
import { guardAgentResponseOutput, guardAgentResultOutput } from '@packages/core-logic/outputGuard.js';
import { fireHookSafely, isHookEnabled } from '@packages/core-logic/hookRegistry.js';
import { fireHook as fireLifecycleHook } from '@packages/core-logic/agentHookEngine.js';
import {
  attachWorkingMemoryObservation,
  appendWorkingMemoryMessage,
  createWorkingMemoryState,
  type WorkingMemoryState,
} from '@packages/core-logic/workingMemory.js';

export interface AgentContext {
  task?: string;
  swarm?: ISwarmContext;
  workingMemory?: WorkingMemoryState;
  payload?: {
      bankCsvPath?: string;
      [key: string]: unknown;
  };
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
  metadata?: Record<string, unknown>;        // Egyéb metaadatok (pl. source, confidence)
}

export abstract class BaseAgent implements IAgent {
  abstract name: string;
  abstract description: string;
  abstract role: string;
  capabilities: string[] = [];

  // Opcionális Swarm Context (ha az AgentManager/SwarmManager átadja)
  protected swarmContext?: ISwarmContext;

  protected isTestMode(): boolean {
    return (
      process.env.NODE_ENV === 'test' ||
      process.env.VITEST === 'true' ||
      process.env.VITEST_WORKER_ID !== undefined
    );
  }

  /**
   * Belső végrehajtás – a leszármazottak ezt implementálják.
   */
  abstract executeTask(context: AgentContext): Promise<AgentResult>;

  private toStructuredExperience(memory: StoredAgentMemory): { text: string; score?: number } {
    const resultRecord = typeof memory.result === 'object' && memory.result !== null
      ? memory.result as Record<string, unknown>
      : null;
    const message = resultRecord && typeof resultRecord.message === 'string'
      ? resultRecord.message
      : JSON.stringify(memory.result);

    return {
      text: `StructuredMemory | Task: ${memory.rawTask} | Result: ${message}`,
      score: memory.confidence,
    };
  }

  private normalizeCachedResult(cached: unknown): AgentResult {
    if (typeof cached === 'object' && cached !== null) {
      const record = cached as Record<string, unknown>;
      const success = typeof record.success === 'boolean'
        ? record.success
        : record.status === 'success';
      const message = typeof record.message === 'string'
        ? record.message
        : 'Találat a strukturált memóriában.';

      return {
        success,
        message,
        status: typeof record.status === 'string' ? record.status : success ? 'success' : 'error',
        data: record.data,
        handoff: record.handoff as AgentHandoff | undefined,
        thoughts: typeof record.thoughts === 'string' ? record.thoughts : undefined,
        contextUsed: Array.isArray(record.contextUsed)
          ? record.contextUsed.filter((item): item is string => typeof item === 'string')
          : undefined,
        metadata: typeof record.metadata === 'object' && record.metadata !== null
          ? { ...(record.metadata as Record<string, unknown>) }
          : {},
      };
    }

    return {
      success: true,
      message: 'Találat a strukturált memóriában.',
      data: cached,
      metadata: {},
    };
  }

  /**
   * IAgent-kompatibilis execute bridge.
   * Az AgentManager és az MCP eszközök egységesen hívhatják:
   *   agent.execute(task, context?)
   *
   * Magyar nyelvű válaszokat ad vissza az AgentResult formázásával.
   */
  async execute(task: string, context?: AgentContext): Promise<AgentResponse> {
    const testMode = this.isTestMode();
    const lifecycleContext = {
      agentName: this.name,
      task,
      context,
      testMode,
      startTs: Date.now()
    };
    const emitLifecycleHook = async (
      hookName: 'BeforeAgent' | 'AfterAgent' | 'agent:before' | 'agent:after' | 'agent:error',
      payload: Record<string, unknown>,
    ): Promise<void> => {
      // 1. Existing HookRegistry (Typed hooks)
      if (hookName === 'BeforeAgent' || hookName === 'AfterAgent') {
        if (isHookEnabled(hookName)) {
          await fireHookSafely(hookName, payload, {
            source: 'BaseAgent.execute',
            logContext: `${this.name} lifecycle hook ${hookName}`,
          });
        }
      }

      // 2. New HookEngine (Generic lifecycle hooks)
      await fireLifecycleHook(hookName, {
        agentName: this.name,
        task: String(payload.task || task),
        ...payload
      });
    };

    await emitLifecycleHook('agent:before', lifecycleContext);
    await emitLifecycleHook('BeforeAgent', lifecycleContext);

    if (!testMode) {
      const patternReuseThreshold = getPatternReuseThreshold();
      const cachedPattern = await (async () => {
        try {
          return await wrapWithSpan(
            'bas-base-agent', `${this.name}::pattern-reuse`,
            { 'bas.agent.name': this.name, 'bas.operation': 'pattern_reuse' },
            async () => checkPattern<AgentResult>(this.name, task),
          );
        } catch (error: unknown) {
          const normalized = ensureError(error);
          logWarn(`${this.name} pattern reuse fallback`, {
            error: normalized,
            threshold: patternReuseThreshold,
          });
          return { matched: false, threshold: patternReuseThreshold };
        }
      })();

      if (cachedPattern.matched && cachedPattern.memory) {
        const cachedResult = this.normalizeCachedResult(cachedPattern.memory.result);
        if (!cachedResult.metadata) {
          cachedResult.metadata = {};
        }
        cachedResult.metadata.confidence = cachedPattern.memory.confidence;
        cachedResult.metadata.fromCache = true;
        cachedResult.metadata.cachedAt = cachedPattern.memory.updatedAt;
        cachedResult.metadata.reuseCount = cachedPattern.memory.reuseCount;

        const formattedMessage = formatAgentResult(cachedResult, this.name, { useEmojis: true });
        const response = guardAgentResponseOutput({
          success: cachedResult.success,
          status: cachedResult.success ? 'success' : 'error',
          message: formattedMessage,
          data: cachedResult.data,
          error: cachedResult.success ? undefined : cachedResult.message,
          handoff: cachedResult.handoff,
        }, this.name);

        await emitLifecycleHook('AfterAgent', {
          ...lifecycleContext,
          outcome: cachedResult.success ? 'success' : 'error',
          cached: true,
          response,
        });

        return response;
      }
    }

    // 1. Kognitív memória lekérdezése végrehajtás előtt (OTel sub-span)
    const pastExperiences = testMode ? [] : await (async () => {
      try {
        return await wrapWithSpan(
          'bas-base-agent', `${this.name}::rag-query`,
          { 'bas.agent.name': this.name, 'bas.operation': 'rag_query' },
          () => this.queryMemory(task, 3),
        );
      } catch (error: unknown) {
        const normalized = ensureError(error);
        logWarn(`${this.name} RAG query fallback: ${normalized.message}`);
        return [];
      }
    })();
    
    let workingMemory = createWorkingMemoryState();
    
    // 1.5. Swarm Context integráció: Ha van raj-történet, azt adjuk hozzá a munkamemóriához
    if (context?.swarm?.history) {
      for (const msg of context.swarm.history) {
        workingMemory = appendWorkingMemoryMessage(workingMemory, {
          role: msg.role,
          content: msg.agent ? `[${msg.agent}] ${msg.content}` : msg.content,
        });
      }
    }

    workingMemory = appendWorkingMemoryMessage(workingMemory, { role: 'user', content: task });
    for (const experience of pastExperiences) {
      workingMemory = appendWorkingMemoryMessage(workingMemory, {
        role: 'system',
        content: experience.text.slice(0, 500),
      });
    }

    const agentContext: AgentContext = {
      task,
      pastExperiences, // Átadjuk az ügynöknek a múltbeli tapasztalatokat
      workingMemory,
      ...(context || {})
    };

    setAgentStatus(this.name, 'working', task.slice(0, 50));

    try {
      const rawResult = await this.executeTask(agentContext);

      // 2. Confidence scoring
      const confidence = calculateConfidence(rawResult);
      if (!rawResult.metadata) rawResult.metadata = {};
      rawResult.metadata.confidence = confidence.score;
      rawResult.metadata.confidenceFactors = confidence.factors;

      const result = guardAgentResultOutput(
        attachWorkingMemoryObservation(rawResult, rawResult.message),
        this.name,
      );

      // 4. Tapasztalat mentése a memóriába (OTel sub-span)
      // Teszt módban kihagyjuk a perzisztens RAG IO-t a stabilitás/gyorsaság miatt.
      if (!testMode) {
        try {
          saveStructuredMemory({
            agentName: this.name,
            task,
            result,
            confidence: confidence.score,
            status: result.success ? 'success' : 'error',
          });
        } catch (error: unknown) {
          const normalized = ensureError(error);
          logWarn(`${this.name} structured memory snapshot fallback`, {
            error: normalized,
            task,
          });
        }

        const outcome = result.success ? 'SIKER' : 'HIBA';
        const experienceContent = `Feladat: "${task}" | Eredmény: ${outcome} | Üzenet: ${result.message}`;
        try {
          await wrapWithSpan(
            'bas-base-agent', `${this.name}::memory-save`,
            { 'bas.agent.name': this.name, 'bas.operation': 'memory_save', 'bas.confidence': confidence.score },
            () => this.saveToMemory(experienceContent, {
              status: result.success ? 'success' : 'error',
              taskId: context?.taskId
            }),
          );
        } catch (error: unknown) {
          const normalized = ensureError(error);
          logWarn(`${this.name} structured memory save fallback`, {
            error: normalized,
            task,
          });
        }
      }

      // Format result as Hungarian human-readable text
      const formattedMessage = formatAgentResult(result, this.name, { useEmojis: true });

      // 5. PII/Secret redakció az output-on
      const response: AgentResponse = {
        success: result.success,
        status: result.success ? 'success' : 'error',
        message: formattedMessage,
        data: result.data,
        error: result.success ? undefined : result.message,
        handoff: result.handoff,
      };

      const guardedResponse = guardAgentResponseOutput(response, this.name);
      await emitLifecycleHook('AfterAgent', {
        ...lifecycleContext,
        outcome: result.success ? 'success' : 'error',
        cached: false,
        response: guardedResponse,
      });
      await emitLifecycleHook('agent:after', {
        ...lifecycleContext,
        result: guardedResponse,
        durationMs: Date.now() - (lifecycleContext as any).startTs || 0
      });
      return guardedResponse;
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(`${this.name} executeTask hiba: ${normalized.message}`, normalized);
      const response = guardAgentResponseOutput({
        success: false,
        status: 'error',
        error: normalized.message,
        message: normalized.message,
      }, this.name);

      await emitLifecycleHook('AfterAgent', {
        ...lifecycleContext,
        outcome: 'error',
        cached: false,
        error: normalized.message,
        response,
      });
      await emitLifecycleHook('agent:error', {
        ...lifecycleContext,
        error: normalized,
        response
      });
      return response;
    } finally {
      setAgentStatus(this.name, 'idle');
    }
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
      const structured = queryStructuredMemory({
        agentName: this.name,
        task: query,
        limit,
      }).map((memory) => this.toStructuredExperience(memory));

      const results = await searchRAG(query, limit);
      const vectorResults = results.map(r => ({ text: r.text, score: r.score }));
      return [...structured, ...vectorResults].slice(0, limit);
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(this.name, 'Memória lekérdezés hiba', normalized);
      return [];
    }
  }

  /**
   * Save an experience to the cognitive memory
   */
  protected async saveToMemory(content: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const memoryContent = `[${this.name}] ${content}`;
    const memoryId = typeof metadata.id === 'string' ? metadata.id : `${this.name.toLowerCase()}_${Date.now()}`;
    
    logInfo(this.name, `Tapasztalat mentése a memóriába: ${memoryId}`);
    try {
      await addToIndex(memoryId, memoryContent);
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError(this.name, 'Memória mentési hiba', normalized);
    }
  }
}

