/**
 * Enterprise Orchestrator - Central Router for 14 Enterprise Modules
 *
 * Manages all enterprise operations:
 * - HR (Recruitment, Mediation, CSR)
 * - Finance (Guardian, Grant Hunter)
 * - Sales (Agent, Pricing, Negotiation)
 * - Logistics (Dispatch, Knowledge)
 * - Intelligence (Compliance, Content)
 */

import { IAgent, AgentResponse } from './types.js';
import { logInfo, logError, logWarn, setAgentStatus } from '../utils/logger.js';
import Database from 'better-sqlite3';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export type ModuleType =
  | 'HR_RECRUITER'
  | 'HR_MEDIATOR'
  | 'HR_CSR'
  | 'FINANCE_GUARDIAN'
  | 'FINANCE_GRANT_HUNTER'
  | 'SALES_AGENT'
  | 'SALES_PRICING'
  | 'SALES_NEGOTIATION'
  | 'LOGISTICS_DISPATCHER'
  | 'LOGISTICS_KNOWLEDGE'
  | 'INTELLIGENCE_COMPLIANCE'
  | 'INTELLIGENCE_CONTENT'
  | 'INTELLIGENCE_SENTIMENT'
  | 'SYSTEM_ARCHIVER';

export type PriorityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface EnterpriseEvent {
  id: string;
  module: ModuleType;
  type: string;
  payload: unknown; // Strict Runtime Validation!
  priority: PriorityLevel;
  storedInLanceDB: boolean;
  timestamp: Date;
  requestId: string;
  retries: number;
  lastError?: string;
}

export interface ModuleRegistry {
  id: ModuleType;
  agent: IAgent;
  status: 'active' | 'inactive' | 'error';
  lastExecution?: Date;
  errorCount: number;
}

export interface ExecutionResult {
  moduleId: ModuleType;
  eventId: string;
  status: 'success' | 'failure' | 'queued';
  startTime: Date;
  endTime: Date;
  durationMs: number;
  result?: unknown;
  error?: string;
}

// ============================================================================
// ENTERPRISE ORCHESTRATOR CLASS
// ============================================================================

export class EnterpriseOrchestrator implements IAgent {
  name = 'EnterpriseOrchestrator';
  role = 'Central Event Router & Module Manager';
  description =
    'Orchestrates 14 enterprise modules (HR, Finance, Sales, Logistics, Intelligence)';
  capabilities = [
    'module_registration',
    'event_routing',
    'priority_queueing',
    'error_recovery',
    'performance_monitoring',
  ];

  // Module Registry (14 modules max)
  private modules = new Map<ModuleType, ModuleRegistry>();

  // Event Queue with Priority
  private eventQueue: EnterpriseEvent[] = [];
  private isProcessing = false;
  private eventProcessingInterval: NodeJS.Timer | null = null;

  // Database for audit logging
  private auditDB: Database.Database;

  // Circuit Breaker Pattern
  private circuitBreakers = new Map<ModuleType, CircuitBreaker>();

  // Metrics
  private metrics = {
    totalEventsProcessed: 0,
    totalSuccesses: 0,
    totalFailures: 0,
    averageLatencyMs: 0,
    moduleExecutionTimes: new Map<ModuleType, number[]>(),
  };

  constructor(dbPath: string = '_br_temp/enterprise_audit.db') {
    setAgentStatus(this.name, 'initializing', 'Setting up orchestrator');

    // Initialize audit database
    this.auditDB = new Database(dbPath);
    this.initializeAuditSchema();

    // Initialize circuit breakers for each module type
    this.initializeCircuitBreakers();

    logInfo(this.name, '✅ EnterpriseOrchestrator initialized');
    setAgentStatus(this.name, 'idle', 'Ready');
  }

  /**
   * Register a module (agent) in the orchestrator
   */
  async registerModule(
    moduleId: ModuleType,
    agent: IAgent
  ): Promise<AgentResponse> {
    try {
      setAgentStatus(
        this.name,
        'working',
        `Registering module: ${moduleId}`
      );

      if (this.modules.has(moduleId)) {
        logWarn(this.name, `Module ${moduleId} already registered, updating...`);
      }

      this.modules.set(moduleId, {
        id: moduleId,
        agent,
        status: 'active',
        errorCount: 0,
      });

      // Initialize empty execution times array
      if (!this.metrics.moduleExecutionTimes.has(moduleId)) {
        this.metrics.moduleExecutionTimes.set(moduleId, []);
      }

      logInfo(this.name, `✅ Module registered: ${moduleId}`);

      return {
        status: 'success',
        data: {
          moduleId,
          agentName: agent.name,
          capabilities: agent.capabilities,
        },
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return {
        status: 'error',
        error: `Failed to register module ${moduleId}: ${error}`,
      };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Enqueue and route an event to the appropriate module
   */
  async routeEvent(event: Omit<EnterpriseEvent, 'id' | 'timestamp' | 'retries'>): Promise<AgentResponse> {
    try {
      setAgentStatus(this.name, 'working', `Routing event to ${event.module}`);

      // Validate module exists
      if (!this.modules.has(event.module)) {
        logError(this.name, `Module not found: ${event.module}`);
        return {
          status: 'error',
          error: `Module ${event.module} not registered`,
        };
      }

      // Create event with metadata
      const fullEvent: EnterpriseEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
        retries: 0,
        ...event,
      };

      // Add to queue (sorted by priority)
      this.eventQueue.push(fullEvent);
      this.eventQueue.sort((a, b) => this.priorityScore(b.priority) - this.priorityScore(a.priority));

      logInfo(this.name, `📬 Event queued: ${fullEvent.id} (${event.module})`);

      // Trigger processing
      this.processQueue();

      return {
        status: 'success',
        data: { eventId: fullEvent.id, queueSize: this.eventQueue.length },
      };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError(this.name, error);
      return { status: 'error', error };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }

  /**
   * Execute a module task directly (bypass queue)
   */
  async executeModuleTask(
    moduleId: ModuleType,
    task: unknown
  ): Promise<ExecutionResult> {
    const startTime = new Date();

    try {
      const module = this.modules.get(moduleId);
      if (!module) {
        throw new Error(`Module ${moduleId} not found`);
      }

      // Check circuit breaker
      const breaker = this.circuitBreakers.get(moduleId);
      if (breaker && !breaker.isHealthy()) {
        throw new Error(
          `Circuit breaker open for ${moduleId} (error threshold exceeded)`
        );
      }

      logInfo(this.name, `🚀 Executing: ${moduleId}`);

      const response = await module.agent.execute(
        JSON.stringify(task),
        { moduleId }
      );

      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();

      const agentResponse = response as AgentResponse;
      if (agentResponse.status === 'success') {
        this.metrics.totalSuccesses++;
        module.lastExecution = endTime;
        module.errorCount = 0;

        // Reset circuit breaker
        breaker?.recordSuccess();

        logInfo(
          this.name,
          `✅ Module executed: ${moduleId} (${durationMs}ms)`
        );

        // Track metrics
        const times = this.metrics.moduleExecutionTimes.get(moduleId) || [];
        times.push(durationMs);
        if (times.length > 100) times.shift(); // Keep last 100
        this.metrics.moduleExecutionTimes.set(moduleId, times);

        return {
          moduleId,
          eventId: '',
          status: 'success',
          startTime,
          endTime,
          durationMs,
          result: agentResponse.data,
        };
      } else {
        throw new Error(agentResponse.error || 'Unknown error');
      }
    } catch (e: unknown) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      const error = e instanceof Error ? e.message : String(e);

      // Update circuit breaker
      const breaker = this.circuitBreakers.get(moduleId);
      breaker?.recordFailure();

      const module = this.modules.get(moduleId);
      if (module) {
        module.errorCount++;
        module.status = module.errorCount > 5 ? 'error' : 'active';
      }

      logError(this.name, `❌ Module execution failed: ${moduleId}: ${error}`);

      return {
        moduleId,
        eventId: '',
        status: 'failure',
        startTime,
        endTime,
        durationMs,
        error,
      };
    }
  }

  /**
   * Get orchestrator health status (all modules)
   */
  async getHealthStatus(): Promise<AgentResponse> {
    try {
      type HealthStatus = 'healthy' | 'degraded';
      let healthStatus: HealthStatus = 'healthy';
      
      const health = {
        timestamp: new Date(),
        status: healthStatus,
        modules: Array.from(this.modules.entries()).map(([id, module]) => ({
          id,
          status: module.status,
          lastExecution: module.lastExecution,
          errorCount: module.errorCount,
          isCircuitBreakerOpen: !this.circuitBreakers.get(id)?.isHealthy(),
        })),
        queue: {
          size: this.eventQueue.length,
          oldestEventAge: this.eventQueue.length > 0
            ? Date.now() - this.eventQueue[0].timestamp.getTime()
            : 0,
        },
        metrics: {
          totalEventsProcessed: this.metrics.totalEventsProcessed,
          successRate: this.metrics.totalEventsProcessed > 0
            ? ((this.metrics.totalSuccesses / this.metrics.totalEventsProcessed) * 100).toFixed(2) + '%'
            : 'N/A',
          averageLatencyMs: this.metrics.averageLatencyMs.toFixed(2),
        },
      };

      // Mark unhealthy if any module is down
      if (
        Array.from(this.modules.values()).some((m) => m.status === 'error')
      ) {
        healthStatus = 'degraded';
      }

      return { status: 'success', data: { ...health, status: healthStatus } };
    } catch (_e: unknown) {
      return { status: 'error', error: 'Failed to get health status' };
    }
  }

  /**
   * Main scheduler task (implements IAgent interface)
   */
  async execute(task: string, _context?: unknown): Promise<AgentResponse> {
    try {
      const parsed = JSON.parse(task);

      switch (parsed.action) {
        case 'route_event':
          return await this.routeEvent(parsed.event);
        case 'get_health':
          return await this.getHealthStatus();
        case 'process_queue':
          await this.processQueue();
          return { status: 'success', data: { processed: true } };
        default:
          return { status: 'error', error: `Unknown action: ${parsed.action}` };
      }
    } catch (_e: unknown) {
      const error = _e instanceof Error ? _e.message : String(_e);
      logError(this.name, error);
      return { status: 'error', error };
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private priorityScore(priority: PriorityLevel): number {
    const scores: Record<PriorityLevel, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };
    return scores[priority];
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.eventQueue.length > 0) {
        const event = this.eventQueue.shift();
        if (!event) break;

        const result = await this.executeModuleTask(event.module, event.payload);

        // Audit log
        this.auditLog({
          eventId: event.id,
          moduleId: event.module,
          status: result.status,
          durationMs: result.durationMs,
          error: result.error,
        });

        // Update metrics
        this.metrics.totalEventsProcessed++;
        const allTimes: number[] = [];
        this.metrics.moduleExecutionTimes.forEach((times) => {
          allTimes.push(...times);
        });
        this.metrics.averageLatencyMs =
          allTimes.length > 0
            ? allTimes.reduce((a, b) => a + b, 0) / allTimes.length
            : 0;

        // Retry logic (Phoenix Protocol)
        if (result.status === 'failure' && event.retries < 3) {
          event.retries++;
          event.lastError = result.error;
          this.eventQueue.unshift(event); // Re-queue for retry
          logWarn(
            this.name,
            `🔄 Retrying event ${event.id} (attempt ${event.retries}/3)`
          );
          await new Promise((r) => setTimeout(r, 1000 * event.retries)); // Exponential backoff
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }

  private initializeAuditSchema(): void {
    try {
      this.auditDB.exec(`
        CREATE TABLE IF NOT EXISTS enterprise_audit_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          event_id TEXT NOT NULL,
          module_id TEXT NOT NULL,
          status TEXT NOT NULL,
          duration_ms REAL,
          error TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_event_id ON enterprise_audit_log(event_id);
        CREATE INDEX IF NOT EXISTS idx_module_id ON enterprise_audit_log(module_id);
      `);
    } catch (e: unknown) {
      logWarn(this.name, `Audit DB already initialized or error creating schema`);
    }
  }

  private auditLog(record: {
    eventId: string;
    moduleId: ModuleType;
    status: string;
    durationMs: number;
    error?: string;
  }): void {
    try {
      const stmt = this.auditDB.prepare(`
        INSERT INTO enterprise_audit_log (event_id, module_id, status, duration_ms, error)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(
        record.eventId,
        record.moduleId,
        record.status,
        record.durationMs,
        record.error || null
      );
    } catch (e: unknown) {
      logWarn(this.name, `Failed to audit log: ${e}`);
    }
  }

  private initializeCircuitBreakers(): void {
    const modules: ModuleType[] = [
      'HR_RECRUITER',
      'HR_MEDIATOR',
      'HR_CSR',
      'FINANCE_GUARDIAN',
      'FINANCE_GRANT_HUNTER',
      'SALES_AGENT',
      'SALES_PRICING',
      'SALES_NEGOTIATION',
      'LOGISTICS_DISPATCHER',
      'LOGISTICS_KNOWLEDGE',
      'INTELLIGENCE_COMPLIANCE',
      'INTELLIGENCE_CONTENT',
      'INTELLIGENCE_SENTIMENT',
      'SYSTEM_ARCHIVER',
    ];

    modules.forEach((moduleId) => {
      this.circuitBreakers.set(
        moduleId,
        new CircuitBreaker(moduleId, 5, 60000) // 5 failures = open, reset after 60s
      );
    });
  }
}

// ============================================================================
// CIRCUIT BREAKER PATTERN (Error Recovery)
// ============================================================================

class CircuitBreaker {
  private failureCount = 0;
  private successCount = 0;
  private isOpen = false;
  private lastFailureTime = 0;

  constructor(
    private moduleId: string,
    private failureThreshold: number,
    private resetTimeout: number
  ) {}

  recordSuccess(): void {
    this.failureCount = 0;
    this.successCount++;
    if (this.isOpen) {
      logInfo('CircuitBreaker', `✅ CB reset: ${this.moduleId}`);
      this.isOpen = false;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.isOpen = true;
      logWarn(
        'CircuitBreaker',
        `⚠️ CB opened: ${this.moduleId} (${this.failureCount} failures)`
      );
    }
  }

  isHealthy(): boolean {
    if (!this.isOpen) return true;

    // Check if reset timeout has passed
    if (Date.now() - this.lastFailureTime > this.resetTimeout) {
      this.failureCount = 0;
      this.isOpen = false;
      logInfo('CircuitBreaker', `🔄 CB attempting reset: ${this.moduleId}`);
      return true;
    }

    return false;
  }
}

export default EnterpriseOrchestrator;
