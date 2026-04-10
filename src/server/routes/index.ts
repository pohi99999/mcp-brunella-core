import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { createHealthRoutes } from "./health.js";
import { getGlobalDb } from "../../utils/globalDb.js";
import { defaultDatabaseManager } from "../../utils/db.js";
import { ensureError } from "../../utils/ensureError.js";
import { logDebug } from "../../utils/logger.js";

/**
 * Lazy-loading proxy router.
 * Defers the actual module import until the first HTTP request hits the mount,
 * keeping startup memory ~780 MB lower than eager imports.
 */
function lazy(
  importFn: () => Promise<Record<string, unknown>>,
  exportName: string,
  ...factoryArgs: unknown[]
): Router {
  const proxy = Router();
  let loaded: Router | null = null;

  proxy.use((req: Request, res: Response, next: NextFunction) => {
    if (loaded) return loaded(req, res, next);

    importFn()
      .then((mod) => {
        const exported = mod[exportName];

        // Express Routers are functions themselves, but they have a .stack property.
        // Factory functions will not have a .stack property.
        const isRouterInstance = typeof exported === "function" && "stack" in exported;

        loaded =
          typeof exported === "function" && !isRouterInstance
            ? (exported as (...a: unknown[]) => Router)(...factoryArgs)
            : (exported as Router);

        loaded(req, res, next);
      })
      .catch(next);
  });

  return proxy;
}

/**
 * Creates a centralized router for all API v1 routes.
 * Every route except /health is loaded lazily on first request.
 */
export function createV1Router(): Router {
  const router = Router();
  const db = getGlobalDb();

  // ── Health — eager (always needed at startup) ──────────────────────
  router.use("/health", createHealthRoutes());

  // ── Core routes ────────────────────────────────────────────────────
  router.use("/agents", lazy(() => import("./agents.js"), "createAgentRoutes"));
  router.use("/registry", lazy(() => import("./agents.js"), "createRegistryRoutes"));
  router.use("/providers", lazy(() => import("./llm.js"), "createProvidersRoutes"));
  router.use("/ollama", lazy(() => import("./llm.js"), "createOllamaRoutes"));
  router.use("/gemini", lazy(() => import("./llm.js"), "createGeminiRoutes"));
  router.use("/github-models", lazy(() => import("./llm.js"), "createGithubModelsRoutes"));
  router.use("/files", lazy(() => import("./files.js"), "createFileRoutes"));
  router.use("/rag", lazy(() => import("./files.js"), "createRagRoutes"));
  router.use("/tasks", lazy(() => import("./tasks.js"), "createTaskRoutes"));
  router.use("/tools", lazy(() => import("./tools.js"), "createToolRoutes"));
  router.use("/debug", lazy(() => import("./tools.js"), "createDebugRoutes"));
  router.use("/docs-config", lazy(() => import("./docsConfig.js"), "createDocsConfigRoutes"));
  router.use("/chat", lazy(() => import("./chat.js"), "createChatRoutes"));
  router.use("/chat", lazy(() => import("./chat.js"), "createChatRoutes"));
  router.use("/anythingllm/action", lazy(() => import("./anythingllmActions.js"), "createAnythingLLMActionRoutes"));
  router.use("/anythingllm", lazy(() => import("./chat.js"), "createAnythingLLMRoutes"));
  router.use("/incubator", lazy(() => import("./external.js"), "createIncubatorRoutes"));
  router.use("/n8n", lazy(() => import("./external.js"), "createN8nRoutes"));
  router.use("/developer", lazy(() => import("./developer.js"), "createDeveloperRoutes"));
  router.use("/browser-copilot", lazy(() => import("./browserCopilot.js"), "createBrowserCopilotRoutes"));
  router.use("/robotkez", lazy(() => import("./robotkez.js"), "createRobotkezRoutes"));
  router.use("/robotkez-pro", lazy(() => import("./robotkez_pro.js"), "createRobotkezProRoutes"));
  router.use("/jules", lazy(() => import("./jules.js"), "createJulesRoutes"));
  router.use("/cloudflare", lazy(() => import("./cloudflare.js"), "createCloudflareRoutes"));
  router.use("/tracks", lazy(() => import("../tracksRoutes.js"), "createTracksRouter"));
  router.use("/tts", lazy(() => import("./tts.js"), "createTTSRoutes"));
  router.use("/brunella", lazy(() => import("./recommendation.js"), "createRecommendationRoutes"));
  router.use("/bookkeeping", lazy(() => import("./bookkeeping.js"), "createBookkeepingRoutes"));
  router.use("/invoice", lazy(() => import("./szamlazz.js"), "createSzamlazzRoutes"));
  router.use("/szamlazz", lazy(() => import("./szamlazz.js"), "createSzamlazzRoutes"));
  router.use("/inventory", lazy(() => import("./inventory.js"), "createInventoryRoutes"));
  router.use("/kkv-pack", lazy(() => import("./kkvPack.js"), "createKkvPackRoutes"));
  router.use("/kkv-crm", lazy(() => import("./kkvCrm.js"), "default"));
  router.use("/hr-onboarding", lazy(() => import("./hrOnboarding.js"), "createHROnboardingRoutes"));
  router.use("/hr/leave", lazy(() => import("./hrLeave.js"), "createHRLeaveRoutes"));
  router.use("/hr/timesheet", lazy(() => import("./hrTimesheet.js"), "createHRTimesheetRoutes"));
  router.use("/machines", lazy(() => import("./machines.js"), "createMachinesRouter"));
  router.use("/enterprise", lazy(() => import("./enterprise.js"), "createEnterpriseRouter"));
  router.use("/enterprise/analytics", lazy(() => import("./enterprise.js"), "createEnterpriseAnalyticsRouter"));
  router.use("/logistics", lazy(() => import("./logistics.js"), "createLogisticsRoutes"));
  router.use("/system", lazy(() => import("./system.js"), "createSystemArchitectureRouter"));
  router.use("/system", lazy(() => import("./system.js"), "createSystemControlRouter"));
  router.use("/llm", lazy(() => import("./llm.js"), "createLLMRoutes"));
  router.use("/anthropic", lazy(() => import("./anthropic.js"), "createAnthropicRoutes"));
  router.use("/business-jobs", lazy(() => import("./businessJobs.js"), "createBusinessJobsRoutes", defaultDatabaseManager));
  router.use("/security", lazy(() => import("./security.js"), "securityRouter"));
  router.use("/assistant", lazy(() => import("./assistant.js"), "createAssistantRoutes"));
  router.use("/copilot-bridge", lazy(() => import("./copilotBridge.js"), "createCopilotBridgeRoutes"));
  router.use("/copilot-orchestrator", lazy(() => import("./copilotOrchestratorRoute.js"), "createCopilotOrchestratorRoutes"));
  router.use("/kernel", lazy(() => import("./kernelRoute.js"), "createKernelRoutes"));
  router.use("/cognitive", lazy(() => import("./cognitiveBridge.js"), "createCognitiveBridgeRoutes"));
  router.use("/workflow", lazy(() => import("./workflow.js"), "createWorkflowRoutes"));
  router.use("/remote", lazy(() => import("./remote.js"), "createRemoteRoutes"));
  router.use("/autonomous-infra", lazy(() => import("./autonomousInfra.js"), "createAutonomousInfraRouter"));

  // ── Additional routes ──────────────────────────────────────────────
  router.use("/telemetry", lazy(() => import("../telemetryRoutes.js"), "createTelemetryRouter"));
  router.use("/guardrails", lazy(() => import("../guardrailsRoutes.js"), "createGuardrailsRouter"));
  router.use("/audit", lazy(() => import("../auditRoutes.js"), "createAuditRouter"));
  router.use("/specs", lazy(() => import("../specRoutes.js"), "createSpecRouter"));
  router.use("/phoenix", lazy(() => import("../phoenixRoutes.js"), "createPhoenixRouter"));
  router.use("/hooks", lazy(() => import("./hooks.js"), "createHookRoutes"));
  router.use("/router", lazy(() => import("../routerRoutes.js"), "createRouterRouter"));
  router.use("/memory", lazy(() => import("../memoryRoutes.js"), "createMemoryRouter"));
  router.use("/mcp", lazy(() => import("./mcp.js"), "default"));
  router.use(lazy(() => import("./cean.js"), "default"));
  router.use(lazy(() => import("./wrangler.js"), "createWranglerRouter"));
  router.use("/fleet", lazy(() => import("./fleet.js"), "createFleetRouter", db));
  router.use("/workers", lazy(() => import("./workers.js"), "createWorkersRouter", db));
  router.use("/metrics", lazy(() => import("./metrics.js"), "createMetricsRouter", db));
  router.use("/scaling", lazy(() => import("./scaling.js"), "createScalingRouter", db));
  router.use("/tests", lazy(() => import("./testScheduler.js"), "default"));
  router.use("/scheduled-tasks", lazy(() => import("./scheduledTasks.js"), "createScheduledTasksRoutes", db));
  router.use("/dashboard", lazy(() => import("./dashboard.js"), "createDashboardRoutes"));
  router.use("/studio", lazy(() => import("./studio.js"), "createStudioRoutes"));
  router.use("/grants", lazy(() => import("./grants.js"), "default"));
  router.use("/webhooks", lazy(() => import("./webhooks.js"), "default", db));
  // KKV follow-up webhook (lightweight receiver used by n8n/workflows)
  router.use("/webhooks/kkv", lazy(() => import("./kkvWebhook.js"), "createKkvWebhookRoutes", db));
  router.use("/webhook/onboarding-intake", lazy(() => import("./onboardingIntake.js"), "createOnboardingIntakeRoutes"));
  router.use("/contact", lazy(() => import("./contact.js"), "default"));
  router.use("/harvest", lazy(() => import("./harvest.js"), "harvestRouter"));
  router.use("/reflection", lazy(() => import("./reflection.js"), "createReflectionRouter"));
  router.use("/zero-prompt", lazy(() => import("./zeroPrompt.js"), "createZeroPromptRouter"));
  router.use("/ephemeral", lazy(() => import("./ephemeral.js"), "createEphemeralRouter"));
  router.use("/orchestrator", lazy(() => import("./universalOrchestrator.js"), "createUniversalOrchestratorRouter"));
  router.use("/paios", lazy(() => import("./paiosOrchestrator.js"), "default"));
  router.use("/github", lazy(() => import("./githubWebhook.js"), "default"));

  // ── Browser snapshot (inline, lazy import) ─────────────────────────
  router.get("/browser/snapshot", async (_req: Request, res: Response) => {
    try {
      const { persistentBrowser } = await import("../../utils/persistentBrowser.js");
      const screenshot = persistentBrowser?.getLastScreenshot?.();
      if (screenshot) {
        res.setHeader("Content-Type", "image/png");
        res.send(screenshot);
      } else {
        res.status(404).send("No active browser session or screenshot available.");
      }
    } catch (error: unknown) {
      logDebug("RoutesIndex", `Browser snapshot unavailable: ${ensureError(error).message}`);
      res.status(500).send("Browser module not available.");
    }
  });

  // ── Activated dormant routes ───────────────────────────────────────
  router.use("/observability", lazy(() => import("./observability.js"), "createObservabilityRouter"));
  router.use("/devex", lazy(() => import("./devex.js"), "createDevExRouter"));
  router.use("/swarm", lazy(() => import("./swarm.js"), "swarmRouter"));
  router.use("/golden-dataset", lazy(() => import("./goldenDataset.js"), "createGoldenDatasetRouter"));
  router.use("/learning-loop", lazy(() => import("./learningLoop.js"), "createLearningLoopRouter"));
  router.use("/intelligence", lazy(() => import("./intelligence.js"), "createIntelligenceRouter"));
  router.use("/federation", lazy(() => import("./federation.js"), "createFederationRouter"));
  router.use("/suggested-tasks", lazy(() => import("./suggestedTasks.js"), "suggestedTasksRouter"));
  router.use("/crawl4ai", lazy(() => import("./crawl4ai.js"), "createCrawl4aiRouter"));
  router.use("/python-workers", lazy(() => import("./pythonWorkers.js"), "createPythonWorkersRouter"));
  router.use("/evhunter", lazy(() => import("./evhunter.js"), "createEvHunterRouter"));
  router.use("/preferences", lazy(() => import("./preferences.js"), "createPreferencesRouter"));
  router.use("/sales", lazy(() => import("./sales.js"), "default"));
  router.use("/crm", lazy(() => import("./crm.js"), "createCrmRoutes"));
  router.use("/psales/auth", lazy(() => import("./psales-auth.js"), "createPSalesAuthRoutes"));
  router.use("/psales/intake", lazy(() => import("./psales-intake.js"), "createPSalesIntakeRoutes"));
  router.use("/psales/research", lazy(() => import("./psales-research.js"), "createPSalesResearchRoutes"));
  router.use("/psales/strategy", lazy(() => import("./psales-strategy.js"), "createPSalesStrategyRoutes"));
  router.use("/voice", lazy(() => import("./voice.js"), "default"));
  router.use("/project-maintainer", lazy(() => import("./projectMaintainer.js"), "createProjectMaintainerRoutes", db));
  router.use("/briefing", lazy(() => import("./briefing.js"), "createBriefingRoutes", db));

  return router;
}
