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

import { EventEmitter } from "events";
import { logInfo, logError, logWarn, setAgentStatus } from "../utils/logger.js";
import { saveTask, updateTaskStatus } from "../utils/tasksDb.js";
import {
  withRetry,
  calculateDelay,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
} from "../core/retryStrategy.js";
import {
  saveCheckpoint,
  loadCheckpoint,
  type CheckpointState,
} from "../core/checkpoint.js";
import { gitAutoCheckpoint, logRecoveryEvent } from "../core/gitRecovery.js";
import { autoSaveGoldenSample } from "../core/goldenDatasetBridge.js";
import { executeDAG, type DAGContext, type DAGExecutionResult, type DAGNode, type DAGWorkflow } from "../core/dagEngine.js";
import { phoenixEventBus } from "../core/phoenixEventBus.js";
import { failoverRegistry } from "../core/failoverRegistry.js";
import {
  traceAgentExecution,
  type TraceContext,
} from "../utils/agentTracer.js";
import AgentCoordinator from "../core/agentCoordinator.js";
import { recordAgentExecution } from "../utils/metrics.js";
import { checkToolPermission } from "../tools/toolPermissions.js";
import { record as auditRecord } from "../core/auditLog.js";
import { getPendingFixes, updateFixStatus } from "../utils/fixQueue.js";
import { SocketServiceClass } from "../server/SocketService.js"; // Import SocketServiceClass type
import type { IAgent } from "./types.js";
import { formatResponse } from "../utils/responseFormatter.js";
import { SwarmManager } from './swarm/SwarmManager.js';
import { resolveAgentExport } from './agentLoader.js';
import { selectAgentForInstruction } from "./agentRouting.js";
import { validateAndNormalizeRegistry, type RegistryValidationReport } from "./registryValidation.js";
import { type AgentConfig, type RegistryConfig } from "./registryStandard.js";
import { getSkill, SKILL_REGISTRY } from "../skills/index.js";
import { getOrchestrationConcurrencyConfig, getOrchestrationConcurrencyLimit } from "../config/paiosConfig.js";

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

type AgentRuntimeStatus = "idle" | "working" | "error" | "unloaded";

interface AgentRuntimeInfo {
  status: AgentRuntimeStatus;
  lastTaskAt?: string;
  lastTask?: string;
  successCount: number;
  errorCount: number;
}

interface AgentLoadDiagnostic {
  name: string;
  module: string;
  configuredClass: string;
  loadStatus: "pending" | "loaded" | "error" | "skipped";
  resolvedExportName?: string;
  resolutionStrategy?: string;
  availableExports: string[];
  error?: string;
  metadata: NonNullable<AgentConfig["metadataStandard"]>;
  runtime: AgentRuntimeInfo;
}

type AgentWithSystemPrompt = IAgent & { systemPrompt?: string };

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
  status: "pending" | "running" | "done" | "error" | "cancelled" | "paused";
}

interface WorkflowExecutionSummary {
  id: string;
  name: string;
  status: DAGExecutionResult["status"] | "running";
  nodeCount: number;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  warnings: number;
}

interface PendingTaskProcessResult {
  taskId?: number;
  status: string;
  message?: string;
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
  private agentDiagnostics: Map<string, AgentLoadDiagnostic> = new Map();
  private registryValidationReport: RegistryValidationReport = {
    valid: true,
    errors: [],
    warnings: [],
    checkedAt: new Date().toISOString(),
    summary: {
      totalAgents: 0,
      activeAgents: 0,
      invalidAgents: 0,
      defaultAgent: "Orchestrator",
    },
  };
  private circuitBreakers: Map<
    string,
    { failures: number; lastFailure: number; isOpen: boolean }
  > = new Map();
  private activeExecutions: Map<number, AbortController> = new Map(); // Új: futó feladatok megszakíthatósága
  private recentWorkflowExecutions: WorkflowExecutionSummary[] = [];
  private initializationPromise: Promise<void> | null = null;
  // AgentCoordinator coordinates resource locks and simple negotiation between agents
  private agentCoordinator: AgentCoordinator;
  private initialized = false;
  private workerLoopBusy = false;
  private readonly FAILURE_THRESHOLD = 3;
  private readonly RESET_TIMEOUT = 5 * 60 * 1000; // 5 perc

  public socketService: SocketServiceClass; // Public property

  constructor(socketService?: SocketServiceClass) {
    super();
    // Use provided socketService or create a no-op mock for testing
    this.socketService = socketService || ({
      broadcastChatter: () => {},
      emit: () => {},
      on: () => {},
    } as any);
    this.registry = this.loadRegistry();
    this.edgeConfig = this.loadEdgeConfig();
    this.seedAgentDiagnostics(this.registry.agents);
    // Initialize coordinator for resource locking and negotiation
    this.agentCoordinator = new AgentCoordinator();
  }

  /** Expose internal coordinator for hooks and instrumentation */
  getCoordinator(): AgentCoordinator {
    return this.agentCoordinator;
  }

  /**
   * Skill végrehajtása név alapján.
   *
   * @param skillName - A futtatandó skill neve
   * @param params - Paraméterek a skill számára
   * @returns A skill végrehajtásának eredménye
   */
  public async executeSkill(
    skillName: string,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const skill = getSkill(skillName) ?? SKILL_REGISTRY[skillName];
    if (!skill) {
      throw new Error(
        `Ismeretlen skill: ${skillName}. Elérhető skill-ek: ${Object.keys(SKILL_REGISTRY).join(", ")}`,
      );
    }

    const validationResult = skill.getValidationResult?.(params);
    if (validationResult) {
      if (!validationResult.valid) {
        throw new Error(
          validationResult.error ?? `Érvénytelen paraméterek a skillhez: ${skillName}`,
        );
      }
    } else if (skill.validate && !skill.validate(params)) {
      throw new Error(`Érvénytelen paraméterek a skillhez: ${skillName}`);
    }

    try {
      return await skill.execute(params);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError("AgentManager", `Skill futtatási hiba (${skillName}): ${message}`);
      throw new Error(`Skill futtatási hiba (${skillName}): ${message}`);
    } finally {
      // Nincs erőforrás, amit itt fel kellene szabadítani, de a blokk
      // megtartja az egységes hiba-kezelési mintát.
    }
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) {
      logInfo("AgentManager", "Inicializálás kihagyva: már inicializálva van");
      return;
    }

    if (this.initializationPromise) {
      logInfo("AgentManager", "Inicializálás már folyamatban van, meglévő promise újrahasználata");
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    try {
      await this.initializationPromise;
      this.initialized = true;
    } finally {
      this.initializationPromise = null;
    }
  }

  private async performInitialization(): Promise<void> {
    logInfo("AgentManager", "Inicializálás...");

    // Load registry asynchronously if in Node environment
    if (typeof process !== "undefined" && process.versions?.node) {
      this.registry = await this.loadRegistryAsync();
      this.seedAgentDiagnostics(this.registry.agents);
      if (!this.registryValidationReport.valid) {
        logError(
          "AgentManager",
          `Registry validation errors: ${this.registryValidationReport.errors.join(" | ")}`,
        );
      }
      if (this.registryValidationReport.warnings.length > 0) {
        logWarn(
          "AgentManager",
          `Registry validation warnings: ${this.registryValidationReport.warnings.join(" | ")}`,
        );
      }
    }

    // Ügynökök betöltése
    await Promise.all(
      this.registry.agents.map(async (agentConfig) => {
        try {
          await this.loadAgent(agentConfig);
        } catch (error) {
          this.markAgentDiagnostic(agentConfig, {
            loadStatus: "error",
            error: error instanceof Error ? error.message : String(error),
          });
          logError(
            "AgentManager",
            `Ügynök betöltési hiba (${agentConfig.name}): ${error}`,
          );
        }
      }),
    );

    // Edge proxy inicializálása (ha engedélyezve)
    if (this.edgeConfig.enabled) {
      await this.initializeEdgeProxy();
    }

    // Auto-start ügynökök
    for (const agentConfig of this.registry.agents.filter((a) => a.autoStart)) {
      const agent = this.agents.get(agentConfig.name);
      if (agent?.initialize) {
        await agent.initialize();
      }
    }

    logInfo("AgentManager", `${this.agents.size} ügynök betöltve`);

    // STARTUP SELF-HEALING (The "Black Box" Protocol)
    await this.processFixQueue();

    // Auto-start ügynökök
    for (const agentConfig of this.registry.agents.filter((a) => a.autoStart)) {
      const agent = this.agents.get(agentConfig.name);
      if (agent?.initialize) {
        await agent.initialize();
      }
    }
  }

  /**
   * Processes the Fix Queue on startup or demand.
   * This implements the "Self-Healing" protocol requested.
   */
  async processFixQueue(): Promise<void> {
    const pendingFixes = getPendingFixes();
    if (pendingFixes.length === 0) return;

    logInfo(
      "AgentManager",
      `🔧 Self-Healing: ${pendingFixes.length} pending fixes found.`,
    );

    // If we have critical fixes, delegate them to DeveloperAgent immediately
    for (const fix of pendingFixes) {
      logInfo(
        "AgentManager",
        `🔧 Applying Fix: ${fix.description} [${fix.id}]`,
      );
      updateFixStatus(fix.id, "in-progress");

      // Prefer DeveloperAgent for fixes
      const targetAgent = this.agents.get("Developer")
        ? "Developer"
        : "Orchestrator";

      try {
        const result = await this.delegate(
          targetAgent,
          `CRITICAL FIX: ${fix.description}. Source: ${fix.source}. Fix this immediately.`,
        );

        // Check result
        const success = (result as any)?.success ?? false;
        if (success) {
          updateFixStatus(fix.id, "resolved");
          logInfo("AgentManager", `✅ Fix Resolved: ${fix.id}`);
        } else {
          updateFixStatus(
            fix.id,
            "failed",
            (result as any)?.message || "Unknown error",
          );
        }
      } catch (e) {
        updateFixStatus(fix.id, "failed", (e as Error).message);
        logError(
          "AgentManager",
          `❌ Fix Failed: ${fix.id} - ${(e as Error).message}`,
        );
      }
    }
  }

  private async loadAgent(config: AgentConfig): Promise<void> {
    // Dynamic imports for Node.js-specific modules (Worker compatibility)
    if (typeof process === "undefined" || !process.versions?.node) {
      this.markAgentDiagnostic(config, {
        loadStatus: "skipped",
        error: "loadAgent() requires Node.js environment",
      });
      logError("AgentManager", "loadAgent() requires Node.js environment");
      return;
    }

    // Skip if module is not defined (e.g. planned agents)
    if (!config.module) {
      this.markAgentDiagnostic(config, {
        loadStatus: "skipped",
        error: "No module path defined",
      });
      logInfo(
        "AgentManager",
        `Skipping agent '${config.name}' (no module path defined)`,
      );
      return;
    }

    const path = await import("path");
    const fs = await import("fs");
    const url = await import("url");

    const modulePath = path.default.resolve(
      process.cwd(),
      "build",
      config.module.replace("./", ""),
    );

    if (!fs.default.existsSync(modulePath)) {
      this.markAgentDiagnostic(config, {
        loadStatus: "error",
        error: `Modul nem található: ${modulePath}`,
      });
      logError("AgentManager", `Modul nem található: ${modulePath}`);
      return;
    }

    // Convert Windows path to file:// URL for ESM import
    const moduleUrl = url.pathToFileURL(modulePath).href;

    // Use moduleUrl instead of modulePath for import
    const importedModule = (await import(moduleUrl)) as Record<string, unknown>;
    const resolvedExport = resolveAgentExport(importedModule, config.class);

    if (resolvedExport.strategy === 'first-constructable') {
      logWarn(
        'AgentManager',
        `Ügynök export fallback (${config.name}): várt='${config.class}', használt='${resolvedExport.exportName}', elérhető=[${resolvedExport.availableExports.join(', ')}]`,
      );
    }

    const agent = new resolvedExport.AgentClass(config.config) as AgentWithSystemPrompt;

    agent.name = config.name;
    agent.description = config.description;
    agent.systemPrompt = config.systemPrompt;

    this.agents.set(config.name, agent);
    const runtime = this.ensureAgentRuntime(config.name);
    this.markAgentDiagnostic(config, {
      loadStatus: "loaded",
      resolvedExportName: resolvedExport.exportName,
      resolutionStrategy: resolvedExport.strategy,
      availableExports: resolvedExport.availableExports,
      runtime,
      error: undefined,
    });
    logInfo(
      "AgentManager",
      `Ügynök betöltve: ${config.name}. Jelenlegi kulcsok: ${[...this.agents.keys()].join(", ")}`,
    );
  }

  private ensureAgentRuntime(agentName: string): AgentRuntimeInfo {
    if (!this.agentRuntime.has(agentName)) {
      this.agentRuntime.set(agentName, {
        status: this.agents.has(agentName) ? "idle" : "unloaded",
        successCount: 0,
        errorCount: 0,
      });
    }
    return this.agentRuntime.get(agentName)!;
  }

  private updateAgentRuntime(
    agentName: string,
    updates: Partial<AgentRuntimeInfo>,
  ) {
    const current = this.ensureAgentRuntime(agentName);
    const runtime = { ...current, ...updates };
    this.agentRuntime.set(agentName, runtime);
    const existing = this.agentDiagnostics.get(agentName);
    if (existing) {
      this.agentDiagnostics.set(agentName, { ...existing, runtime });
    }
  }

  private seedAgentDiagnostics(agentConfigs: AgentConfig[]): void {
    this.agentDiagnostics = new Map(
      agentConfigs.map((config) => {
        const runtime = this.ensureAgentRuntime(config.name);
        return [config.name, {
          name: config.name,
          module: config.module,
          configuredClass: config.class,
          loadStatus: "pending",
          availableExports: [],
          metadata: config.metadataStandard ?? {
            category: "general",
            status: "active",
            tags: [],
            tools: [],
            triggers: config.triggers ?? [],
            capabilities: config.capabilities,
            priority: config.priority,
            autoStart: config.autoStart,
            executionMode: "local",
            costTier: "low",
            runtimeCompatibility: "node",
          },
          runtime,
        } satisfies AgentLoadDiagnostic];
      }),
    );
  }

  private markAgentDiagnostic(
    config: AgentConfig,
    updates: Partial<AgentLoadDiagnostic>,
  ): void {
    const current = this.agentDiagnostics.get(config.name) ?? {
      name: config.name,
      module: config.module,
      configuredClass: config.class,
      loadStatus: "pending",
      availableExports: [],
      metadata: config.metadataStandard ?? {
        category: "general",
        status: "active",
        tags: [],
        tools: [],
        triggers: config.triggers ?? [],
        capabilities: config.capabilities,
        priority: config.priority,
        autoStart: config.autoStart,
        executionMode: "local",
        costTier: "low",
        runtimeCompatibility: "node",
      },
      runtime: this.ensureAgentRuntime(config.name),
    } satisfies AgentLoadDiagnostic;

    this.agentDiagnostics.set(config.name, {
      ...current,
      ...updates,
      runtime: updates.runtime ?? current.runtime,
      availableExports: updates.availableExports ?? current.availableExports,
    });
  }

  private async initializeEdgeProxy(): Promise<void> {
    const edgeProxyConfig = this.registry.agents.find(
      (a) => a.name === "EdgeProxy",
    );
    if (edgeProxyConfig) {
      this.edgeProxy = this.agents.get("EdgeProxy");
      if (this.edgeProxy?.initialize) {
        await this.edgeProxy.initialize();
        logInfo("AgentManager", "EdgeProxy inicializálva");
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

    logInfo(
      "AgentManager",
      `Task delegálás: ${task.instruction.slice(0, 50)}...`,
    );
    this.socketService.broadcastChatter("Orchestrator", `Feladat delegálása folyamatban: ${task.instruction.slice(0, 50)}...`);

    // 1. Edge-first stratégia (ha engedélyezve és elérhető)
    if (this.edgeConfig.enabled && this.edgeProxy?.isEdgeHealthy?.()) {
      try {
        logInfo("AgentManager", "Edge delegálás...");
        const edgeResult = await this.delegateToEdge(task);

        if (edgeResult.success) {
          return {
            ...edgeResult,
            executedBy: "edge",
            executionTime: Date.now() - startTime,
          };
        }

        // Edge sikertelen, de fallback engedélyezve
        if (this.edgeConfig.fallbackToLocal) {
          logInfo("AgentManager", "Edge sikertelen, lokális fallback...");
        } else {
          return edgeResult;
        }
      } catch (error) {
        logError("AgentManager", `Edge hiba: ${error}`);

        if (!this.edgeConfig.fallbackToLocal) {
          return {
            success: false,
            message: `Edge hiba: ${error}`,
            data: null,
            executedBy: "edge",
            executionTime: Date.now() - startTime,
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
        message: "EdgeProxy nem elérhető",
        data: null,
      };
    }

    const result = await this.edgeProxy.execute(
      `submit ${task.instruction}`,
      task.context,
    );

    // Cast result to TaskResult (since execute returns unknown)
    return (
      typeof result === "object" && result !== null
        ? result
        : { success: true, data: result, message: "Edge execution completed" }
    ) as TaskResult;
  }

  /**
   * Lokális delegálás
   */
  private async delegateLocally(
    task: Task,
    startTime: number,
  ): Promise<TaskResult> {
    const targetAgent = this.routeTask(task.instruction);

    if (!targetAgent) {
      return {
        success: false,
        message: "Nem található megfelelő ügynök",
        data: null,
        executionTime: Date.now() - startTime,
      };
    }

    const result = await this.executeAgentWithRetry(
      targetAgent,
      task.instruction,
      task.context,
    );

    return {
      ...result,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Ügynök végrehajtása retry logikával és Circuit Breaker-rel
   */
  private async executeAgentWithRetry(
    agentName: string,
    instruction: string,
    context?: Record<string, unknown>,
    retries = 2,
    parentTraceContext?: TraceContext,
    isFailover = false,
  ): Promise<TaskResult> {
    const executionStart = Date.now();
    const cb = this.getCircuitBreaker(agentName);

    this.socketService.broadcastChatter("System", `Ügynök indítása: ${agentName}`, agentName);

    // RULE-OB1: Start trace span for this agent execution
    const trace = traceAgentExecution(
      agentName,
      instruction,
      parentTraceContext,
    );

    // RULE-AU1: Permission check before execution
    const permCheck = checkToolPermission("agent_delegate", { agentName });
    if (!permCheck.allowed) {
      // RULE-AU2: DENIED → audit log + error return
      await auditRecord(
        "DENIED",
        agentName,
        "execute",
        instruction.slice(0, 100),
        permCheck.reason,
      );
      trace.end("error", `PERMISSION_DENIED: ${permCheck.reason}`);
      return {
        success: false,
        message: `PERMISSION_DENIED: ${permCheck.reason}`,
        data: null,
        executedBy: agentName,
      };
    }
    await auditRecord(
      "ALLOWED",
      agentName,
      "execute",
      instruction.slice(0, 100),
    );

    // Circuit Breaker ellenőrzése
    if (cb.isOpen) {
      const remaining = this.RESET_TIMEOUT - (Date.now() - cb.lastFailure);
      if (remaining > 0) {
        logError(
          "AgentManager",
          `Circuit Breaker NYITVA (${agentName}). Hátralévő idő: ${Math.round(remaining / 1000)}s`,
        );
        trace.end("error", `Circuit Breaker OPEN (${agentName})`);
        return {
          success: false,
          message: `Ügynök ideiglenesen letiltva (Circuit Breaker): ${agentName}`,
          data: null,
        };
      } else {
        // Timeout lejárt, próbálkozunk (Half-open állapot szimulálva)
        cb.isOpen = false;
        cb.failures = 0;
        logInfo("AgentManager", `Circuit Breaker VISSZAÁLLÍTVA (${agentName})`);
      }
    }

    const agent = this.agents.get(agentName);
    if (!agent) {
      trace.end("error", `Agent not found: ${agentName}`);
      return {
        success: false,
        message: `Ügynök nem található: ${agentName}`,
        data: null,
        executedBy: agentName,
      };
    }

    const retryConfig: Partial<RetryConfig> = {
      maxRetries: retries,
      onRetry: (attempt, delay, error) => {
        logInfo(
          "AgentManager",
          `Újrapróbálkozás (${agentName})... ${attempt}/${retries} — ${delay}ms várakozás`,
        );
        this.emit("gold:retry_attempt", {
          taskId: instruction.slice(0, 50),
          attempt,
          delay,
          agent: agentName,
        });
        cb.failures++;
        cb.lastFailure = Date.now();
        if (cb.failures >= this.FAILURE_THRESHOLD) {
          cb.isOpen = true;
          logError("AgentManager", `Circuit Breaker TRIPPED (${agentName})!`);
          phoenixEventBus.publish('phoenix:circuit_breaker', {
            agentName,
            state: 'open',
            previousState: 'closed',
            failures: cb.failures,
            timestamp: new Date().toISOString(),
          });
        }
      },
    };

    try {
      const result = await withRetry(
        async () => {
          // Circuit breaker check inside retry loop
          if (cb.isOpen) {
            throw new Error(`Circuit Breaker OPEN for ${agentName}`);
          }

          // Instrumentation: increment coordinator load for this agent execution
          try {
            const prevLoad = this.agentCoordinator.getLoad(agentName) || 0;
            this.agentCoordinator.setLoad(agentName, prevLoad + 1);
          } catch {
            /* non-critical */
          }

          this.updateAgentRuntime(agentName, {
            status: "working",
            lastTask: instruction,
            lastTaskAt: new Date().toISOString(),
          });
          setAgentStatus(agentName, "working", instruction);

          // Task ID keresése a kontextusban vagy a sorban (ha van)
          const taskId = (context as any)?.taskId || 0;
          const controller = new AbortController();
          if (taskId) this.activeExecutions.set(taskId, controller);

          try {
            const res = await agent.execute(instruction, { ...context, signal: controller.signal });

            // Result normalizálás (status -> success mapping)
            if (typeof res === "object" && res !== null) {
              const resObj = res as Record<string, unknown>;
              if (resObj["success"] === undefined) {
                resObj["success"] =
                  resObj["status"] === "success" || resObj["status"] === "ok";
              }

              // Format response as Hungarian human-readable text (if not already formatted)
              if (!resObj["message"] || typeof resObj["message"] !== "string") {
                const formatted = formatResponse(resObj, agentName, { useEmojis: true });
                resObj["message"] = formatted;
              }

              return resObj as unknown as TaskResult;
            } else {
              // Format simple response
              const formatted = formatResponse(res, agentName, { useEmojis: true });
              return {
                success: true,
                data: res,
                message: formatted,
              } as TaskResult;
            }
          } finally {
            if (taskId) this.activeExecutions.delete(taskId);
            // Decrement coordinator load after execution attempt
            try {
              const prev = this.agentCoordinator.getLoad(agentName) || 0;
              this.agentCoordinator.setLoad(agentName, Math.max(0, prev - 1));
            } catch {
              /* non-critical */
            }
          }
        },
        `${agentName}:execute`,
        retryConfig,
      );

      // Success — reset circuit breaker & update runtime
      cb.failures = 0;
      cb.isOpen = false;

      const runtime = this.ensureAgentRuntime(agentName);
      this.updateAgentRuntime(agentName, {
        status: "idle",
        lastTaskAt: new Date().toISOString(),
        successCount: runtime.successCount + 1,
      });
      setAgentStatus(agentName, "idle", instruction);
      this.socketService.broadcastChatter(agentName, `Feladat sikeresen elvégezve: ${instruction.slice(0, 50)}...`, "System");

      // RULE-PH1: checkpoint on success
      await saveCheckpoint(
        instruction.slice(0, 100),
        0,
        `${agentName}:success`,
        {
          agent: agentName,
          resultPreview: JSON.stringify(result).slice(0, 500),
        },
      ).catch(() => {
        /* non-critical */
      });

      // RULE-GD1: Auto-save golden sample on success
      await autoSaveGoldenSample(agentName, instruction, result).catch(() => {
        /* non-critical */
      });

      // RULE-OB1: End trace span on success (+ confidence propagation)
      const confidence = (result as any)?.metadata?.confidence;
      if (confidence !== undefined) {
        trace.span.metadata['confidence'] = confidence;
      }
      // Attach traceId to result for later lookup by tasks API / observability CLI
      try {
        if (result && typeof result === 'object') {
          (result as any).metadata = (result as any).metadata ?? {};
          (result as any).metadata.traceId = trace.span.traceId;
        }
      } catch {
        /* non-critical */
      }
      trace.end("success");
      recordAgentExecution(agentName, "success", Date.now() - executionStart);

      return result;
    } catch (lastError: any) {
      logError(
        "AgentManager",
        `Végrehajtási hiba több próbálkozás után (${agentName}): ${lastError?.message || "Ismeretlen hiba"}`,
      );

      // RULE-PH4: Git auto-checkpoint after all retries exhausted
      await gitAutoCheckpoint(
        agentName,
        lastError?.message || "Unknown error",
      ).catch((e: any) =>
        logError("AgentManager", `Git recovery failed: ${e.message}`),
      );
      logRecoveryEvent(
        "crash",
        agentName,
        lastError?.message || "All retries exhausted",
      );

      // RULE-OB1: End trace span on error
      trace.end("error", lastError?.message || "All retries exhausted");
      recordAgentExecution(agentName, "error", Date.now() - executionStart);

      const runtime = this.ensureAgentRuntime(agentName);
      this.updateAgentRuntime(agentName, {
        status: "error",
        lastTaskAt: new Date().toISOString(),
        errorCount: runtime.errorCount + 1,
      });
      setAgentStatus(agentName, "error", instruction);
      this.socketService.broadcastChatter(agentName, `⚠️ HIBA a végrehajtás során: ${lastError?.message || "Ismeretlen hiba"}`, "System");

      // ================================================================
      // PHOENIX PROTOCOL SZINT 4: Cross-Agent Failover
      // ================================================================
      phoenixEventBus.publish('phoenix:agent_failed', {
        agentName,
        taskInstruction: instruction,
        taskContext: context,
        error: lastError?.message || 'Unknown error',
        retriesExhausted: retries,
        timestamp: new Date().toISOString(),
      });

      // Attempt cross-agent failover (only if not already a failover attempt)
      if (!isFailover) {
        const fallbacks = failoverRegistry.getFallbacks(agentName);
        for (let i = 0; i < fallbacks.length; i++) {
          const fallbackAgent = fallbacks[i];
          if (!this.agents.has(fallbackAgent)) continue;

          const fallbackCb = this.getCircuitBreaker(fallbackAgent);
          if (fallbackCb.isOpen) continue;

          phoenixEventBus.publish('phoenix:failover_triggered', {
            originalAgent: agentName,
            fallbackAgent,
            taskInstruction: instruction,
            attempt: i + 1,
            timestamp: new Date().toISOString(),
          });

          logInfo('AgentManager', `Phoenix Failover: ${agentName} → ${fallbackAgent} (attempt ${i + 1}/${fallbacks.length})`);
          this.socketService.broadcastChatter(agentName, `🔄 Phoenix Failover aktiválva: ${agentName} → ${fallbackAgent}`, fallbackAgent);
          const failoverStart = Date.now();

          try {
            const failoverResult = await this.executeAgentWithRetry(
              fallbackAgent, instruction, context, 1, parentTraceContext, true,
            );

            const foSuccess = failoverResult.success;
            phoenixEventBus.publish('phoenix:failover_result', {
              originalAgent: agentName,
              fallbackAgent,
              taskInstruction: instruction,
              success: foSuccess,
              error: foSuccess ? undefined : failoverResult.message,
              executionTimeMs: Date.now() - failoverStart,
              timestamp: new Date().toISOString(),
            });
            failoverRegistry.recordAttempt({
              primaryAgent: agentName,
              fallbackAgent,
              taskInstruction: instruction,
              success: foSuccess,
              error: foSuccess ? undefined : failoverResult.message,
              attemptIndex: i,
              timestamp: new Date().toISOString(),
            });

            if (foSuccess) {
              logInfo('AgentManager', `Phoenix Failover SUCCEEDED: ${agentName} → ${fallbackAgent}`);
              logRecoveryEvent('failover', agentName, `Failover to ${fallbackAgent} succeeded`);
              return { ...failoverResult, executedBy: `${fallbackAgent} (failover from ${agentName})` };
            }
          } catch (foErr: any) {
            phoenixEventBus.publish('phoenix:failover_result', {
              originalAgent: agentName,
              fallbackAgent,
              taskInstruction: instruction,
              success: false,
              error: foErr?.message || 'Unknown failover error',
              executionTimeMs: Date.now() - failoverStart,
              timestamp: new Date().toISOString(),
            });
            failoverRegistry.recordAttempt({
              primaryAgent: agentName,
              fallbackAgent,
              taskInstruction: instruction,
              success: false,
              error: foErr?.message,
              attemptIndex: i,
              timestamp: new Date().toISOString(),
            });
            logError('AgentManager', `Phoenix Failover FAILED: ${agentName} → ${fallbackAgent}: ${foErr?.message}`);
          }
        }

        if (fallbacks.length > 0) {
          logError('AgentManager', `Phoenix Failover: ALL fallbacks exhausted for ${agentName}`);
        }
      }

      return {
        success: false,
        message: `Végrehajtási hiba több próbálkozás után (${agentName}): ${lastError?.message || "Ismeretlen hiba"}`,
        data: null,
        executedBy: agentName,
      };
    }
  }

  private getCircuitBreaker(agentName: string) {
    if (!this.circuitBreakers.has(agentName)) {
      this.circuitBreakers.set(agentName, {
        failures: 0,
        lastFailure: 0,
        isOpen: false,
      });
    }
    return this.circuitBreakers.get(agentName)!;
  }

  // --------------------------------------------------------------------------
  // PHOENIX PROTOCOL V2 - RECOVERY LOGIC
  // --------------------------------------------------------------------------

  /**
   * Execute agent with automatic recovery (Phoenix Protocol v2).
   *
   * This method wraps executeAgentWithRetry() with additional recovery logic:
   * - Service restart on failure
   * - State restoration from checkpoints
   * - Graceful degradation on max retries
   *
   * @param agentName - Name of the agent to execute
   * @param instruction - Task instruction
   * @param context - Optional execution context
   * @returns Task result with recovery status
   */
  async executeWithRecovery(
    agentName: string,
    instruction: string,
    context?: Record<string, unknown>
  ): Promise<TaskResult & { recoveryAttempts?: number }> {
    const MAX_RECOVERY_ATTEMPTS = 3;
    let recoveryAttempts = 0;

    logInfo('AgentManager', `[Phoenix Recovery] Starting execution: ${agentName} - ${instruction.slice(0, 50)}...`);

    for (let attempt = 1; attempt <= MAX_RECOVERY_ATTEMPTS; attempt++) {
      try {
        // Attempt execution with retry logic
        const result = await this.executeAgentWithRetry(
          agentName,
          instruction,
          context
        );

        if (result.success) {
          logInfo('AgentManager', `[Phoenix Recovery] Success on attempt ${attempt}`);
          phoenixEventBus.publish('phoenix:recovery', {
            type: 'restart',
            agent: agentName,
            details: `Recovery succeeded on attempt ${attempt}`,
            timestamp: new Date().toISOString(),
          });

          return { ...result, recoveryAttempts: attempt - 1 };
        }

        // Execution failed but didn't throw - treat as error
        const errorMsg = result.message || 'Execution failed';
        recoveryAttempts++;

        logWarn('AgentManager', `[Phoenix Recovery] Attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS} failed: ${errorMsg}`);

        phoenixEventBus.publish('phoenix:recovery', {
          type: 'restart',
          agent: agentName,
          details: `Recovery attempt ${attempt}: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        });

        // If not the last attempt, try recovery
        if (attempt < MAX_RECOVERY_ATTEMPTS) {
          // 1. Attempt service restart
          const restartSuccess = await this.restartService(agentName);
          if (restartSuccess) {
            logInfo('AgentManager', `[Phoenix Recovery] Service restart successful: ${agentName}`);
          }

          // 2. Attempt state restoration
          const stateRestored = await this.restoreState(agentName, instruction);
          if (stateRestored) {
            logInfo('AgentManager', `[Phoenix Recovery] State restored from checkpoint`);
          }

          // 3. Wait before retry (exponential backoff)
          const delay = calculateDelay(attempt, DEFAULT_RETRY_CONFIG);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Try next attempt
        }

        // Last attempt failed (non-exception)
        // Max retries exhausted - graceful degradation
        logError('AgentManager', `[Phoenix Recovery] Max recovery attempts exhausted for ${agentName}`);

        phoenixEventBus.publish('phoenix:recovery', {
          type: 'crash',
          agent: agentName,
          details: `Graceful degradation after max retries: ${errorMsg}`,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          message: `Szolgáltatás korlátozott: ${MAX_RECOVERY_ATTEMPTS} helyreállítási kísérlet után: ${errorMsg}`,
          data: null,
          executedBy: agentName,
          recoveryAttempts,
        };

      } catch (error: any) {
        // Exception thrown during execution - same recovery logic as failed result
        recoveryAttempts++;
        const errorMsg = error?.message || 'Unknown error';

        logWarn('AgentManager', `[Phoenix Recovery] Attempt ${attempt}/${MAX_RECOVERY_ATTEMPTS} threw exception: ${errorMsg}`);

        phoenixEventBus.publish('phoenix:recovery', {
          type: 'restart',
          agent: agentName,
          details: `Recovery attempt ${attempt} (exception): ${errorMsg}`,
          timestamp: new Date().toISOString(),
        });

        // If not the last attempt, try recovery
        if (attempt < MAX_RECOVERY_ATTEMPTS) {
          // 1. Attempt service restart
          const restartSuccess = await this.restartService(agentName);
          if (restartSuccess) {
            logInfo('AgentManager', `[Phoenix Recovery] Service restart successful: ${agentName}`);
          }

          // 2. Attempt state restoration
          const stateRestored = await this.restoreState(agentName, instruction);
          if (stateRestored) {
            logInfo('AgentManager', `[Phoenix Recovery] State restored from checkpoint`);
          }

          // 3. Wait before retry (exponential backoff)
          const delay = calculateDelay(attempt, DEFAULT_RETRY_CONFIG);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue; // Try next attempt
        }

        // Last attempt failed (exception)
        // Max retries exhausted - graceful degradation
        logError('AgentManager', `[Phoenix Recovery] Max recovery attempts exhausted for ${agentName}`);

        phoenixEventBus.publish('phoenix:recovery', {
          type: 'crash',
          agent: agentName,
          details: `Graceful degradation after max retries (exception): ${errorMsg}`,
          timestamp: new Date().toISOString(),
        });

        return {
          success: false,
          message: `Szolgáltatás korlátozott: ${MAX_RECOVERY_ATTEMPTS} helyreállítási kísérlet után: ${errorMsg}`,
          data: null,
          executedBy: agentName,
          recoveryAttempts,
        };
      }
    }

    // Fallback return (should never reach here in normal execution)
    logError('AgentManager', `[Phoenix Recovery] Unexpected loop exit for ${agentName}`);
    return {
      success: false,
      message: 'Váratlan helyreállítási hiba',
      data: null,
      executedBy: agentName,
      recoveryAttempts,
    };
  }

  /**
   * Attempt to restart a service/agent (Phoenix Protocol v2).
   *
   * Service-specific restart logic:
   * - Agents: soft reset (clear runtime state, reset circuit breaker)
   * - Ollama/FastAPI: skip (external services managed by Heartbeat Monitor)
   *
   * @param agentName - Name of the agent/service to restart
   * @returns True if restart was attempted successfully
   */
  private async restartService(agentName: string): Promise<boolean> {
    try {
      logInfo('AgentManager', `[Phoenix Restart] Attempting restart: ${agentName}`);

      // External services (managed by Heartbeat Monitor)
      const externalServices = ['ollama', 'fastapi', 'dashboard'];
      if (externalServices.includes(agentName.toLowerCase())) {
        logInfo('AgentManager', `[Phoenix Restart] External service ${agentName} - skipping (managed by Heartbeat Monitor)`);
        return false;
      }

      // Agent soft reset
      const agent = this.agents.get(agentName);
      if (!agent) {
        logWarn('AgentManager', `[Phoenix Restart] Agent not found: ${agentName}`);
        return false;
      }

      // Reset circuit breaker
      const cb = this.getCircuitBreaker(agentName);
      cb.failures = 0;
      cb.isOpen = false;
      cb.lastFailure = 0;

      // Reset runtime status
      this.updateAgentRuntime(agentName, {
        status: 'idle',
        lastTaskAt: new Date().toISOString(),
      });
      setAgentStatus(agentName, 'idle', '');

      // Call agent's initialize method if available (soft restart)
      if (agent.initialize && typeof agent.initialize === 'function') {
        await agent.initialize();
        logInfo('AgentManager', `[Phoenix Restart] Agent re-initialized: ${agentName}`);
      }

      phoenixEventBus.publish('phoenix:restart', {
        serviceName: agentName,
        success: true,
        timestamp: new Date().toISOString(),
      });

      logInfo('AgentManager', `[Phoenix Restart] Success: ${agentName}`);
      return true;

    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      logError('AgentManager', `[Phoenix Restart] Failed for ${agentName}: ${errorMsg}`);

      phoenixEventBus.publish('phoenix:restart', {
        serviceName: agentName,
        success: false,
        error: errorMsg,
        timestamp: new Date().toISOString(),
      });

      return false;
    }
  }

  /**
   * Restore agent state from the latest checkpoint (Phoenix Protocol v2).
   *
   * Loads the most recent checkpoint for the given task and returns
   * the restored state for the agent to continue from.
   *
   * @param agentName - Name of the agent
   * @param taskId - Task identifier (instruction hash or custom ID)
   * @returns True if state was successfully restored
   */
  private async restoreState(
    agentName: string,
    taskId: string
  ): Promise<boolean> {
    try {
      logInfo('AgentManager', `[Phoenix Restore] Attempting state restoration: ${agentName}`);

      // Generate checkpoint ID from task instruction
      const checkpointId = `${agentName}:${taskId.slice(0, 100)}`;

      // Load latest checkpoint
      const checkpoint = await loadCheckpoint(checkpointId);

      if (!checkpoint) {
        logInfo('AgentManager', `[Phoenix Restore] No checkpoint found for ${agentName}`);
        return false;
      }

      // Parse checkpoint state
      const state = JSON.parse(checkpoint.stateJson) as CheckpointState;

      logInfo('AgentManager', `[Phoenix Restore] Checkpoint loaded: step=${checkpoint.stepIndex} (${checkpoint.stepName})`);

      phoenixEventBus.publish('phoenix:state_restored', {
        agentName,
        taskId: checkpointId,
        stepIndex: checkpoint.stepIndex,
        stepName: checkpoint.stepName,
        timestamp: new Date().toISOString(),
      });

      // NOTE: State restoration is passive - agents should query checkpoints
      // themselves during execution if they support resumption logic.
      // This method verifies that a checkpoint exists and publishes the event.

      return true;

    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      logError('AgentManager', `[Phoenix Restore] State restoration failed for ${agentName}: ${errorMsg}`);
      return false;
    }
  }

  /**
   * Task routing a szabályok alapján
   */
  private routeTask(instruction: string): string | null {
    const runtimeByAgent = new Map(
      this.registry.agents.map((agent) => [
        agent.name,
        this.ensureAgentRuntime(agent.name),
      ]),
    );
    const decision = selectAgentForInstruction(
      instruction,
      this.registry,
      runtimeByAgent,
    );
    return decision.agentName ?? this.registry.defaultAgent;
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
        description: agent.description || "",
        status: runtime.status,
      };
    });
  }

  listAgentStatuses(): Array<{
    name: string;
    description: string;
    status: AgentRuntimeStatus;
    lastTaskAt?: string;
    successCount: number;
    errorCount: number;
    lastTask?: string;
  }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => {
      const runtime = this.ensureAgentRuntime(name);
      return {
        name,
        description: agent.description || "",
        status: runtime.status,
        lastTaskAt: runtime.lastTaskAt,
        successCount: runtime.successCount,
        errorCount: runtime.errorCount,
        lastTask: runtime.lastTask,
      };
    });
  }

  /**
   * Ügynök definíciók listázása (név, leírás, szerepkör) – Orchestrator delegáláshoz
   */
  listAgentDefinitions(): Array<{
    name: string;
    description: string;
    role?: string;
  }> {
    return Array.from(this.agents.entries()).map(([name, agent]) => ({
      name,
      description: agent.description || "",
      role: agent.role || "",
    }));
  }

  /**
   * Edge konfiguráció frissítése
   */
  updateEdgeConfig(config: Partial<EdgeConfig>): void {
    this.edgeConfig = { ...this.edgeConfig, ...config };
    logInfo("AgentManager", "Edge konfiguráció frissítve");
  }

  /**
   * Edge állapot lekérdezése
   */
  getEdgeStatus(): {
    enabled: boolean;
    healthy: boolean;
    tunnelConnected: boolean;
  } {
    return {
      enabled: this.edgeConfig.enabled,
      healthy: this.edgeProxy?.isEdgeHealthy?.() || false,
      tunnelConnected: this.edgeProxy?.isTunnelConnected?.() || false,
    };
  }

  // --------------------------------------------------------------------------
  // COMPATIBILITY API (registry, web, Orchestrator)
  // --------------------------------------------------------------------------

  /** Manuális ügynök regisztráció (registry.ts) */
  registerAgent(agent: {
    name: string;
    description?: string;
    role?: string;
    capabilities?: string[];
    execute: (
      task: string,
      context?: Record<string, unknown>,
    ) => Promise<unknown>;
  }): void {
    const fullAgent: IAgent = {
      name: agent.name,
      role: agent.role || "custom",
      description: agent.description || "",
      capabilities: agent.capabilities || [],
      execute: agent.execute.bind(agent),
    };
    this.agents.set(agent.name, fullAgent);
    const runtime = this.ensureAgentRuntime(agent.name);
    runtime.status = "idle";
    const existingConfig = this.registry.agents.find((entry) => entry.name === agent.name);
    if (existingConfig) {
      this.markAgentDiagnostic(existingConfig, { loadStatus: "loaded", runtime, error: undefined });
    }
    logInfo("AgentManager", `Ügynök regisztrálva: ${agent.name}`);
  }

  /** Delegálás név + feladat alapján (registry, web) */
  async delegate(
    agentName: string,
    task: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    logInfo(
      "AgentManager",
      `[DELEGATE] Kérés érkezett a '${agentName}' ügynökhöz.`,
    );

    const lowerAgentName = agentName.toLowerCase();
    logInfo(
      "AgentManager",
      `[DELEGATE] Keresés: '${agentName}' (${lowerAgentName}). Regisztrált: ${[...this.agents.keys()].join(", ")}`,
    );

    // Case-insensitive lookup in Map
    let agent: IAgent | undefined = undefined;
    for (const [name, a] of this.agents.entries()) {
      if (name.toLowerCase() === lowerAgentName) {
        agent = a;
        break;
      }
    }

    if (!agent) {
      logError(
        "AgentManager",
        `[DELEGATE] Az ügynök ('${agentName}') NEM TALÁLHATÓ a map-ben (Még kisbetűsítve sem). Jelenlegi ügynökök: ${[...this.agents.keys()].join(", ")}. Fallback to dynamic routing.`,
      );
      const result = await this.delegateTask({
        id: `delegate-${Date.now()}`,
        instruction: task,
        context,
        createdAt: new Date().toISOString(),
      });

      logInfo(
        "AgentManager",
        `[DELEGATE] Dynamic routing eredménye: success=${result.success}, detail: ${JSON.stringify(result).slice(0, 100)}`,
      );

      if (result.success) {
        return result;
      }
      throw new Error(result.message || "Delegálás sikertelen");
    }

    logInfo(
      "AgentManager",
      `[DELEGATE] Az ügynök ('${lowerAgentName}') MEGTALÁLVA. Közvetlen végrehajtás...`,
    );

    // Save to DB for tracking
    const dbId = await saveTask({
      agent: agentName,
      task,
      context: context ? JSON.stringify(context) : undefined,
    });

    try {
      const out = await this.executeAgentWithRetry(agentName, task, context);

      if (dbId) {
        const resultStr =
          typeof out === "object" ? JSON.stringify(out) : String(out);
        await updateTaskStatus(dbId, "done", resultStr);
      }

      return out;
    } catch (e: any) {
      if (dbId) await updateTaskStatus(dbId, "error", e.message);
      throw e;
    }
  }

  /** Feladat betétele a sorba (Orchestrator, web) */
  async queueTask(
    description: string,
    agentName: string,
    context?: Record<string, any>,
    parentId?: number,
  ): Promise<number> {
    const contextStr = context ? JSON.stringify(context) : undefined;
    const dbId = await saveTask({
      agent: agentName,
      task: description,
      context: contextStr,
    });

    const id = Number(dbId) || ++this.taskIdCounter;
    this.taskQueue.push({
      id,
      description,
      agentName,
      context,
      parentId,
      createdAt: new Date().toISOString(),
      status: "pending",
    });
    return id;
  }

  /** Összes feladat a sorból */
  getAllTasks(): QueuedTask[] {
    return [...this.taskQueue];
  }

  async executeWorkflow(
    workflow: DAGWorkflow,
    initialContext?: Record<string, unknown>,
  ): Promise<DAGExecutionResult> {
    const summary: WorkflowExecutionSummary = {
      id: workflow.id,
      name: workflow.name,
      status: "running",
      nodeCount: workflow.nodes.length,
      startedAt: new Date().toISOString(),
      warnings: 0,
    };

    this.recentWorkflowExecutions.unshift(summary);
    this.recentWorkflowExecutions = this.recentWorkflowExecutions.slice(0, 25);

    const executionContext: Partial<DAGContext> = {
      input: initialContext,
      values: { ...(initialContext ?? {}) },
    };

    try {
      const result = await executeDAG(workflow, executionContext, {
        executeAgent: async (node: DAGNode, context: DAGContext) => {
          const instruction = node.instruction ?? node.label;
          const routedAgent = node.agentName ?? this.routeTask(instruction);
          if (!routedAgent) {
            throw new Error(`No target agent resolved for workflow node '${node.id}'`);
          }

          const metadata = typeof node.metadata === "object" && node.metadata !== null
            ? node.metadata as Record<string, unknown>
            : {};
          const retries = typeof metadata.retries === "number" ? metadata.retries : 2;

          return this.executeAgentWithRetry(
            routedAgent,
            instruction,
            {
              ...(initialContext ?? {}),
              workflowId: workflow.id,
              workflowNodeId: node.id,
              dagValues: context.values,
              dagNodeResults: context.nodeResults,
            },
            retries,
          );
        },
      });

      summary.status = result.status;
      summary.finishedAt = new Date().toISOString();
      summary.durationMs = result.durationMs;
      summary.warnings = result.warnings.length;

      return result;
    } catch (error) {
      summary.status = "error";
      summary.finishedAt = new Date().toISOString();
      summary.durationMs = Date.now() - new Date(summary.startedAt).getTime();
      throw error;
    }
  }

  listWorkflowExecutions(): WorkflowExecutionSummary[] {
    return [...this.recentWorkflowExecutions];
  }

  /** Egy pending feladat azonnali feldolgozása */
  async processPendingTasks(): Promise<PendingTaskProcessResult | null> {
    const pending = this.taskQueue.find((t) => t.status === "pending");
    if (!pending) return null;

    return this.processQueuedTask(pending);
  }

  private async processQueuedTask(
    pending: QueuedTask,
    emitTaskEvents = false,
  ): Promise<PendingTaskProcessResult> {
    pending.status = "running";
    pending.startedAt = new Date().toISOString();
    await updateTaskStatus(pending.id, "running");

    try {
      const result = await this.executeAgentWithRetry(
        pending.agentName,
        pending.description,
        pending.context,
      );
      pending.status = result.success ? "done" : "error";
      const resultStr =
        typeof result === "object" ? JSON.stringify(result) : String(result);
      await updateTaskStatus(pending.id, pending.status, resultStr);
      if (emitTaskEvents && result.success) {
        this.emit("task_done", { task: pending, result });
      } else if (emitTaskEvents && !result.success) {
        logError(
          "AgentManager",
          `Task ${pending.id} failed: ${result.message}`,
        );
      }
      return {
        taskId: pending.id,
        status: pending.status,
        message: result.message,
      };
    } catch (e: any) {
      pending.status = "error";
      await updateTaskStatus(pending.id, "error", e.message);
      return { taskId: pending.id, status: "error", message: e.message };
    }
  }

  private async processPendingTasksBatch(
    maxConcurrent: number,
    emitTaskEvents = false,
  ): Promise<void> {
    const concurrency = Math.max(1, maxConcurrent);
    const runningCount = this.taskQueue.filter((task) => task.status === "running").length;
    const availableSlots = Math.max(0, concurrency - runningCount);
    if (availableSlots === 0) {
      return;
    }

    const pendingTasks = this.taskQueue
      .filter((task) => task.status === "pending")
      .slice(0, availableSlots);

    if (pendingTasks.length === 0) {
      return;
    }

    await Promise.allSettled(
      pendingTasks.map((task) => this.processQueuedTask(task, emitTaskEvents)),
    );
  }

  async cancelTask(taskId: number): Promise<boolean> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task) return false;

    // Ha fut a feladat, megszakítjuk
    const controller = this.activeExecutions.get(taskId);
    if (controller) {
      controller.abort();
      this.activeExecutions.delete(taskId);
      logInfo("AgentManager", `Feladat ${taskId} végrehajtása megszakítva.`);
    }

    task.status = "cancelled";
    await updateTaskStatus(taskId, "cancelled", "Cancelled by user");
    return true;
  }

  async retryTask(taskId: number, debugMode = false): Promise<boolean> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task) return false;
    task.status = "pending";
    task.startedAt = undefined;
    if (debugMode) {
      task.context = { ...task.context, debugMode: true, verboseLogging: true };
    }
    await updateTaskStatus(taskId, "pending", debugMode ? "Retried with debug mode" : "Retried by user");
    return true;
  }

  async pauseTask(taskId: number): Promise<boolean> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task) return false;
    if (task.status === "running" || task.status === "pending") {
      task.status = "paused";
      await updateTaskStatus(taskId, "paused", "Paused by user");
      return true;
    }
    return false;
  }

  async resumeTask(taskId: number): Promise<boolean> {
    const task = this.taskQueue.find((t) => t.id === taskId);
    if (!task) return false;
    if (task.status === "paused") {
      task.status = "pending";
      await updateTaskStatus(taskId, "pending", "Resumed by user");
      return true;
    }
    return false;
  }

  updateTaskOrder(taskIds: number[]): void {
    // Create a map for quick lookup of tasks by their ID
    const taskMap = new Map<number, QueuedTask>();
    this.taskQueue.forEach(task => taskMap.set(task.id, task));

    const newQueue: QueuedTask[] = [];
    for (const id of taskIds) {
      const task = taskMap.get(id);
      if (task) {
        newQueue.push(task);
        taskMap.delete(id); // Remove from map to handle tasks not in new order
      }
    }

    // Add any remaining tasks that were not in the newOrderIds (e.g., newly queued tasks)
    this.taskQueue = [...newQueue, ...Array.from(taskMap.values())];
    logInfo("AgentManager", `Task queue reordered. New order: ${this.taskQueue.map(t => t.id).join(", ")}`);
  }

  /** Registry definíciók (alias listAgentDefinitions) */
  listRegistryDefinitions(): Array<{
    name: string;
    description: string;
    role?: string;
  }> {
    return this.listAgentDefinitions();
  }

  /** Teljes registry (capabilities, priority, autoStart, stb.) – dashboardhoz */
  getRegistry(): RegistryConfig {
    return { ...this.registry };
  }

  getRegistryValidationReport(): RegistryValidationReport {
    return {
      ...this.registryValidationReport,
      errors: [...this.registryValidationReport.errors],
      warnings: [...this.registryValidationReport.warnings],
      summary: { ...this.registryValidationReport.summary },
    };
  }

  getAgentDiagnostics(): {
    validation: RegistryValidationReport;
    agents: AgentLoadDiagnostic[];
  } {
    const agents = this.registry.agents.map((config) => {
      const runtime = this.ensureAgentRuntime(config.name);
      const diagnostic = this.agentDiagnostics.get(config.name);
      return {
        ...(diagnostic ?? {
          name: config.name,
          module: config.module,
          configuredClass: config.class,
          loadStatus: "pending",
          availableExports: [],
          metadata: config.metadataStandard,
          runtime,
        }),
        runtime,
      } as AgentLoadDiagnostic;
    });

    return {
      validation: this.getRegistryValidationReport(),
      agents,
    };
  }

  /** Worker loop indítása – sor feldolgozás */
  startWorkerLoop(): void {
    if (this.workerInterval) return;
    this.workerInterval = setInterval(async () => {
      if (this.workerLoopBusy) return;
      this.workerLoopBusy = true;
      try {
        await this.processPendingTasksBatch(getOrchestrationConcurrencyLimit(), true);
      } catch (e: any) {
        logError("AgentManager", `Worker loop error: ${e.message}`);
      } finally {
        this.workerLoopBusy = false;
      }
    }, 2000);
    logInfo(
      "AgentManager",
      `Worker loop started (maxConcurrent=${getOrchestrationConcurrencyLimit()}, profile=${getOrchestrationConcurrencyConfig().profile})`,
    );
  }

  /** Worker loop leállítása graceful shutdown-hoz */
  stopWorkerLoop(): void {
    if (this.workerInterval) {
      clearInterval(this.workerInterval);
      this.workerInterval = undefined;
      logInfo("AgentManager", "Worker loop stopped");
    }
  }

  /** Terv készítése (Orchestrator hívás) */
  async createPlan(
    userMessage: string,
  ): Promise<{ taskIds: number[]; taskDescriptions?: string[] }> {
    const orchestrator = this.agents.get("Orchestrator");
    if (!orchestrator) return { taskIds: [], taskDescriptions: [] };
    const out = await orchestrator.execute(userMessage);

    // Type guard for orchestrator output
    if (typeof out === "object" && out !== null) {
      const outObj = out as Record<string, unknown>;
      const taskIds = Array.isArray(outObj["taskIds"])
        ? (outObj["taskIds"] as number[])
        : [];
      return { taskIds, taskDescriptions: [] };
    }

    return { taskIds: [], taskDescriptions: [] };
  }

  /** Terv végrehajtása */
  async executePlan(
    plan: { taskIds: number[] },
    emit: (event: string, data: unknown) => void,
  ): Promise<string> {
    const parts: string[] = [];
    for (const id of plan.taskIds) {
      const t = this.taskQueue.find((q) => q.id === id);
      if (!t || t.status !== "pending") continue;
      emit("task_start", {
        id,
        description: t.description,
        agentName: t.agentName,
      });
      try {
        const result = await this.executeAgentWithRetry(
          t.agentName,
          t.description,
          t.context,
        );

        if (result.success) {
          t.status = "done";
          const text =
            typeof result === "object"
              ? JSON.stringify(result)
              : String(result);
          parts.push(`[${t.agentName}]: ${text}`);
          emit("task_done", { id, result });
        } else {
          t.status = "error";
          parts.push(`[${t.agentName}]: Error: ${result.message}`);
          emit("task_error", { id, error: result.message });
        }
      } catch (e: any) {
        t.status = "error";
        parts.push(`[${t.agentName}]: Exception: ${e.message}`);
        emit("task_error", { id, error: e.message });
      }
    }
    return parts.join("\n\n");
  }

  // --------------------------------------------------------------------------
  // CONFIGURATION LOADERS
  // --------------------------------------------------------------------------

  private async loadRegistryAsync(): Promise<RegistryConfig> {
    // Dynamic imports for Node.js-specific modules (Worker compatibility)
    if (typeof process === "undefined" || !process.versions?.node) {
      // Fallback for Worker environments
      return {
        version: "1.0.0",
        agents: [],
        defaultAgent: "orchestrator",
        routingRules: [],
      };
    }

    try {
      // Use async dynamic imports
      const path = await import("path");
      const fs = await import("fs");

      const registryPath = path.default.resolve(
        process.cwd(),
        "build",
        "agents",
        "registry.json",
      );

      if (fs.default.existsSync(registryPath)) {
        const content = fs.default.readFileSync(registryPath, "utf-8");
        const { registry, report } = validateAndNormalizeRegistry(JSON.parse(content));
        this.registryValidationReport = report;
        return registry;
      }
    } catch (e) {
      logError("AgentManager", `Registry load failed: ${e}`);
    }

    // Fallback
    return {
      version: "1.0.0",
      agents: [],
      defaultAgent: "orchestrator",
      routingRules: [],
    };
  }

  private loadRegistry(): RegistryConfig {
    // Note: This is called from constructor, which cannot be async
    // So we use a simplified version here and rely on the registry being optional
    const { registry, report } = validateAndNormalizeRegistry({
      version: "1.0.0",
      agents: [],
      defaultAgent: "orchestrator",
      routingRules: [],
    });
    this.registryValidationReport = report;
    return registry;
  }

  private loadEdgeConfig(): EdgeConfig {
    return {
      enabled: process.env.EDGE_ENABLED === "true",
      workerUrl:
        process.env.CLOUDFLARE_WORKER_URL ||
        "https://bas-orchestrator.workers.dev",
      tunnelEnabled: process.env.CLOUDFLARE_TUNNEL_ENABLED === "true",
      fallbackToLocal: process.env.EDGE_FALLBACK_TO_LOCAL !== "false",
      healthCheckInterval: parseInt(
        process.env.EDGE_HEALTH_CHECK_INTERVAL || "30000",
      ),
    };
  }
}

export const agentManager = new AgentManager(); // Initialize singleton with undefined socketService (can be set later)

export function initializeAgentManager(socketService: SocketServiceClass): AgentManager {
  agentManager.socketService = socketService; // Set the socketService
  return agentManager;
}

export const swarmManager = new SwarmManager();
// Initialize Triad colony (default colony for swarm_dispatch MCP tool)
const triadConfig = SwarmManager.getTriadConfig();
swarmManager.createColony({
  swarmId: 'triad-default',
  name: triadConfig.name,
  objective: 'General purpose: research, data analysis, development',
});
logInfo('System', `Triad colony initialized: ${triadConfig.agentIds.join(', ')}`);

export default AgentManager;
