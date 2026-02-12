import { Server, Socket } from "socket.io";
import { logInfo, logError } from "../utils/logger.js";
import { cloudflareClient } from "../agents/cloudflare/CloudflareClient.js";

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
