/**
 * AgentManager - Ügynök Menedzser (Frissítve Edge támogatással)
 * 
 * Változások:
 * - Edge-first delegálás támogatás
 * - Fallback lokális feldolgozásra
 * - ProjectConductor integráció
 * 
 * @author Brunella Core Team
 * @version 2.1.0
 */

import { EventEmitter } from 'events';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { saveTask, updateTaskStatus } from '../utils/tasksDb.js';
import { withRetry, calculateDelay, DEFAULT_RETRY_CONFIG, type RetryConfig } from '../core/retryStrategy.js';
import { saveCheckpoint, loadCheckpoint, clearCheckpoints } from '../core/checkpoint.js';
import { gitAutoCheckpoint, logRecoveryEvent } from '../core/gitRecovery.js';
import { autoSaveGoldenSample } from '../core/goldenDatasetBridge.js';
import { traceAgentExecution, type TraceContext } from '../utils/agentTracer.js';
import { checkToolPermission } from '../tools/toolPermissions.js';
import { record as auditRecord } from '../core/auditLog.js';
import type { IAgent } from './types.js';

// ============================================================================
// INTERFACES
// ============================================================================

interface AgentConfig {
  name: string;
  class: string;
  module: string;
  description: string;
  capabilities: string[];
  priority: number;
  autoStart: boolean;
  systemPrompt?: string;
  triggers?: string[];
  config?: Record<string, unknown>;
}

interface RegistryConfig {
  version: string;
  agents: AgentConfig[];
  defaultAgent: string;
  routingRules: Array<{
    pattern: string;
    agent: string;
  }>;
}

interface EdgeConfig {
  enabled: boolean;
  workerUrl: string;
  tunnelEnabled: boolean;
  fallbackToLocal: boolean;
  healthCheckInterval: number;
}

interface Task {
  id: string;
  instruction: string;
  context?: Record<string, unknown>;
  priority?: number;
  source?: string;
  createdAt: string;
}

interface TaskResult {
  success: boolean;
  message: string;
  data: unknown;
  executedBy?: string;
  executionTime?: number;
}

type AgentRuntimeStatus = 'idle' | 'working' | 'error';

interface AgentRuntimeInfo {
  status: AgentRuntimeStatus;
  lastTaskAt?: string;
  lastTask?: string;
  successCount: number;
  errorCount: number;
}

// ============================================================================
// AGENT MANAGER
// ============================================================================

interface QueuedTask {
  id: number;
  description: string;
  agentName: string;
  context?: Record<string, unknown>;
  parentId?: number;
  createdAt: string;
  startedAt?: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled';
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, IAgent> = new Map();
  private registry: RegistryConfig;
  private edgeConfig: EdgeConfig;
  private edgeProxy?: IAgent; // EdgeProxy agent instance
  private taskQueue: QueuedTask[] = [];
  private taskIdCounter = 0;
  private workerInterval?: ReturnType<typeof setInterval>;
  private agentRuntime: Map<string, AgentRuntimeInfo> = new Map();
  private circuitBreakers: Map<string, { failures: number; lastFailure: number; isOpen: boolean }> = new Map();
  private readonly FAILURE_THRESHOLD = 3;
  private readonly RESET_TIMEOUT = 5 * 60 * 1000; // 5 perc

  constructor() {
    super();
    this.registry = this.loadRegistry();
    this.edgeConfig = this.loadEdgeConfig();
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    logInfo('AgentManager', 'Inicializálás...');

    // Load registry asynchronously if in Node environment
    if (typeof process !== 'undefined' && process.versions?.node) {
      this.registry = await this.loadRegistryAsync();
    }

    // Ügynökök betöltése
    for (const agentConfig of this.registry.agents) {
      try {
        await this.loadAgent(agentConfig);
      } catch (error) {
        logError('AgentManager', `Ügynök betöltési hiba (${agentConfig.name}): ${error}`);
      }
    }

    // Edge proxy inicializálása (ha engedélyezve)
    if (this.edgeConfig.enabled) {
      await this.initializeEdgeProxy();
    }

    // Auto-start ügynökök
    for (const agentConfig of this.registry.agents.filter(a => a.autoStart)) {
      const agent = this.agents.get(agentConfig.name);
      if (agent?.initialize) {
        await agent.initialize();
      }
    }

    logInfo('AgentManager', `${this.agents.size} ügynök betöltve`);
  }

  private async loadAgent(config: AgentConfig): Promise<void> {
    // Dynamic imports for Node.js-specific modules (Worker compatibility)
    if (typeof process === 'undefined' || !process.versions?.node) {
      logError('AgentManager', 'loadAgent() requires Node.js environment');
      return;
    }

    const path = await import('path');
    const fs = await import('fs');

    const modulePath = path.default.resolve(process.cwd(), 'build', config.module.replace('./', ''));

    if (!fs.default.existsSync(modulePath)) {
      logError('AgentManager', `Modul nem található: ${modulePath}`);
      return;
    }

    const AgentClass = (await import(modulePath)).default;
    const agent = new AgentClass(config.config);

    agent.name = config.name;
    agent.description = config.description;
    agent.systemPrompt = config.systemPrompt;

    this.agents.set(config.name, agent);
    this.ensureAgentRuntime(config.name);
    logInfo('AgentManager', `Ügynök betöltve: ${config.name}. Jelenlegi kulcsok: ${[...this.agents.keys()].join(', ')}`);
  }

  private ensureAgentRuntime(agentName: string): AgentRuntimeInfo {
    if (!this.agentRuntime.has(agentName)) {
      this.agentRuntime.set(agentName, {
        status: 'idle',
        successCount: 0,
        errorCount: 0
      });
    }
    return this.agentRuntime.get(agentName)!;
  }

  private updateAgentRuntime(agentName: string, updates: Partial<AgentRuntimeInfo>) {
    const current = this.ensureAgentRuntime(agentName);
    this.agentRuntime.set(agentName, { ...current, ...updates });
  }

  private async initializeEdgeProxy(): Promise<void> {
    const edgeProxyConfig = this.registry.agents.find(a => a.name === 'EdgeProxy');
    if (edgeProxyConfig) {
      this.edgeProxy = this.agents.get('EdgeProxy');
      if (this.edgeProxy?.initialize) {
        await this.edgeProxy.initialize();
        logInfo('AgentManager', 'EdgeProxy inicializálva');
      }
    }
  }

  // --------------------------------------------------------------------------
  // TASK DELEGATION
  // --------------------------------------------------------------------------

  /**
   * Feladat delegálása - Edge-first stratégia
   */
  async delegateTask(task: Task): Promise<TaskResult> {
    const startTime = Date.now();

    logInfo('AgentManager', `Task delegálás: ${task.instruction.slice(0, 50)}...`);

    // 1. Edge-first stratégia (ha engedélyezve és elérhető)
    if (this.edgeConfig.enabled && this.edgeProxy?.isEdgeHealthy?.()) {
      try {
        logInfo('AgentManager', 'Edge delegálás...');
        const edgeResult = await this.delegateToEdge(task);

        if (edgeResult.success) {
          return {
            ...edgeResult,
            executedBy: 'edge',
            executionTime: Date.now() - startTime
          };
        }

        // Edge sikertelen, de fallback engedélyezve
        if (this.edgeConfig.fallbackToLocal) {
          logInfo('AgentManager', 'Edge sikertelen, lokális fallback...');
        } else {
          return edgeResult;
        }
      } catch (error) {
        logError('AgentManager', `Edge hiba: ${error}`);

        if (!this.edgeConfig.fallbackToLocal) {
          return {
            success: false,
            message: `Edge hiba: ${error}`,
            data: null,
            executedBy: 'edge',
            executionTime: Date.now() - startTime
          };
        }
      }
    }

    // 2. Lokális delegálás
    return await this.delegateLocally(task, startTime);
  }

  /**
   * Edge delegálás
   */
  private async delegateToEdge(task: Task): Promise<TaskResult> {
    if (!this.edgeProxy) {
      return {
        success: false,
        message: 'EdgeProxy nem elérhető',
        data: null
      };
    }

    const result = await this.edgeProxy.execute(`submit ${task.instruction}`, task.context);

    // Cast result to TaskResult (since execute returns unknown)
    return (typeof result === 'object' && result !== null ? result : { success: true, data: result, message: 'Edge execution completed' }) as TaskResult;
  }

  /**
   * Lokális delegálás
   */
  private async delegateLocally(task: Task, startTime: number): Promise<TaskResult> {
    const targetAgent = this.routeTask(task.instruction);

    if (!targetAgent) {
      return {
        success: false,
        message: 'Nem található megfelelő ügynök',
        data: null,
        executionTime: Date.now() - startTime
      };
    }

    const result = await this.executeAgentWithRetry(targetAgent, task.instruction, task.context);

    return {
      ...result,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Ügynök végrehajtása retry logikával és Circuit Breaker-rel
   */
  private async executeAgentWithRetry(agentName: string, instruction: string, context?: Record<string, unknown>, retries = 2, parentTraceContext?: TraceContext): Promise<TaskResult> {
    const cb = this.getCircuitBreaker(agentName);

    // RULE-OB1: Start trace span for this agent execution
    const trace = traceAgentExecution(agentName, instruction, parentTraceContext);

    // RULE-AU1: Permission check before execution
    const permCheck = checkToolPermission('agent_delegate', { agentName });
    if (!permCheck.allowed) {
      // RULE-AU2: DENIED → audit log + error return
      await auditRecord('DENIED', agentName, 'execute', instruction.slice(0, 100), permCheck.reason);
      trace.end('error', `PERMISSION_DENIED: ${permCheck.reason}`);
      return {
        success: false,
        message: `PERMISSION_DENIED: ${permCheck.reason}`,
        data: null,
        executedBy: agentName
      };
    }
    await auditRecord('ALLOWED', agentName, 'execute', instruction.slice(0, 100));

    // Circuit Breaker ellenőrzése
    if (cb.isOpen) {
      const remaining = this.RESET_TIMEOUT - (Date.now() - cb.lastFailure);
      if (remaining > 0) {
        logError('AgentManager', `Circuit Breaker NYITVA (${agentName}). Hátralévő idő: ${Math.round(remaining / 1000)}s`);
        trace.end('error', `Circuit Breaker OPEN (${agentName})`);
        return {
          success: false,
          message: `Ügynök ideiglenesen letiltva (Circuit Breaker): ${agentName}`,
          data: null
        };
      } else {
        // Timeout lejárt, próbálkozunk (Half-open állapot szimulálva)
        cb.isOpen = false;
        cb.failures = 0;
        logInfo('AgentManager', `Circuit Breaker VISSZAÁLLÍTVA (${agentName})`);
      }
    }

    const agent = this.agents.get(agentName);
    if (!agent) {
      trace.end('error', `Agent not found: ${agentName}`);
      return {
        success: false,
        message: `Ügynök nem található: ${agentName}`,
        data: null,
        executedBy: agentName
      };
    }

    const retryConfig: Partial<RetryConfig> = {
      maxRetries: retries,
      onRetry: (attempt, delay, error) => {
        logInfo('AgentManager', `Újrapróbálkozás (${agentName})... ${attempt}/${retries} — ${delay}ms várakozás`);
        this.emit('gold:retry_attempt', { taskId: instruction.slice(0, 50), attempt, delay, agent: agentName });
        cb.failures++;
        cb.lastFailure = Date.now();
        if (cb.failures >= this.FAILURE_THRESHOLD) {
          cb.isOpen = true;
          logError('AgentManager', `Circuit Breaker TRIPPED (${agentName})!`);
        }
      }
    };

    try {
      const result = await withRetry(
        async () => {
          // Circuit breaker check inside retry loop
          if (cb.isOpen) {
            throw new Error(`Circuit Breaker OPEN for ${agentName}`);
          }

          this.updateAgentRuntime(agentName, {
            status: 'working',
            lastTask: instruction,
            lastTaskAt: new Date().toISOString()
          });
          setAgentStatus(agentName, 'working', instruction);

          let res = await agent.execute(instruction, context);

          // Result normalizálás (status -> success mapping)
          if (typeof res === 'object' && res !== null) {
            const resObj = res as Record<string, unknown>;
            if (resObj['success'] === undefined) {
              resObj['success'] = resObj['status'] === 'success' || resObj['status'] === 'ok';
            }
            return resObj as unknown as TaskResult;
          } else {
            return { success: true, data: res, message: 'Végrehajtva' } as TaskResult;
          }
        },
        `${agentName}:execute`,
        retryConfig
      );

      // Success — reset circuit breaker & update runtime
      cb.failures = 0;
      cb.isOpen = false;

      const runtime = this.ensureAgentRuntime(agentName);
      this.updateAgentRuntime(agentName, {
        status: 'idle',
        lastTaskAt: new Date().toISOString(),
        successCount: runtime.successCount + 1
      });
      setAgentStatus(agentName, 'idle', instruction);

      // RULE-PH1: checkpoint on success
      await saveCheckpoint(
        instruction.slice(0, 100),
        0,
        `${agentName}:success`,
        { agent: agentName, resultPreview: JSON.stringify(result).slice(0, 500) }
      ).catch(() => { /* non-critical */ });

      // RULE-GD1: Auto-save golden sample on success
      await autoSaveGoldenSample(agentName, instruction, result).catch(() => { /* non-critical */ });

      // RULE-OB1: End trace span on success
      trace.end('success');

      return result;
    } catch (lastError: any) {
      logError('AgentManager', `Végrehajtási hiba több próbálkozás után (${agentName}): ${lastError?.message || 'Ismeretlen hiba'}`);

      // RULE-PH4: Git auto-checkpoint after all retries exhausted
      await gitAutoCheckpoint(agentName, lastError?.message || 'Unknown error').catch((e: any) =>
        logError('AgentManager', `Git recovery failed: ${e.message}`)
      );
      logRecoveryEvent('crash', agentName, lastError?.message || 'All retries exhausted');

      // RULE-OB1: End trace span on error
      trace.end('error', lastError?.message || 'All retries exhausted');

      const runtime = this.ensureAgentRuntime(agentName);
      this.updateAgentRuntime(agentName, {
        status: 'error',
        lastTaskAt: new Date().toISOString(),
        errorCount: runtime.errorCount + 1
      });
      setAgentStatus(agentName, 'error', instruction);

      return {
        success: false,
        message: `Végrehajtási hiba több próbálkozás után (${agentName}): ${lastError?.message || 'Ismeretlen hiba'}`,
        data: null,
        executedBy: agentName
      };
    }
  }

  private getCircuitBreaker(agentName: string) {
    if (!this.circuitBreakers.has(agentName)) {
      this.circuitBreakers.set(agentName, { failures: 0, lastFailure: 0, isOpen: false });
    }
    return this.circuitBreakers.get(agentName)!;
  }

  /**
   * Task routing a szabályok alapján
   */
  private routeTask(instruction: string): string | null {
    const lowerInstruction = instruction.toLowerCase();

    // Routing szabályok ellenőrzése
    for (const rule of this.registry.routingRules) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(lowerInstruction)) {
        return rule.agent;
      }
    }

    // Ügynök trigger-ek ellenőrzése
    for (const agentConfig of this.registry.agents) {
      if (agentConfig.triggers) {
        for (const trigger of agentConfig.triggers) {
          if (lowerInstruction.includes(trigger.toLowerCase())) {
            return agentConfig.name;
          }
        }
      }
    }

    // Default ügynök
    return this.registry.defaultAgent;
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  /**
   * Ügynök lekérdezése név alapján
   */
  getAgent(name: string): IAgent | null {
    return this.agents.get(name) || null;
  }

  /**
   * Összes ügynök listázása
   */
  listAgents(): Array<{ name: string; description: string; status: string }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => {
      const runtime = this.ensureAgentRuntime(name);
      return {
        name,
        description: agent.description || '',
        status: runtime.status
      };
    });
  }

  listAgentStatuses(): Array<{ name: string; description: string; status: AgentRuntimeStatus; lastTaskAt?: string; successCount: number; errorCount: number; lastTask?: string }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => {
      const runtime = this.ensureAgentRuntime(name);
      return {
        name,
        description: agent.description || '',
        status: runtime.status,
        lastTaskAt: runtime.lastTaskAt,
        successCount: runtime.successCount,
        errorCount: runtime.errorCount,
        lastTask: runtime.lastTask
      };
    });
  }

  /**
   * Ügynök definíciók listázása (név, leírás, szerepkör) – Orchestrator delegáláshoz
   */
  listAgentDefinitions(): Array<{ name: string; description: string; role?: string }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      description: agent.description || '',
      role: agent.role || ''
    }));
  }

  /**
   * Edge konfiguráció frissítése
   */
  updateEdgeConfig(config: Partial<EdgeConfig>): void {
    this.edgeConfig = { ...this.edgeConfig, ...config };
    logInfo('AgentManager', 'Edge konfiguráció frissítve');
  }

  /**
   * Edge állapot lekérdezése
   */
  getEdgeStatus(): { enabled: boolean; healthy: boolean; tunnelConnected: boolean } {
    return {
      enabled: this.edgeConfig.enabled,
      healthy: this.edgeProxy?.isEdgeHealthy?.() || false,
      tunnelConnected: this.edgeProxy?.isTunnelConnected?.() || false
    };
  }

  // --------------------------------------------------------------------------
  // COMPATIBILITY API (registry, web, Orchestrator)
  // --------------------------------------------------------------------------

  /** Manuális ügynök regisztráció (registry.ts) */
  registerAgent(agent: { name: string; description?: string; role?: string; capabilities?: string[]; execute: (task: string, context?: Record<string, unknown>) => Promise<unknown> }): void {
    const fullAgent: IAgent = {
      name: agent.name,
      role: agent.role || 'custom',
      description: agent.description || '',
      capabilities: agent.capabilities || [],
      execute: agent.execute
    };
    this.agents.set(agent.name, fullAgent);
    this.ensureAgentRuntime(agent.name);
    logInfo('AgentManager', `Ügynök regisztrálva: ${agent.name}`);
  }

  /** Delegálás név + feladat alapján (registry, web) */
  async delegate(agentName: string, task: string, context?: Record<string, unknown>): Promise<unknown> {
    logInfo('AgentManager', `[DELEGATE] Kérés érkezett a '${agentName}' ügynökhöz.`);

    // HOTFIX: If the agent is Orchestrator, we must create AND execute the plan.
    if (agentName.toLowerCase() === 'orchestrator') {
      logInfo('AgentManager', 'Orchestrator delegation detected. Running full plan-and-execute cycle.');
      try {
        const plan = await this.createPlan(task);
        if (!plan || plan.taskIds.length === 0) {
          return { success: true, message: "A terv nem tartalmazott végrehajtható lépéseket." };
        }

        const noOpEmit = (event: string, data: any) => { };
        const finalResult = await this.executePlan(plan, noOpEmit);

        return { success: true, message: "A terv végrehajtása befejeződött.", data: finalResult };
      } catch (e: any) {
        logError('AgentManager', `Orchestrator plan/execute hiba: ${e.message}`);
        throw e;
      }
    }

    const lowerAgentName = agentName.toLowerCase();
    logInfo('AgentManager', `[DELEGATE] Keresés: '${agentName}' (${lowerAgentName}). Regisztrált: ${[...this.agents.keys()].join(', ')}`);

    // Case-insensitive lookup in Map
    let agent: IAgent | undefined = undefined;
    for (const [name, a] of this.agents.entries()) {
      if (name.toLowerCase() === lowerAgentName) {
        agent = a;
        break;
      }
    }

    if (!agent) {
      logError('AgentManager', `[DELEGATE] Az ügynök ('${agentName}') NEM TALÁLHATÓ a map-ben (Még kisbetűsítve sem). Jelenlegi ügynökök: ${[...this.agents.keys()].join(', ')}. Fallback to dynamic routing.`);
      const result = await this.delegateTask({
        id: `delegate-${Date.now()}`,
        instruction: task,
        context,
        createdAt: new Date().toISOString()
      });

      logInfo('AgentManager', `[DELEGATE] Dynamic routing eredménye: success=${result.success}, detail: ${JSON.stringify(result).slice(0, 100)}`);

      if (result.success) {
        return result;
      }
      throw new Error(result.message || 'Delegation failed');
    }

    logInfo('AgentManager', `[DELEGATE] Az ügynök ('${lowerAgentName}') MEGTALÁLVA. Közvetlen végrehajtás...`);

    // Save to DB for tracking
    const dbId = await saveTask({
      agent: agentName,
      task,
      context: context ? JSON.stringify(context) : undefined
    });

    try {
      const out = await this.executeAgentWithRetry(agentName, task, context);

      if (dbId) {
        const resultStr = typeof out === 'object' ? JSON.stringify(out) : String(out);
        await updateTaskStatus(dbId, 'done', resultStr);
      }

      return out;
    } catch (e: any) {
      if (dbId) await updateTaskStatus(dbId, 'error', e.message);
      throw e;
    }
  }

  /** Feladat betétele a sorba (Orchestrator, web) */
  async queueTask(description: string, agentName: string, context?: Record<string, any>, parentId?: number): Promise<number> {
    const contextStr = context ? JSON.stringify(context) : undefined;
    const dbId = await saveTask({
      agent: agentName,
      task: description,
      context: contextStr
    });

    const id = Number(dbId) || ++this.taskIdCounter;
    this.taskQueue.push({
      id,
      description,
      agentName,
      context,
      parentId,
      createdAt: new Date().toISOString(),
      status: 'pending'
    });
    return id;
  }

  /** Összes feladat a sorból */
  getAllTasks(): QueuedTask[] {
    return [...this.taskQueue];
  }

  /** Egy pending feladat azonnali feldolgozása */
  async processPendingTasks(): Promise<{ taskId?: number; status: string; message?: string } | null> {
    const pending = this.taskQueue.find(t => t.status === 'pending');
    if (!pending) return null;

    pending.status = 'running';
    pending.startedAt = new Date().toISOString();
    await updateTaskStatus(pending.id, 'running');

    try {
      const result = await this.executeAgentWithRetry(pending.agentName, pending.description, pending.context);
      pending.status = result.success ? 'done' : 'error';
      const resultStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
      await updateTaskStatus(pending.id, pending.status, resultStr);
      return { taskId: pending.id, status: pending.status, message: result.message };
    } catch (e: any) {
      pending.status = 'error';
      await updateTaskStatus(pending.id, 'error', e.message);
      return { taskId: pending.id, status: 'error', message: e.message };
    }
  }

  async cancelTask(taskId: number): Promise<boolean> {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (!task) return false;
    task.status = 'cancelled';
    await updateTaskStatus(taskId, 'cancelled', 'Cancelled by user');
    return true;
  }

  async retryTask(taskId: number): Promise<boolean> {
    const task = this.taskQueue.find(t => t.id === taskId);
    if (!task) return false;
    task.status = 'pending';
    task.startedAt = undefined;
    await updateTaskStatus(taskId, 'pending');
    return true;
  }

  /** Registry definíciók (alias listAgentDefinitions) */
  listRegistryDefinitions(): Array<{ name: string; description: string; role?: string }> {
    return this.listAgentDefinitions();
  }

  /** Teljes registry (capabilities, priority, autoStart, stb.) – dashboardhoz */
  getRegistry(): RegistryConfig {
    return { ...this.registry };
  }

  /** Worker loop indítása – sor feldolgozás */
  startWorkerLoop(): void {
    if (this.workerInterval) return;
    this.workerInterval = setInterval(async () => {
      const pending = this.taskQueue.find(t => t.status === 'pending');
      if (!pending) return;
      pending.status = 'running';
      await updateTaskStatus(pending.id, 'running');
      try {
        const result = await this.executeAgentWithRetry(pending.agentName, pending.description, pending.context);

        pending.status = result.success ? 'done' : 'error';
        const resultStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
        await updateTaskStatus(pending.id, pending.status, resultStr);

        if (result.success) {
          this.emit('task_done', { task: pending, result });
        } else {
          logError('AgentManager', `Task ${pending.id} failed: ${result.message}`);
        }
      } catch (e: any) {
        pending.status = 'error';
        await updateTaskStatus(pending.id, 'error', e.message);
        logError('AgentManager', `Task ${pending.id} error: ${e.message}`);
      }
    }, 2000);
    logInfo('AgentManager', 'Worker loop started');
  }

  /** Worker loop leállítása graceful shutdown-hoz */
  stopWorkerLoop(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = undefined;
      logInfo('AgentManager', 'Worker loop stopped');
    }
  }

  /** Terv készítése (Orchestrator hívás) */
  async createPlan(userMessage: string): Promise<{ taskIds: number[]; taskDescriptions?: string[] }> {
    const orchestrator = this.agents.get('Orchestrator');
    if (!orchestrator) return { taskIds: [], taskDescriptions: [] };
    const out = await orchestrator.execute(userMessage);
    
    // Type guard for orchestrator output
    if (typeof out === 'object' && out !== null) {
      const outObj = out as Record<string, unknown>;
      const taskIds = Array.isArray(outObj['taskIds']) ? outObj['taskIds'] as number[] : [];
      return { taskIds, taskDescriptions: [] };
    }
    
    return { taskIds: [], taskDescriptions: [] };
  }

  /** Terv végrehajtása */
  async executePlan(plan: { taskIds: number[] }, emit: (event: string, data: unknown) => void): Promise<string> {
    const parts: string[] = [];
    for (const id of plan.taskIds) {
      const t = this.taskQueue.find(q => q.id === id);
      if (!t || t.status !== 'pending') continue;
      emit('task_start', { id, description: t.description, agentName: t.agentName });
      try {
        const result = await this.executeAgentWithRetry(t.agentName, t.description, t.context);

        if (result.success) {
          t.status = 'done';
          const text = typeof result === 'object' ? JSON.stringify(result) : String(result);
          parts.push(`[${t.agentName}]: ${text}`);
          emit('task_done', { id, result });
        } else {
          t.status = 'error';
          parts.push(`[${t.agentName}]: Error: ${result.message}`);
          emit('task_error', { id, error: result.message });
        }
      } catch (e: any) {
        t.status = 'error';
        parts.push(`[${t.agentName}]: Exception: ${e.message}`);
        emit('task_error', { id, error: e.message });
      }
    }
    return parts.join('\n\n');
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION LOADERS
  // --------------------------------------------------------------------------

  private async loadRegistryAsync(): Promise<RegistryConfig> {
    // Dynamic imports for Node.js-specific modules (Worker compatibility)
    if (typeof process === 'undefined' || !process.versions?.node) {
      // Fallback for Worker environments
      return {
        version: '1.0.0',
        agents: [],
        defaultAgent: 'Orchestrator',
        routingRules: []
      };
    }

    try {
      // Use async dynamic imports
      const path = await import('path');
      const fs = await import('fs');

      const registryPath = path.default.resolve(process.cwd(), 'build', 'agents', 'registry.json');

      if (fs.default.existsSync(registryPath)) {
        const content = fs.default.readFileSync(registryPath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      logError('AgentManager', `Registry load failed: ${e}`);
    }

    // Fallback
    return {
      version: '1.0.0',
      agents: [],
      defaultAgent: 'Orchestrator',
      routingRules: []
    };
  }

  private loadRegistry(): RegistryConfig {
    // Note: This is called from constructor, which cannot be async
    // So we use a simplified version here and rely on the registry being optional
    return {
      version: '1.0.0',
      agents: [],
      defaultAgent: 'Orchestrator',
      routingRules: []
    };
  }

  private loadEdgeConfig(): EdgeConfig {
    return {
      enabled: process.env.EDGE_ENABLED === 'true',
      workerUrl: process.env.CLOUDFLARE_WORKER_URL || 'https://bas-orchestrator.workers.dev',
      tunnelEnabled: process.env.CLOUDFLARE_TUNNEL_ENABLED === 'true',
      fallbackToLocal: process.env.EDGE_FALLBACK_TO_LOCAL !== 'false',
      healthCheckInterval: parseInt(process.env.EDGE_HEALTH_CHECK_INTERVAL || '30000')
    };
  }
}

export const agentManager = new AgentManager();
export default AgentManager;
