import { Router } from "express";
import { agentManager } from "../../agents/AgentManager.js";
import { mcpProcessManager } from "../McpProcessManager.js";
import {
  checkOllamaHealth,
  checkAnythingLLMHealth,
  checkPythonHealth,
  checkN8nHealth,
  checkLangflowHealth,
  checkWabHealth,
  checkCloudflareHealth,
  buildHealthResponse,
  HealthResponse
} from "../../utils/health.js";
import { getRuntimeTelemetry } from "../../utils/runtimeTelemetry.js";
import { AppError } from "../../utils/AppError.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { getRuntimeDriftSnapshot } from "../../utils/runtimeDriftMonitor.js";
import { buildThresholdRolloutPlan, readRepoRuntimeContract } from "../../utils/runtimeThresholdRollout.js";
import { getLatestRuntimeThresholdRolloutJournalSummary } from "../../utils/globalDb.js";

let cachedHealthResponse: HealthResponse | null = null;
let lastHealthCheckTime = 0;
const HEALTH_CACHE_TTL_MS = 10000; // 10 seconds

export function createHealthRoutes(): Router {
  const router = Router();

  router.get("/live", (_req, res) => {
    const runtime = getRuntimeTelemetry();
    res.json({
      status: "alive",
      process: "brunella-core",
      pid: runtime.pid,
      uptimeSeconds: runtime.uptimeSeconds,
      runtime,
    });
  });

  router.get("/ready", (_req, res) => {
    const agentsCount = agentManager.listAgents().length;
    const mcpCount = mcpProcessManager.getServersStatus().length;
    const ready = agentsCount > 0 && mcpCount >= 0;
    const runtime = getRuntimeTelemetry();

    res.status(ready ? 200 : 503).json({
      status: ready ? "ready" : "starting",
      ready,
      agents: agentsCount,
      mcpServers: mcpCount,
      runtime,
    });
  });

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

      const [ollama, anythingllm, python, n8n, langflow, wab, cloudflare] = await Promise.all([
        checkOllamaHealth(),
        checkAnythingLLMHealth(),
        checkPythonHealth(),
        checkN8nHealth(),
        checkLangflowHealth(),
        checkWabHealth(),
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
        wab,
        cloudflare,
        agentsCount,
        mcpCount,
        (req as unknown as Record<string, unknown>).id as string,
      );

      payload.runtime = getRuntimeTelemetry();

      cachedHealthResponse = payload;
      lastHealthCheckTime = now;

      res.json(payload);
    }),
  );

  /**
   * GET /api/health/runtime-drift
   * Runtime drift snapshot with threshold rollout plan and latest journal entry.
   */
  router.get(
    "/runtime-drift",
    asyncHandler(async (_req, res) => {
      const snapshot = getRuntimeDriftSnapshot();
      const contract = readRepoRuntimeContract(process.cwd());
      const rollout = buildThresholdRolloutPlan(snapshot.summary.recommendation, contract);
      const latestJournalEntry = getLatestRuntimeThresholdRolloutJournalSummary();
      res.json({
        summary: snapshot.summary,
        samples: snapshot.samples,
        rollout,
        latestJournalEntry,
        timestamp: new Date().toISOString(),
      });
    }),
  );

  return router;
}
