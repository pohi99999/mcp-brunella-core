/**
 * CloudflareClient - WebSocket-aware wrapper for EdgeProxyAgent
 *
 * This class provides a simplified API for interacting with Cloudflare Workers
 * from the WebSocket event handlers. It wraps EdgeProxyAgent and provides
 * methods optimized for real-time communication.
 *
 * @author Brunella Core Team
 * @version 1.0.0
 */

import { EdgeProxyAgent } from "../EdgeProxyAgent.js";
import { AgentContext } from "../BaseAgent.js";
import { logInfo, logError } from "../../utils/logger.js";
import { ensureError } from "../../utils/ensureError.js";

// ============================================================================
// INTERFACES
// ============================================================================

interface TaskSubmitResult {
  taskId: string;
  status: "pending" | "running" | "success" | "error";
}

interface TaskStatusResult {
  status: string;
  progress?: number;
  currentStep?: string;
  result?: unknown;
  error?: string;
}

interface ChatResponse {
  response: string;
  model?: string;
}

type JsonRecord = Record<string, unknown>;

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

class CloudflareClientClass {
  private edgeAgent: EdgeProxyAgent;
  private initialized = false;

  constructor() {
    this.edgeAgent = new EdgeProxyAgent();
  }

  /**
   * Initialize the Cloudflare client
   * This should be called once during server startup
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.edgeAgent.initialize();
      this.initialized = true;
      logInfo("CloudflareClient", "Initialized successfully");
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("CloudflareClient", `Initialization failed: ${err.message}`);
      throw error;
    }
  }

  /**
   * Submit a task to the Cloudflare Worker
   *
   * @param instruction - Task instruction text
   * @returns Task ID and initial status
   */
  async submitTask(instruction: string): Promise<TaskSubmitResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const context: AgentContext = {
        task: instruction,
        context: {},
      };

      const result = await this.edgeAgent.submitTask(context);

      if (!result.success) {
        throw new Error(result.message || "Task submission failed");
      }

      const taskId = this.extractTaskId(result.data) ?? this.generateTaskId();

      return {
        taskId,
        status: "pending",
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("CloudflareClient", `submitTask error: ${err.message}`);
      throw error;
    }
  }

  /**
   * Check the status of a task
   *
   * @param taskId - Task ID to query
   * @returns Task status with progress and result
   */
  async checkStatus(taskId: string): Promise<TaskStatusResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const taskStatus = await this.edgeAgent.getTaskStatus(taskId);

      if (!taskStatus) {
        return {
          status: "error",
          error: "Task not found",
        };
      }

      const status = this.normalizeStatus(taskStatus.status);

      return {
        status,
        result: taskStatus.result,
        // Mock progress calculation based on status
        progress: this.getProgressForStatus(status),
        currentStep: this.getCurrentStepForStatus(status),
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("CloudflareClient", `checkStatus error: ${err.message}`);
      return {
        status: "error",
        error: err.message,
      };
    }
  }

  /**
   * Send a chat message to the Cloudflare Worker AI
   *
   * @param instruction - Chat message text
   * @param history - Optional conversation history
   * @returns Chat response from Worker AI
   */
  async chat(instruction: string, history?: unknown[]): Promise<ChatResponse> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // For now, use submitTask with a special chat format
      // In future, this will be a dedicated /chat endpoint on the Worker
      const context: AgentContext = {
        task: `[CHAT] ${instruction}`,
        context: { history },
      };

      const result = await this.edgeAgent.submitTask(context);

      if (!result.success) {
        throw new Error(result.message || "Chat request failed");
      }

      const response = this.extractChatResponse(result.data, result.message);

      return {
        response,
        model: "cloudflare-worker-ai",
      };
    } catch (error: unknown) {
      const err = ensureError(error);
      logError("CloudflareClient", `chat error: ${err.message}`);
      throw error;
    }
  }

  /**
   * Check if the Cloudflare Worker is healthy
   *
   * @returns Health status
   */
  async isHealthy(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    return this.edgeAgent.isEdgeHealthy();
  }

  /**
   * Get health status details
   */
  getHealthStatus(): ReturnType<EdgeProxyAgent["getHealth"]> {
    return this.edgeAgent.getHealth();
  }

  /**
   * Shutdown the client gracefully
   */
  async shutdown(): Promise<void> {
    if (this.initialized) {
      await this.edgeAgent.shutdown();
      this.initialized = false;
      logInfo("CloudflareClient", "Shutdown complete");
    }
  }

  // --------------------------------------------------------------------------
  // PRIVATE HELPERS
  // --------------------------------------------------------------------------

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private normalizeStatus(status: unknown): string {
    return typeof status === "string" && status.trim().length > 0 ? status : "unknown";
  }

  private getProgressForStatus(status: string): number {
    if (status === "completed" || status === "success") {
      return 100;
    }

    if (status === "pending") {
      return 0;
    }

    return 50;
  }

  private getCurrentStepForStatus(status: string): string {
    return status === "dispatched" ? "Processing..." : status;
  }

  private extractTaskId(data: unknown): string | undefined {
    if (!this.isRecord(data)) {
      return undefined;
    }

    const directTaskId = this.pickString(data.taskId, data.id);
    if (directTaskId) {
      return directTaskId;
    }

    const nestedTask = this.isRecord(data.task) ? data.task : undefined;
    return nestedTask ? this.pickString(nestedTask.taskId, nestedTask.id) : undefined;
  }

  private extractChatResponse(data: unknown, fallbackMessage: string): string {
    if (this.isRecord(data)) {
      const nestedTask = this.isRecord(data.task) ? data.task : undefined;
      const nestedResult = nestedTask?.result;
      if (typeof nestedResult === "string" && nestedResult.trim().length > 0) {
        return nestedResult;
      }

      const directResult = data.result;
      if (typeof directResult === "string" && directResult.trim().length > 0) {
        return directResult;
      }
    }

    return fallbackMessage || "Response received";
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === "object" && value !== null;
  }

  private pickString(...values: unknown[]): string | undefined {
    for (const value of values) {
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }

    return undefined;
  }
}

// Export singleton instance
export const cloudflareClient = new CloudflareClientClass();
