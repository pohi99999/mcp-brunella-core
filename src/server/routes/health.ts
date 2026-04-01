import { Router } from "express";
import { agentManager } from "../../agents/AgentManager.js";
import { mcpProcessManager } from "../McpProcessManager.js";
import {
  checkOllamaHealth,
  checkAnythingLLMHealth,
  checkPythonHealth,
  checkN8nHealth,
  checkLangflowHealth,
  checkCloudflareHealth,
  buildHealthResponse,
  HealthResponse
} from "../../utils/health.js";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../middleware/errorHandler.js";

let cachedHealthResponse: HealthResponse | null = null;
let lastHealthCheckTime = 0;
const HEALTH_CACHE_TTL_MS = 10000; // 10 seconds

export function createHealthRoutes(): Router {
  const router = Router();

  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: System Health Check
   *     description: Checks the status of internal components, Ollama, and AnythingLLM.
   *     responses:
   *       200:
   *         description: Health status object
   */
  router.get(
    "/",
    asyncHandler(async (req, res) => {
      const now = Date.now();
      if (cachedHealthResponse && now - lastHealthCheckTime < HEALTH_CACHE_TTL_MS) {
        return res.json({
          ...cachedHealthResponse,
          cached: true,
          timestamp: new Date().toISOString(),
          requestId: (req as unknown as Record<string, unknown>).id as string
        });
      }

      const [ollama, anythingllm, python, n8n, langflow, cloudflare] = await Promise.all([
        checkOllamaHealth(),
        checkAnythingLLMHealth(),
        checkPythonHealth(),
        checkN8nHealth(),
        checkLangflowHealth(),
        checkCloudflareHealth(),
      ]);
      const agentsCount = agentManager.listAgents().length;
      const mcpCount = mcpProcessManager.getServersStatus().length;
      const payload = buildHealthResponse(
        ollama,
        anythingllm,
        python,
        n8n,
        langflow,
        cloudflare,
        agentsCount,
        mcpCount,
        (req as unknown as Record<string, unknown>).id as string,
      );

      cachedHealthResponse = payload;
      lastHealthCheckTime = now;

      res.json(payload);
    }),
  );

  return router;
}
