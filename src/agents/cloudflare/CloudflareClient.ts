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

// ============================================================================
// INTERFACES
// ============================================================================

interface TaskSubmitResult {
  taskId: string;
  status: "pending" | "running" | "success" | "error";
}

interface TaskStatusResult {
  status: "pending" | "running" | "success" | "error";
  progress?: number;
  currentStep?: string;
  result?: any;
  error?: string;
}

interface ChatResponse {
  response: string;
  model?: string;
}

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
    } catch (error: any) {
      logError("CloudflareClient", `Initialization failed: ${error.message}`);
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

      // Extract task ID from result data
      const taskId = (result.data as any)?.task?.taskId || this.generateTaskId();

      return {
        taskId,
        status: "pending",
      };
    } catch (error: any) {
      logError("CloudflareClient", `submitTask error: ${error.message}`);
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

      return {
        status: taskStatus.status as any,
        result: taskStatus.result,
        // Mock progress calculation based on status
        progress:
          taskStatus.status === "completed"
            ? 100
            : taskStatus.status === "pending"
              ? 0
              : 50,
        currentStep:
          taskStatus.status === "dispatched"
            ? "Processing..."
            : taskStatus.status,
      };
    } catch (error: any) {
      logError("CloudflareClient", `checkStatus error: ${error.message}`);
      return {
        status: "error",
        error: error.message,
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
  async chat(
    instruction: string,
    history?: any[],
  ): Promise<ChatResponse> {
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

      // Extract response from result
      const response =
        (result.data as any)?.task?.result ||
        result.message ||
        "Response received";

      return {
        response,
        model: "cloudflare-worker-ai",
      };
    } catch (error: any) {
      logError("CloudflareClient", `chat error: ${error.message}`);
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
  getHealthStatus() {
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
}

// Export singleton instance
export const cloudflareClient = new CloudflareClientClass();
