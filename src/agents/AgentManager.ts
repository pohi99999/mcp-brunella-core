import { logInfo, logError, setAgentStatus } from '../utils/logger.js';
import { AgentResult } from './BaseAgent.js';
import { IAgent, ISwarmContext, AgentHandoff, AgentResponse } from './types.js';

interface RegistryConfig {
  version: string;
  agents: Array<{
    name: string;
    path: string;
    description?: string;
    role?: string;
    capabilities?: string[];
    priority?: number;
    autoStart?: boolean;
    triggers?: string[];
  }>;
  defaultAgent: string;
  routingRules: Array<{ pattern: string; agent: string }>;
}

interface EdgeConfig {
  enabled: boolean;
  workerUrl: string;
  tunnelEnabled: boolean;
  fallbackToLocal: boolean;
  healthCheckInterval: number;
}

interface QueuedTask {
  id: number;
  description: string;
  agentName: string;
  context?: any;
  parentId?: number;
  status: 'pending' | 'running' | 'done' | 'error';
  createdAt: string;
}

// Simple EventEmitter polyfill for Worker compatibility
class SimpleEventEmitter {
    private listeners: Record<string, Function[]> = {};

    on(event: string, listener: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(listener);
        return this;
    }

    emit(event: string, ...args: any[]) {
        if (!this.listeners[event]) return false;
        this.listeners[event].forEach(listener => listener(...args));
        return true;
    }
}

// Use native EventEmitter if available (Node), otherwise fallback
// This avoids bundling 'events' module for Workers if not needed
let EventEmitterClass: any = SimpleEventEmitter;
if (typeof process !== 'undefined' && process.versions?.node) {
    try {
        // Dynamic require/import to avoid static analysis
        const req = typeof require !== 'undefined' ? require : null;
        if (req) {
             EventEmitterClass = req('events').EventEmitter;
        }
    } catch {
        // Fallback to SimpleEventEmitter
    }
}

export class AgentManager extends EventEmitterClass {
  private registry: RegistryConfig;
  private agents: Map<string, any> = new Map();
  private edgeConfig: EdgeConfig;
  private taskQueue: QueuedTask[] = [];
  private taskIdCounter = 0;
  private workerInterval?: NodeJS.Timeout;

  // EdgeProxy instance (dynamically loaded)
  private edgeProxy?: any;

  constructor() {
    super();
    this.registry = this.loadRegistry();
    this.edgeConfig = this.loadEdgeConfig();

    // Load agents asynchronously in background
    this.initializeAgents();
  }

  private async initializeAgents() {
    logInfo('AgentManager', 'Initializing agents...');
    
    // 1. Load Registry from file (Node.js only)
    const fileRegistry = await this.loadRegistryAsync();
    if (fileRegistry) {
      this.registry = fileRegistry;
    }

    // 2. Load Agents
    for (const agentConfig of this.registry.agents) {
      if (agentConfig.autoStart) {
        try {
          await this.loadAgent(agentConfig.name, agentConfig.path);
        } catch (e) {
          logError('AgentManager', `Failed to auto-load ${agentConfig.name}: ${e}`);
        }
      }
    }

    // 3. Initialize Edge Proxy if enabled
    if (this.edgeConfig.enabled) {
      try {
        // Dynamic import to avoid static dependency
        const { default: EdgeProxyAgent } = await import('./EdgeProxyAgent.js');
        this.edgeProxy = new EdgeProxyAgent(this.edgeConfig);
        await this.edgeProxy.initialize();
        this.registerAgent(this.edgeProxy);
      } catch (e) {
        logError('AgentManager', `Failed to load EdgeProxy: ${e}`);
      }
    }

    logInfo('AgentManager', `Initialized with ${this.agents.size} agents.`);
  }

  async loadAgent(name: string, modulePath: string): Promise<void> {
    try {
        // Dynamic imports for Node.js-specific modules (Worker compatibility)
        if (typeof process === 'undefined' || !process.versions?.node) {
             throw new Error("Dynamic agent loading not supported in Worker environment");
        }
        
        const path = await import('path');
        // Resolve path relative to build directory if needed
        // This is a simplification; in real app we need robust path resolution
        if (!modulePath.startsWith('/') && !modulePath.startsWith('.')) {
             // assume relative to current file or build root
        }
        
        // This is tricky in bundled environments.
        // We assume modulePath is something we can import.
        const AgentClass = (await import(modulePath)).default;
        const agent = new AgentClass();
        this.agents.set(name, agent);

        if (agent.initialize) {
            await agent.initialize();
        }
    } catch (e) {
        logError('AgentManager', `Error loading agent ${name}: ${e}`);
        throw e;
    }
  }

  // --------------------------------------------------------------------------
  // CORE LOGIC
  // --------------------------------------------------------------------------

  /**
   * Fő belépési pont: feladat delegálása
   */
  async delegateTask(task: { id: string; instruction: string; context?: any; createdAt: string }): Promise<AgentResult> {
    const startTime = Date.now();
    let targetAgent = this.routeTask(task.instruction);
    
    if (!targetAgent) {
      return {
        success: false,
        message: 'Nem találtam megfelelő ügynököt a feladathoz.',
        data: null,
        executionTime: Date.now() - startTime
      };
    }

    // Ha Edge Proxy van beállítva és az ügynök nincs helyben, próbáljuk meg edge-en
    if (this.edgeConfig.enabled && !this.agents.has(targetAgent) && this.edgeProxy) {
      logInfo('AgentManager', `Delegálás edge-re: ${targetAgent}`);
      // Itt speciális logika kellene, hogy az EdgeProxy-n keresztül hívjuk meg
      // Egyelőre egyszerűsítve:
      targetAgent = 'EdgeProxy';
    }

    const agent = this.agents.get(targetAgent);
    if (!agent) {
       return {
        success: false,
        message: `A kijelölt ügynök (${targetAgent}) nem elérhető.`,
        data: null,
        executionTime: Date.now() - startTime
      };
    }

    logInfo('AgentManager', `Delegálás: ${task.instruction} -> ${targetAgent}`);
    setAgentStatus(targetAgent, 'working', task.instruction);

    try {
      let result;

      // Check for different execute signatures
      if (typeof agent.executeTask === 'function') {
        // New AgentContext signature
        result = await agent.executeTask({
          task: task.instruction,
          context: task.context,
          swarm: {
            sessionId: task.id,
            history: [],
            artifacts: {}
          }
        });
      } else {
        // Legacy or mismatched signature
        // We check if it inherits from BaseAgent by checking properties
        const isBaseAgent = agent.executeTask !== undefined ||
                            ['BaseAgent', 'EdgeProxyAgent', 'ProjectConductorAgent', 'DynamicAgent'].includes(agent.constructor?.name);

        if (isBaseAgent || agent.constructor?.name === 'EdgeProxyAgent' || agent.constructor?.name === 'ProjectConductorAgent') {
          // BaseAgent signature: execute(context: AgentContext)
          result = await agent.execute({ task: task.instruction, ...task.context });
        } else {
          // IAgent signature: execute(task: string, context?: any)
          result = await agent.execute(task.instruction, task.context);
        }
      }

      return {
        ...result,
        executedBy: targetAgent,
        executionTime: Date.now() - startTime
      };
      
    } catch (error) {
      logError('AgentManager', `Ügynök hiba (${targetAgent}): ${error}`);
      return {
        success: false,
        message: `Végrehajtási hiba: ${error}`,
        data: null,
        executedBy: targetAgent,
        executionTime: Date.now() - startTime
      };
    } finally {
      setAgentStatus(targetAgent, 'idle');
    }
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
      const out = await agent.execute(task, context);
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
          const result = await agent.execute(pending.description, pending.context);
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
  async createPlan(userMessage: string): Promise<{ taskIds: number[] }> {
    const orchestrator = this.agents.get('Orchestrator');
    if (!orchestrator) return { taskIds: [] };
    const out = await orchestrator.execute(userMessage);
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
          const result = await agent.execute(t.description, t.context);
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
