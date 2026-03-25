import { Router } from "express";
import { createHealthRoutes } from "./health.js";
import {
  createAgentRoutes,
  createRegistryRoutes,
  createCloudflareAgentRoutes,
} from "./agents.js";
import {
  createProvidersRoutes,
  createOllamaRoutes,
  createGeminiRoutes,
  createGithubModelsRoutes,
  createLLMRoutes,
} from "./llm.js";
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
import { createMachinesRouter } from "./machines.js";
import { createEnterpriseRouter, createEnterpriseAnalyticsRouter } from "./enterprise.js";
import { createSystemArchitectureRouter, createSystemControlRouter } from "./system.js";
import { createBusinessJobsRoutes } from "./businessJobs.js";
import { securityRouter } from "./security.js";
import { createAssistantRoutes } from "./assistant.js";

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
  router.use("/machines", createMachinesRouter());
  router.use("/enterprise", createEnterpriseRouter());
  router.use("/enterprise/analytics", createEnterpriseAnalyticsRouter());
  router.use("/system", createSystemArchitectureRouter());
  router.use("/system", createSystemControlRouter());
  router.use("/llm", createLLMRoutes());
  router.use("/business-jobs", createBusinessJobsRoutes());
  router.use("/security", securityRouter);
  router.use("/assistant", createAssistantRoutes());

  return router;
}
