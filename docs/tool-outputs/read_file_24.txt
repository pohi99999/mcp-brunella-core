import { Server, Socket } from "socket.io";
import { logInfo, logError } from "../utils/logger.js";
import { cloudflareClient } from "../agents/cloudflare/CloudflareClient.js";
import { agentManager } from "../agents/AgentManager.js";

/**
 * Register Cloudflare Edge WebSocket event handlers
 *
 * This function sets up real-time WebSocket communication between
 * the Dashboard and Cloudflare Workers AI.
 *
 * Events:
 * - edge:task:submit - Submit a task to the Worker
 * - edge:chat:message - Send a chat message to Worker LLM
 * - edge:status:query - Query task status by taskId
 *
 * @param io - Socket.IO Server instance
 */
export function registerEdgeWebSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logInfo("EdgeWebSocket", `Client connected: ${socket.id}`);

    /**
     * Event: edge:task:submit
     * Client submits a task instruction to the Cloudflare Worker
     *
     * Payload: { instruction: string }
     * Response: edge:task:submitted { taskId, status }
     * Progress: edge:task:progress { taskId, progress, status }
     * Complete: edge:task:complete { taskId, result, status }
     */
    socket.on("edge:task:submit", async (data: { instruction: string }) => {
      try {
        logInfo("EdgeWebSocket", `Task submit: ${data.instruction}`);

        // Call Cloudflare Worker to submit task
        const { taskId } = await cloudflareClient.submitTask(data.instruction);

        // Emit task submitted confirmation
        socket.emit("edge:task:submitted", {
          taskId,
          status: "pending",
          instruction: data.instruction,
        });

        // Poll for progress updates (in future, Worker will push via WebSocket)
        const progressInterval = setInterval(async () => {
          try {
            const status = await cloudflareClient.checkStatus(taskId);

            // Emit progress update
            socket.emit("edge:task:progress", {
              taskId,
              progress: status.progress || 0,
              status: status.status,
              currentStep: status.currentStep,
            });

            // Stop polling when task completes or fails
            if (status.status === "success" || status.status === "error") {
              clearInterval(progressInterval);

              socket.emit("edge:task:complete", {
                taskId,
                result: status.result,
                status: status.status,
                error: status.error,
              });

              logInfo(
                "EdgeWebSocket",
                `Task ${taskId} completed: ${status.status}`,
              );
            }
          } catch (error: any) {
            clearInterval(progressInterval);
            logError("EdgeWebSocket", `Progress poll error: ${error.message}`);
            socket.emit("edge:task:error", {
              taskId,
              error: error.message,
            });
          }
        }, 2000); // Poll every 2 seconds

        // Cleanup interval on disconnect
        socket.on("disconnect", () => {
          clearInterval(progressInterval);
        });
      } catch (error: any) {
        logError("EdgeWebSocket", `Task submit error: ${error.message}`);
        socket.emit("edge:task:error", {
          error: error.message,
        });
      }
    });

    /**
     * Event: edge:chat:message
     * Client sends a chat message to the Cloudflare Worker LLM
     *
     * Payload: { instruction: string, history?: any[] }
     * Response: edge:chat:response { response }
     * Error: edge:chat:error { error }
     */
    socket.on(
      "edge:chat:message",
      async (data: { instruction: string; history?: any[] }) => {
        try {
          logInfo("EdgeWebSocket", `Chat message: ${data.instruction}`);

          // Call Cloudflare Worker to process chat
          const response = await cloudflareClient.chat(
            data.instruction,
            data.history,
          );

          // Emit chat response
          socket.emit("edge:chat:response", {
            response,
            timestamp: Date.now(),
          });
        } catch (error: any) {
          logError("EdgeWebSocket", `Chat error: ${error.message}`);
          socket.emit("edge:chat:error", {
            error: error.message,
          });
        }
      },
    );

    /**
     * Event: edge:status:query
     * Client queries the status of a specific task
     *
     * Payload: { taskId: string }
     * Response: edge:status:response { taskId, status, result, progress }
     * Error: edge:status:error { error }
     */
    socket.on("edge:status:query", async (data: { taskId: string }) => {
      try {
        logInfo("EdgeWebSocket", `Status query: ${data.taskId}`);

        // Query task status from Cloudflare Worker
        const status = await cloudflareClient.checkStatus(data.taskId);

        // Emit status response
        socket.emit("edge:status:response", {
          taskId: data.taskId,
          status: status.status,
          result: status.result,
          progress: status.progress,
          currentStep: status.currentStep,
          error: status.error,
        });
      } catch (error: any) {
        logError("EdgeWebSocket", `Status query error: ${error.message}`);
        socket.emit("edge:status:error", {
          taskId: data.taskId,
          error: error.message,
        });
      }
    });

    /**
     * Event: disconnect
     * Clean up resources when client disconnects
     */
    socket.on("disconnect", () => {
      logInfo("EdgeWebSocket", `Client disconnected: ${socket.id}`);
    });
  });

  logInfo("EdgeWebSocket", "Edge WebSocket handlers registered ✅");
}

/**
 * Register CEAN Orchestrator Chat WebSocket handlers
 *
 * Events:
 * - cean:orchestrator:prompt - User sends prompt to OrchestratorAgent
 * - cean:orchestrator:response - Agent sends response back to client
 *
 * @param io - Socket.IO Server instance
 */
export function registerCEANWebSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    /**
     * Event: cean:orchestrator:prompt
     * Client sends a prompt to the Orchestrator Agent
     *
     * Payload: { prompt: string, timestamp: number }
     * Response: cean:orchestrator:response { content, taskId?, error? }
     */
    socket.on(
      "cean:orchestrator:prompt",
      async (data: { prompt: string; timestamp: number }) => {
        try {
          logInfo("CEANChat", `Prompt received: ${data.prompt.slice(0, 50)}`);

          // Get OrchestratorAgent and execute prompt
          const orchestrator = agentManager.getAgent("OrchestratorAgent");
          if (!orchestrator) {
            throw new Error("OrchestratorAgent not found");
          }

          const result = await orchestrator.execute(data.prompt);

          // Extract response and taskId from result
          const responseContent =
            typeof result === "string"
              ? result
              : typeof result === "object" && result !== null
                ? (result as Record<string, unknown>).data || JSON.stringify(result)
                : String(result);

          const taskId = (result as Record<string, unknown>)?.taskId || undefined;

          logInfo("CEANChat", `Response sent (${String(responseContent).length} chars)`);

          // Emit response back to client
          socket.emit("cean:orchestrator:response", {
            content: responseContent,
            taskId,
            timestamp: Date.now(),
          });
        } catch (error: unknown) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          logError("CEANChat", errorMsg);

          socket.emit("cean:orchestrator:response", {
            error: errorMsg,
            timestamp: Date.now(),
          });
        }
      },
    );
  });

  logInfo("CEANChat", "CEAN Orchestrator WebSocket handlers registered ✅");
}

/**
 * Register Fleet Management WebSocket handlers
 *
 * Events broadcasted to all connected clients:
 * - fleet_scaled - When a fleet is scaled up/down
 * - worker_status_changed - When a worker status changes
 * - metrics_updated - When metrics are updated
 *
 * @param io - Socket.IO Server instance
 */
export function registerFleetWebSocketHandlers(io: Server) {
  io.on("connection", (socket: Socket) => {
    logInfo("FleetWS", `Fleet client connected: ${socket.id}`);

    /**
     * Event: fleet_scaled
     * Emitted when a fleet scaling event occurs
     * Broadcasted to ALL clients
     *
     * Payload:
     * {
     *   fleet_id: string
     *   old_worker_count: number
     *   new_worker_count: number
     *   direction: 'up' | 'down'
     *   timestamp: number
     * }
     */
    socket.on(
      "broadcast:fleet_scaled",
      (data: {
        fleet_id: string;
        old_worker_count: number;
        new_worker_count: number;
        direction: "up" | "down";
        timestamp: number;
      }) => {
        logInfo(
          "FleetWS",
          `Fleet ${data.fleet_id} scaled ${data.direction}: ${data.old_worker_count} → ${data.new_worker_count} workers`
        );

        // Broadcast to all clients
        io.emit("fleet_scaled", data);
      }
    );

    /**
     * Event: worker_status_changed
     * Emitted when a worker status changes
     * Broadcasted to ALL clients
     *
     * Payload:
     * {
     *   worker_id: string
     *   fleet_id: string
     *   status: 'healthy' | 'degraded' | 'offline'
     *   latency_p95?: number
     *   error_rate?: number
     *   timestamp: number
     * }
     */
    socket.on(
      "broadcast:worker_status_changed",
      (data: {
        worker_id: string;
        fleet_id: string;
        status: "healthy" | "degraded" | "offline";
        latency_p95?: number;
        error_rate?: number;
        timestamp: number;
      }) => {
        logInfo("FleetWS", `Worker ${data.worker_id} status: ${data.status}`);

        // Broadcast to all clients
        io.emit("worker_status_changed", data);
      }
    );

    /**
     * Event: metrics_updated
     * Emitted when fleet or worker metrics are updated
     * Broadcasted to ALL clients
     *
     * Payload:
     * {
     *   fleet_id?: string
     *   worker_id?: string
     *   avg_latency?: number
     *   p95_latency?: number
     *   p99_latency?: number
     *   error_rate?: number
     *   rps?: number
     *   timestamp: number
     * }
     */
    socket.on(
      "broadcast:metrics_updated",
      (data: {
        fleet_id?: string;
        worker_id?: string;
        avg_latency?: number;
        p95_latency?: number;
        p99_latency?: number;
        error_rate?: number;
        rps?: number;
        total_workers?: number;
        healthy_workers?: number;
        timestamp: number;
      }) => {
        logInfo(
          "FleetWS",
          `Metrics updated${data.fleet_id ? ` (fleet: ${data.fleet_id})` : data.worker_id ? ` (worker: ${data.worker_id})` : ""}`
        );

        // Broadcast to all clients
        io.emit("metrics_updated", data);
      }
    );

    socket.on("disconnect", () => {
      logInfo("FleetWS", `Fleet client disconnected: ${socket.id}`);
    });
  });

  logInfo("FleetWS", "Fleet Management WebSocket handlers registered ✅");
}
