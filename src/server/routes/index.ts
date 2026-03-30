import { Router } from "express";
import { createHealthRoutes } from "./health.js";
import {
  createAgentRoutes,
  createRegistryRoutes,
} from "./agents.js";
import {
  createProvidersRoutes,
  createOllamaRoutes,
  createGeminiRoutes,
  createGithubModelsRoutes,
  createLLMRoutes,
} from "./llm.js";
import { createAnthropicRoutes } from "./anthropic.js";
import { createFileRoutes, createRagRoutes } from "./files.js";
import { createTaskRoutes } from "./tasks.js";
import { createToolRoutes, createDebugRoutes } from "./tools.js";
import { createChatRoutes, createAnythingLLMRoutes } from "./chat.js";
import { createIncubatorRoutes, createN8nRoutes } from "./external.js";
import { createDeveloperRoutes } from "./developer.js";
import { createBrowserCopilotRoutes } from "./browserCopilot.js";
import { createRobotkezRoutes } from "./robotkez.js";
import { createRobotkezProRoutes } from "./robotkez_pro.js";
import { createJulesRoutes } from "./jules.js";
import { createCloudflareRoutes } from "./cloudflare.js";
import { createTracksRoutes } from "./tracks.js";
import { createTTSRoutes } from "./tts.js";
import { createRecommendationRoutes } from "./recommendation.js";
import { createBookkeepingRoutes } from "./bookkeeping.js";
import { createMachinesRouter } from "./machines.js";
import { createEnterpriseRouter, createEnterpriseAnalyticsRouter } from "./enterprise.js";
import { createSystemArchitectureRouter, createSystemControlRouter } from "./system.js";
import { createBusinessJobsRoutes } from "./businessJobs.js";
import { securityRouter } from "./security.js";
import { createAssistantRoutes } from "./assistant.js";
import { createCopilotBridgeRoutes } from "./copilotBridge.js";
import { createCognitiveBridgeRoutes } from "./cognitiveBridge.js";
import { createWorkflowRoutes } from "./workflow.js";
import { createRemoteRoutes } from "./remote.js";
// --- Activated dormant routes (2026-03-25) ---
import { createObservabilityRouter } from "./observability.js";
import { swarmRouter } from "./swarm.js";
import { createGoldenDatasetRouter } from "./goldenDataset.js";
import { createLearningLoopRouter } from "./learningLoop.js";
import { createIntelligenceRouter } from "./intelligence.js";
import { createFederationRouter } from "./federation.js";
import { suggestedTasksRouter } from "./suggestedTasks.js";
import { createCrawl4aiRouter } from "./crawl4ai.js";
import { createPythonWorkersRouter } from "./pythonWorkers.js";
import { createEvHunterRouter } from "./evhunter.js";
import { createPreferencesRouter } from "./preferences.js";
import salesRouter from "./sales.js";
import voiceRouter from "./voice.js";
import { createPSalesAuthRoutes } from "./psales-auth.js";

export {
  createHealthRoutes,
  createAgentRoutes,
  createRegistryRoutes,
  createProvidersRoutes,
  createOllamaRoutes,
  createGeminiRoutes,
  createGithubModelsRoutes,
  createFileRoutes,
  createRagRoutes,
  createTaskRoutes,
  createToolRoutes,
  createDebugRoutes,
  createChatRoutes,
  createAnythingLLMRoutes,
  createIncubatorRoutes,
  createN8nRoutes,
  createDeveloperRoutes,
  createBrowserCopilotRoutes,
  createRobotkezRoutes,
  createCloudflareRoutes,
  createTracksRoutes,
  createTTSRoutes,
  createEnterpriseRouter,
  createEnterpriseAnalyticsRouter,
  createSystemArchitectureRouter,
  createAssistantRoutes,
  createBookkeepingRoutes,
};

/**
 * Creates a centralized router for all API v1 routes
 */
export function createV1Router(): Router {
  const router = Router();

  router.use("/health", createHealthRoutes());
  router.use("/agents", createAgentRoutes());
  router.use("/registry", createRegistryRoutes());
  router.use("/providers", createProvidersRoutes());
  router.use("/ollama", createOllamaRoutes());
  router.use("/gemini", createGeminiRoutes());
  router.use("/github-models", createGithubModelsRoutes());
  router.use("/files", createFileRoutes());
  router.use("/rag", createRagRoutes());
  router.use("/tasks", createTaskRoutes());
  router.use("/tools", createToolRoutes());
  router.use("/debug", createDebugRoutes());
  router.use("/chat", createChatRoutes());
  router.use("/anythingllm", createAnythingLLMRoutes());
  router.use("/incubator", createIncubatorRoutes());
  router.use("/n8n", createN8nRoutes());
  router.use("/developer", createDeveloperRoutes());
  router.use("/browser-copilot", createBrowserCopilotRoutes());
  router.use("/robotkez", createRobotkezRoutes());
  router.use("/robotkez-pro", createRobotkezProRoutes());
  router.use("/jules", createJulesRoutes());
  router.use("/cloudflare", createCloudflareRoutes());
  router.use("/tracks", createTracksRoutes());
  router.use("/tts", createTTSRoutes());
  router.use("/brunella", createRecommendationRoutes());
  router.use("/bookkeeping", createBookkeepingRoutes());
  router.use("/machines", createMachinesRouter());
  router.use("/enterprise", createEnterpriseRouter());
  router.use("/enterprise/analytics", createEnterpriseAnalyticsRouter());
  router.use("/system", createSystemArchitectureRouter());
  router.use("/system", createSystemControlRouter());
  router.use("/llm", createLLMRoutes());
  router.use("/anthropic", createAnthropicRoutes());
  router.use("/business-jobs", createBusinessJobsRoutes());
  router.use("/security", securityRouter);
  router.use("/assistant", createAssistantRoutes());
  router.use("/copilot-bridge", createCopilotBridgeRoutes());
  router.use("/cognitive", createCognitiveBridgeRoutes());
  router.use("/workflow", createWorkflowRoutes());
  router.use("/remote", createRemoteRoutes());

  // --- Activated dormant routes (2026-03-25) ---
  router.use("/observability", createObservabilityRouter());
  router.use("/swarm", swarmRouter);
  router.use("/golden-dataset", createGoldenDatasetRouter());
  router.use("/learning-loop", createLearningLoopRouter());
  router.use("/intelligence", createIntelligenceRouter());
  router.use("/federation", createFederationRouter());
  router.use("/suggested-tasks", suggestedTasksRouter);
  router.use("/crawl4ai", createCrawl4aiRouter());
  router.use("/python-workers", createPythonWorkersRouter());
  router.use("/evhunter", createEvHunterRouter());
  router.use("/preferences", createPreferencesRouter());
  router.use("/sales", salesRouter);
  router.use("/psales/auth", createPSalesAuthRoutes());
  router.use("/voice", voiceRouter);

  return router;
}
