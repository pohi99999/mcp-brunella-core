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
  clearCheckpoints,
  type CheckpointState,
} from "../core/checkpoint.js";
import { gitAutoCheckpoint, logRecoveryEvent } from "../core/gitRecovery.js";
import { autoSaveGoldenSample } from "../core/goldenDatasetBridge.js";
import { phoenixEventBus } from "../core/phoenixEventBus.js";
import { failoverRegistry } from "../core/failoverRegistry.js";
import {
  traceAgentExecution,
  type TraceContext,
} from "../utils/agentTracer.js";
import { recordAgentExecution } from "../utils/metrics.js";
import { checkToolPermission } from "../tools/toolPermissions.js";
import { record as auditRecord } from "../core/auditLog.js";
import { getPendingFixes, updateFixStatus } from "../utils/fixQueue.js";
import { SocketServiceClass } from "../server/SocketService.js"; // Import SocketServiceClass type
import type { IAgent } from "./types.js";
import { formatResponse } from "../utils/responseFormatter.js";

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

type AgentRuntimeStatus = "idle" | "working" | "error";

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
  status: "pending" | "running" | "done" | "error" | "cancelled" | "paused";
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
  private circuitBreakers: Map<
    string,
    { failures: number; lastFailure: number; isOpen: boolean }
  > = new Map();
  private activeExecutions: Map<number, AbortController> = new Map(); // Új: futó feladatok megszakíthatósága
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
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------

  async initialize(): Promise<void> {
    logInfo("AgentManager", "Inicializálás...");

    // Load registry asynchronously if in Node environment
    if (typeof process !== "undefined" && process.versions?.node) {
      this.registry = await this.loadRegistryAsync();
    }

    // Ügynökök betöltése
    for (const agentConfig of this.registry.agents) {
      try {
        await this.loadAgent(agentConfig);
      } catch (error) {
        logError(
          "AgentManager",
          `Ügynök betöltési hiba (${agentConfig.name}): ${error}`,
        );
      }
    }

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
      logError("AgentManager", "loadAgent() requires Node.js environment");
      return;
    }

    // Skip if module is not defined (e.g. planned agents)
    if (!config.module) {
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
      logError("AgentManager", `Modul nem található: ${modulePath}`);
      return;
    }

    // Convert Windows path to file:// URL for ESM import
    const moduleUrl = url.pathToFileURL(modulePath).href;

    // Use moduleUrl instead of modulePath for import
    const AgentClass = (await import(moduleUrl)).default;
    const agent = new AgentClass(config.config);

    agent.name = config.name;
    agent.description = config.description;
    agent.systemPrompt = config.systemPrompt;

    this.agents.set(config.name, agent);
    this.ensureAgentRuntime(config.name);
    logInfo(
      "AgentManager",
      `Ügynök betöltve: ${config.name}. Jelenlegi kulcsok: ${[...this.agents.keys()].join(", ")}`,
    );
  }

  private ensureAgentRuntime(agentName: string): AgentRuntimeInfo {
    if (!this.agentRuntime.has(agentName)) {
      this.agentRuntime.set(agentName, {
        status: "idle",
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
    this.agentRuntime.set(agentName, { ...current, ...updates });
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

      // RULE-OB1: End trace span on success
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
          message: `Service degraded after ${MAX_RECOVERY_ATTEMPTS} recovery attempts: ${errorMsg}`,
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
          message: `Service degraded after ${MAX_RECOVERY_ATTEMPTS} recovery attempts: ${errorMsg}`,
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
      message: 'Unexpected recovery loop exit',
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
    const lowerInstruction = instruction.toLowerCase();

    // Routing szabályok ellenőrzése
    for (const rule of this.registry.routingRules) {
      const regex = new RegExp(rule.pattern, "i");
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
    this.ensureAgentRuntime(agent.name);
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

    // HOTFIX: If the agent is Orchestrator, we must create AND execute the plan.
    if (agentName.toLowerCase() === "orchestrator") {
      logInfo(
        "AgentManager",
        "Orchestrator delegation detected. Running full plan-and-execute cycle.",
      );
      try {
        const plan = await this.createPlan(task);
        if (!plan || plan.taskIds.length === 0) {
          return {
            success: true,
            message: "A terv nem tartalmazott végrehajtható lépéseket.",
          };
        }

        const noOpEmit = (event: string, data: any) => {};
        const finalResult = await this.executePlan(plan, noOpEmit);

        return {
          success: true,
          message: "A terv végrehajtása befejeződött.",
          data: finalResult,
        };
      } catch (e: any) {
        logError(
          "AgentManager",
          `Orchestrator plan/execute hiba: ${e.message}`,
        );
        throw e;
      }
    }

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
      throw new Error(result.message || "Delegation failed");
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

  /** Egy pending feladat azonnali feldolgozása */
  async processPendingTasks(): Promise<{
    taskId?: number;
    status: string;
    message?: string;
  } | null> {
    const pending = this.taskQueue.find((t) => t.status === "pending");
    if (!pending) return null;

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

  /** Worker loop indítása – sor feldolgozás */
  startWorkerLoop(): void {
    if (this.workerInterval) return;
    this.workerInterval = setInterval(async () => {
      const pending = this.taskQueue.find((t) => t.status === "pending");
      if (!pending) return;
      pending.status = "running";
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

        if (result.success) {
          this.emit("task_done", { task: pending, result });
        } else {
          logError(
            "AgentManager",
            `Task ${pending.id} failed: ${result.message}`,
          );
        }
      } catch (e: any) {
        pending.status = "error";
        await updateTaskStatus(pending.id, "error", e.message);
        logError("AgentManager", `Task ${pending.id} error: ${e.message}`);
      }
    }, 2000);
    logInfo("AgentManager", "Worker loop started");
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
        defaultAgent: "Orchestrator",
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
        return JSON.parse(content);
      }
    } catch (e) {
      logError("AgentManager", `Registry load failed: ${e}`);
    }

    // Fallback
    return {
      version: "1.0.0",
      agents: [],
      defaultAgent: "Orchestrator",
      routingRules: [],
    };
  }

  private loadRegistry(): RegistryConfig {
    // Note: This is called from constructor, which cannot be async
    // So we use a simplified version here and rely on the registry being optional
    return {
      version: "1.0.0",
      agents: [],
      defaultAgent: "Orchestrator",
      routingRules: [],
    };
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

export default AgentManager;
