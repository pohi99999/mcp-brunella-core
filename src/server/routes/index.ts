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
} from "./llm.js";
import { createFileRoutes, createRagRoutes } from "./files.js";
import { createTaskRoutes } from "./tasks.js";
import { createToolRoutes, createDebugRoutes } from "./tools.js";
import { createChatRoutes, createAnythingLLMRoutes } from "./chat.js";
import { createIncubatorRoutes, createN8nRoutes } from "./external.js";
import { createDeveloperRoutes } from "./developer.js";
import { createRobotkezRoutes } from "./robotkez.js";

export {
  createHealthRoutes,
  createAgentRoutes,
  createRegistryRoutes,
  createCloudflareAgentRoutes,
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
  createRobotkezRoutes,
};

/**
 * Creates a centralized router for all API v1 routes
 */
export function createV1Router(): Router {
  const router = Router();

  router.use("/health", createHealthRoutes());
  router.use("/agents", createAgentRoutes());
  router.use("/registry", createRegistryRoutes());
  router.use("/cloudflare/agents", createCloudflareAgentRoutes());
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
  router.use("/robotkez", createRobotkezRoutes());

  return router;
}
