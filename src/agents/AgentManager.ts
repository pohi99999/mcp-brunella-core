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
import * as fs from 'fs';
import * as path from 'path';
import { traceable } from 'langsmith/traceable';
import { logInfo, logError, setAgentStatus } from '../utils/logger.js';

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
  config?: Record<string, any>;
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
  context?: Record<string, any>;
  priority?: number;
  source?: string;
  createdAt: string;
}

interface TaskResult {
  success: boolean;
  message: string;
  data: any;
  executedBy?: string;
  executionTime?: number;
  thoughts?: string;
  contextUsed?: string[];
}

// ============================================================================
// AGENT MANAGER
// ============================================================================

interface QueuedTask {
  id: number;
  description: string;
  agentName: string;
  context?: Record<string, any>;
  parentId?: number;
  createdAt: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export class AgentManager extends EventEmitter {
  private agents: Map<string, any> = new Map();
  private registry: RegistryConfig;
  private edgeConfig: EdgeConfig;
  private edgeProxy?: any; // EdgeProxyAgent instance
  private taskQueue: QueuedTask[] = [];
  private taskIdCounter = 0;
  private workerInterval?: ReturnType<typeof setInterval>;

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
    const modulePath = path.resolve(process.cwd(), 'build', config.module.replace('./', ''));

    if (!fs.existsSync(modulePath)) {
      logError('AgentManager', `Modul nem található: ${modulePath}`);
      return;
    }

    const AgentClass = (await import(modulePath)).default;
    const agent = new AgentClass(config.config);

    agent.name = config.name;
    agent.description = config.description;
    agent.systemPrompt = config.systemPrompt;

    this.agents.set(config.name, agent);
    logInfo('AgentManager', `Ügynök betöltve: ${config.name}`);
  }

  async createAgent(config: any): Promise<boolean> {
    try {
      const { name, role, description, capabilities, triggers } = config;
      const className = `${name.charAt(0).toUpperCase()}${name.slice(1)}Agent`;
      const fileName = `${className}.ts`;
      const filePath = path.resolve(process.cwd(), 'src', 'agents', fileName);

      // 1. Generáljuk a TypeScript fájlt
      const template = `
import { BaseAgent, AgentContext, AgentResult } from './BaseAgent.js';
import { logInfo } from '../utils/logger.js';

export class ${className} extends BaseAgent {
  name = '${name.toLowerCase()}';
  role = '${role}';
  description = '${description}';
  capabilities = ${JSON.stringify(capabilities)};

  async executeTask(context: AgentContext): Promise<AgentResult> {
    logInfo('${className}', \`Végrehajtás: \${context.task}\`);
    return {
      success: true,
      message: \`A(z) ${name} ügynök sikeresen megkapta a feladatot: \${context.task}\`,
      thoughts: 'Dinamikusan generált ügynök válasza.'
    };
  }
}

export default ${className};
`;
      fs.writeFileSync(filePath, template.trim());

      // 2. Frissítsük a registry.json-t
      const registryPath = path.resolve(process.cwd(), 'src', 'agents', 'registry.json');
      const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

      const newAgentConfig = {
        name: name.toLowerCase(),
        title: `${name} Agent`,
        description,
        class: className,
        module: `./agents/${className}`,
        capabilities,
        triggers: triggers || [],
        category: "custom",
        status: "active",
        autoStart: true,
        priority: 5
      };

      registry.agents.push(newAgentConfig);
      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

      logInfo('AgentManager', `Új ügynök létrehozva: ${name}`);
      return true;
    } catch (error) {
      logError('AgentManager', `Ügynök létrehozási hiba: ${error}`);
      return false;
    }
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

    return result;
  }

  /**
   * Lokális delegálás
   */
  /**
   * Lokális delegálás - Swarm Loop Implementáció
   */
  private async delegateLocally(task: Task, startTime: number): Promise<TaskResult> {
    let currentAgentName = this.routeTask(task.instruction);
    let currentInstruction = task.instruction;
    let iterations = 0;
    const maxIterations = 10; // Végtelen ciklus védelem

    // Swarm Context Inicializálás
    const swarmContext: any = {
      sessionId: task.id,
      history: [],
      artifacts: {},
      activeAgent: currentAgentName
    };

    // --- SWARM LOOP ---
    while (iterations < maxIterations) {
      iterations++;

      if (!currentAgentName) {
        return {
          success: false,
          message: 'Nem található megfelelő ügynök a Swarm Loop-ban',
          data: null,
          executionTime: Date.now() - startTime
        };
      }

      swarmContext.activeAgent = currentAgentName;
      const agent = this.agents.get(currentAgentName);

      if (!agent) {
        return {
          success: false,
          message: `Ügynök nem betöltve: ${currentAgentName}`,
          data: null,
          executionTime: Date.now() - startTime
        };
      }

      try {
        setAgentStatus(currentAgentName, 'working', currentInstruction);
        logInfo('AgentManager', `[Swarm] ${currentAgentName} executing: "${currentInstruction.slice(0, 50)}..."`);

        // Execute Agent — egységes IAgent-kompatibilis hívás, LangSmith traced
        const tracedExecute = traceable(
          async (instruction: string, ctx: any) => agent.execute(instruction, ctx),
          { name: `Agent_${currentAgentName}`, run_type: "chain" }
        );
        const result = await tracedExecute(currentInstruction, {
          swarm: swarmContext,
          ...task.context
        });

        // --- HANDOFF CHECK ---
        if (result && result.handoff && result.handoff.type === 'handoff') {
          const handoff = result.handoff;
          logInfo('AgentManager', `[Swarm] HANDOFF from ${currentAgentName} -> ${handoff.targetAgent}. Reason: ${handoff.reason}`);

          // Context update
          swarmContext.history.push({
            role: 'assistant',
            agent: currentAgentName,
            content: `[Handoff to ${handoff.targetAgent}]: ${handoff.reason}`
          });

          // Next iteration setup
          currentAgentName = handoff.targetAgent;
          currentInstruction = handoff.instruction;
          continue; // Jump to next iteration
        }

        // --- SUCCESS (No Handoff) ---
        return {
          success: true,
          message: result.message || 'Task completed',
          data: result.data || result,
          thoughts: result.thoughts,
          contextUsed: result.contextUsed,
          executedBy: currentAgentName, // The LAST agent responsible
          executionTime: Date.now() - startTime
        };

      } catch (error) {
        logError('AgentManager', `Ügynök hiba (${currentAgentName}): ${error}`);
        return {
          success: false,
          message: `Végrehajtási hiba: ${error}`,
          data: null,
          executedBy: currentAgentName ?? undefined,
          executionTime: Date.now() - startTime
        };
      } finally {
        setAgentStatus(currentAgentName!, 'idle'); // ! mert a loop elején ellenőrizzük
      }
    }

    // Max iterations reached
    return {
      success: false,
      message: `Swarm Loop limit (${maxIterations}) elérve.`,
      data: null,
      executionTime: Date.now() - startTime
    };
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
  getAgent(name: string): any | null {
    return this.agents.get(name) || null;
  }

  /**
   * Összes ügynök listázása
   */
  listAgents(): Array<{ name: string; description: string; status: string }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      description: agent.description || '',
      status: 'loaded'
    }));
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

  /**
   * Ügynök képességek frissítése (futásidőben)
   */
  async updateAgentCapabilities(agentName: string, capabilities: string[]): Promise<boolean> {
    const agent = this.agents.get(agentName);
    if (!agent) return false;

    // Memória frissítés
    agent.capabilities = capabilities;

    // Registry config frissítése (hogy perzisztens legyen a következő újraindításig, ha mentenénk fájlba)
    const registryAgent = this.registry.agents.find(a => a.name === agentName);
    if (registryAgent) {
      registryAgent.capabilities = capabilities;
      // Opcionális: Itt lehetne menteni a registry.json-t fájlrendszerbe is a 'fs' modullal
      await this.saveRegistryToDisk();
    }

    logInfo('AgentManager', `Capabilities updated for ${agentName}: ${capabilities.join(', ')}`);
    return true;
  }

  private async saveRegistryToDisk(): Promise<void> {
    const registryPath = path.resolve(process.cwd(), 'build', 'agents', 'registry.json');
    // Save to source as well if possible for dev mode persistence? 
    // For now, let's just save to the runtime build path.
    try {
      fs.writeFileSync(registryPath, JSON.stringify(this.registry, null, 2), 'utf-8');
    } catch (e) {
      logError('AgentManager', `Failed to save registry: ${e}`);
    }
  }

  // --------------------------------------------------------------------------
  // COMPATIBILITY API (registry, web, Orchestrator)
  // --------------------------------------------------------------------------

  /** Manuális ügynök regisztráció (registry.ts) */
  registerAgent(agent: { name: string; description?: string; role?: string; execute: (task: string, context?: any) => Promise<any> }): void {
    this.agents.set(agent.name, agent);
    logInfo('AgentManager', `Ügynök regisztrálva: ${agent.name}`);
  }

  /** Delegálás név + feladat alapján (registry, web) */
  async delegate(agentName: string, task: string, context?: Record<string, any>): Promise<any> {
    const agent = this.agents.get(agentName);
    if (!agent) {
      const result = await this.delegateTask({
        id: `delegate-${Date.now()}`,
        instruction: task,
        context,
        createdAt: new Date().toISOString()
      });
      if (result.success && result.data !== undefined) return result.data;
      if (result.success) return result.message ?? 'OK';
      throw new Error(result.message || 'Delegation failed');
    }
    try {
      setAgentStatus(agentName, 'working', task);
      const tracedExecute = traceable(
        async (t: string, ctx: any) => agent.execute(t, ctx),
        { name: `Delegate_${agentName}`, run_type: "chain" }
      );
      const out = await tracedExecute(task, context);
      setAgentStatus(agentName, 'idle');
      return typeof out === 'object' ? JSON.stringify(out) : String(out);
    } catch (e: any) {
      setAgentStatus(agentName, 'idle');
      throw e;
    }
  }

  /** Feladat betétele a sorba (Orchestrator, web) */
  queueTask(description: string, agentName: string, context?: Record<string, any>, parentId?: number): number {
    const id = ++this.taskIdCounter;
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
      try {
        const agent = this.agents.get(pending.agentName);
        if (agent) {
          const tracedExec = traceable(
            async (desc: string, ctx: any) => agent.execute(desc, ctx),
            { name: `Worker_${pending.agentName}`, run_type: "chain" }
          );
          const result = await tracedExec(pending.description, pending.context);
          pending.status = 'done';
          this.emit('task_done', { task: pending, result });
        } else {
          pending.status = 'error';
        }
      } catch (e) {
        pending.status = 'error';
        logError('AgentManager', `Task ${pending.id} error: ${e}`);
      }
    }, 2000);
    logInfo('AgentManager', 'Worker loop started');
  }

  /** Terv készítése (Orchestrator hívás) */
  async createPlan(userMessage: string, options?: { model?: string; provider?: string }): Promise<{ taskIds: number[] }> {
    const orchestrator = this.agents.get('Orchestrator');
    if (!orchestrator) return { taskIds: [] };
    const tracedPlan = traceable(
      async (msg: string, ctx: any) => orchestrator.execute(msg, ctx),
      { name: "Orchestrator_CreatePlan", run_type: "chain" }
    );
    const out = await tracedPlan(userMessage, options);
    const taskIds = Array.isArray(out?.taskIds) ? out.taskIds : [];
    return { taskIds };
  }

  /** Terv végrehajtása */
  async executePlan(plan: { taskIds: number[] }, emit: (event: string, data: any) => void): Promise<string> {
    const parts: string[] = [];
    for (const id of plan.taskIds) {
      const t = this.taskQueue.find(q => q.id === id);
      if (!t || t.status !== 'pending') continue;
      emit('task_start', { id, description: t.description, agentName: t.agentName });
      try {
        const agent = this.agents.get(t.agentName);
        if (agent) {
          const tracedExec = traceable(
            async (desc: string, ctx: any) => agent.execute(desc, ctx),
            { name: `Plan_${t.agentName}`, run_type: "chain" }
          );
          const result = await tracedExec(t.description, t.context);
          t.status = 'done';
          const text = typeof result === 'object' ? JSON.stringify(result) : String(result);
          parts.push(`[${t.agentName}]: ${text}`);
          emit('task_done', { id, result });
        }
      } catch (e: any) {
        t.status = 'error';
        parts.push(`[${t.agentName}]: Error: ${e.message}`);
        emit('task_error', { id, error: e.message });
      }
    }
    return parts.join('\n\n');
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION LOADERS
  // --------------------------------------------------------------------------

  private loadRegistry(): RegistryConfig {
    const registryPath = path.resolve(process.cwd(), 'build', 'agents', 'registry.json');

    if (fs.existsSync(registryPath)) {
      return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    }

    // Fallback
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
