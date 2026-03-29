import "dotenv/config"; // CRITICAL: Load .env before anything else
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { readFileSync, existsSync } from "fs";
import os from "os";
import swaggerUi from "swagger-ui-express";
import { config } from "../config/schema.js";
import {
  Logger,
  logEmitter,
  type LogEvent,
  type AgentStatusEvent,
  logInfo,
  logError,
  logWarn,
} from "../utils/logger.js";
import { initDb, saveMessage, getMessages } from "../utils/db.js";
import { initTasksDb } from "../utils/tasksDb.js";
import { getGlobalDb, closeGlobalDb } from "../utils/globalDb.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./registry.js";
import { v4 as uuidv4 } from "uuid";
import { toolManager } from "./ToolManager.js";
import { mcpProcessManager } from "./McpProcessManager.js";
import { mcpClientManager } from "../utils/mcpClientManager.js";
import { AgentManager, agentManager, initializeAgentManager } from "../agents/AgentManager.js";
import { InnovationBridgeAgent } from "../agents/InnovationBridgeAgent.js";
import { DigitalHeadhunterAgent } from "../agents/DigitalHeadhunterAgent.js";
import { GrantHunter } from "../agents/GrantHunter.js";
import { LawDetectiveAgent } from "../agents/LawDetectiveAgent.js";
import { PropertyVisionaryAgent } from "../agents/PropertyVisionaryAgent.js";
import { persistentBrowser } from "../utils/persistentBrowser.js";
import {
  corsWhitelist,
  requestId,
  requestLogging,
  apiRateLimit,
} from "./middleware.js";
import { swaggerSpec } from "./swagger.js";
import { socketService } from "./SocketService.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
import {
  getPrometheusContentType,
  getPrometheusMetrics,
  initMetrics,
  recordHttpRequest,
} from "../utils/metrics.js";
import { createTelemetryRouter } from "./telemetryRoutes.js";
import { createGuardrailsRouter } from "./guardrailsRoutes.js";
import { createAuditRouter } from "./auditRoutes.js";
import { createSpecRouter } from "./specRoutes.js";
import { createPhoenixRouter } from "./phoenixRoutes.js";
import { createRouterRouter } from "./routerRoutes.js";
import { createMemoryRouter } from "./memoryRoutes.js";
import { createTracksRouter } from "./tracksRoutes.js";
import ceanRouter from "./routes/cean.js";
import { createWranglerRouter } from "./routes/wrangler.js";
import mcpRouter from "./routes/mcp.js";
import { createV1Router } from "./routes/index.js";
import { createAgentRoutes } from "./routes/agents.js";
import { createChatRoutes } from "./routes/chat.js";
import { createUniversalOrchestratorRouter } from "./routes/universalOrchestrator.js";
import { createRobotkezRoutes } from "./routes/robotkez.js";
import { createTaskRoutes } from "./routes/tasks.js";
import { suggestedTasksRouter } from "./routes/suggestedTasks.js";
import { createFleetRouter } from "./routes/fleet.js";
import { createWorkersRouter } from "./routes/workers.js";
import { createMetricsRouter } from "./routes/metrics.js";
import { createScalingRouter } from "./routes/scaling.js";
import { registerEdgeWebSocketHandlers, registerCEANWebSocketHandlers, registerFleetWebSocketHandlers } from "./websocket.js";
import testSchedulerRoutes from "./routes/testScheduler.js";
import { startScheduler, stopScheduler } from "./schedulers/testRunner.js";
import { startScheduler as startCronScheduler } from "./cron.js";
import { scheduledTasksRunner } from "./schedulers/scheduledTasksRunner.js";
import { initTestResultsDb } from "../core/testResultsService.js";
import { initSuggestedTasksDb } from "../core/suggestedTasksScanner.js";
import { createScheduledTasksRoutes } from "./routes/scheduledTasks.js";
import createWebhookRoutes from "./routes/webhooks.js";
import githubWebhookRouter from "./routes/githubWebhook.js";
import { heartbeatMonitor } from "../utils/heartbeatMonitor.js";
import { createEnterpriseRouter } from "./routes/enterprise.js";
import paiosOrchestratorRouter from "./routes/paiosOrchestrator.js";
import { createPythonWorkersRouter } from "./routes/pythonWorkers.js";
import { createDashboardRoutes } from "./routes/dashboard.js";
import { createBusinessJobsRoutes } from "./routes/businessJobs.js";
import { createStudioRoutes } from "./routes/studio.js";
import salesRouter from "./routes/sales.js";
import grantsRouter from "./routes/grants.js";
import voiceRouter from "./routes/voice.js";
import { syncService } from "../utils/syncService.js";
import contactRouter from "./routes/contact.js";
import { swarmRouter } from "./routes/swarm.js";
import { harvestRouter } from "./routes/harvest.js";
import { createCrawl4aiRouter } from "./routes/crawl4ai.js";
import { createPreferencesRouter } from "./routes/preferences.js";
import { createObservabilityRouter } from "./routes/observability.js";
import { createGoldenDatasetRouter } from "./routes/goldenDataset.js";
import { createIntelligenceRouter } from "./routes/intelligence.js";
import { createFederationRouter } from "./routes/federation.js";
import "../core/ceanFallback.js"; // Side-effect: registers Phoenix CEAN fallback handlers
import { zeroPromptRuntime } from '../core/zeroPromptRuntime.js';

const logger = new Logger("web_ui.log");

const corsOriginList = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

interface ActiveTransport {
  transport: SSEServerTransport;
  server: McpServer;
}

const PACKAGE_VERSION = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
})();

export async function startWebServer() {
  const webUiEnabled =
    process.env.WEB_UI_ENABLED !== "0" &&
    process.env.WEB_UI_ENABLED !== "false";
  if (!webUiEnabled) {
    logInfo("Server", "WEB_UI_ENABLED=0 -> Web UI disabled for current process");
    return;
  }

  try {
    initDb();
  } catch (e: any) {
    logError("Server", `DB Init failed: ${e.message}`);
  }

  try {
    initTasksDb();
  } catch (e: any) {
    logError("Server", `Tasks DB Init failed: ${e.message}`);
  }

  try {
    await initTestResultsDb("data/brunella.db");
  } catch (e: any) {
    logError("Server", `Test Results DB Init failed: ${e.message}`);
  }

  try {
    await initSuggestedTasksDb("data/brunella.db");
  } catch (e: any) {
    logError("Server", `Suggested Tasks DB Init failed: ${e.message}`);
  }

  initMetrics();

  logInfo("Server", "🔄 Starting MCP Bridge...");
  try {
    await mcpProcessManager.loadConfig();
    const configured = mcpProcessManager.getServersStatus();
    logInfo("Server", `📋 ${configured.length} MCP server(s) configured`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("Server", `MCP config load failed: ${msg}`);
  }

  const app = express();
  
  app.use(express.json());
  app.use(corsWhitelist);
  app.use(requestId);
  app.use(requestLogging);
  app.use("/api", apiRateLimit);

  app.get("/api/browser/snapshot", (req, res) => {
    const screenshot = persistentBrowser.getLastScreenshot();
    if (screenshot) {
      res.setHeader("Content-Type", "image/png");
      res.send(screenshot);
    } else {
      res.status(404).send("No active browser session or screenshot available.");
    }
  });

  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", getPrometheusContentType());
      const metrics = await getPrometheusMetrics();
      res.end(metrics);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: message });
    }
  });

  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  const v1Router = createV1Router();
  v1Router.use("/telemetry", createTelemetryRouter());
  v1Router.use("/guardrails", createGuardrailsRouter());
  v1Router.use("/audit", createAuditRouter());
  v1Router.use("/specs", createSpecRouter());
  v1Router.use("/phoenix", createPhoenixRouter());
  v1Router.use("/router", createRouterRouter());
  v1Router.use("/memory", createMemoryRouter());
  v1Router.use("/mcp", mcpRouter);
  v1Router.use("/tracks", createTracksRouter());
  v1Router.use(ceanRouter);
  v1Router.use(createWranglerRouter());
  const db = getGlobalDb();
  v1Router.use("/fleet", createFleetRouter(db));
  v1Router.use("/workers", createWorkersRouter(db));
  v1Router.use("/metrics", createMetricsRouter(db));
  v1Router.use("/scaling", createScalingRouter(db));
  v1Router.use("/robotkez", createRobotkezRoutes());
  v1Router.use("/agents", createAgentRoutes());
  v1Router.use("/chat", createChatRoutes());
  v1Router.use("/tasks", createTaskRoutes());
  v1Router.use("/tests", testSchedulerRoutes);
  v1Router.use("/suggested-tasks", suggestedTasksRouter);
  v1Router.use("/enterprise", createEnterpriseRouter());
  v1Router.use("/python-workers", createPythonWorkersRouter());
  v1Router.use("/scheduled-tasks", createScheduledTasksRoutes(db));
  v1Router.use("/dashboard", createDashboardRoutes());
  v1Router.use("/business-jobs", createBusinessJobsRoutes());
  v1Router.use("/studio", createStudioRoutes());
  v1Router.use("/sales", salesRouter);
  v1Router.use("/grants", grantsRouter);
  v1Router.use("/webhooks", createWebhookRoutes(db));
  v1Router.use("/voice", voiceRouter);
  v1Router.use("/contact", contactRouter);
  v1Router.use("/swarm", swarmRouter);
  v1Router.use("/harvest", harvestRouter);
  v1Router.use("/crawl4ai", createCrawl4aiRouter());
  v1Router.use("/preferences", createPreferencesRouter());
  v1Router.use("/observability", createObservabilityRouter());
  v1Router.use("/golden-dataset", createGoldenDatasetRouter());
  v1Router.use("/intelligence", createIntelligenceRouter());

  app.use("/api/v1", v1Router);
  app.use("/api", v1Router);
  app.use("/api/orchestrator", createUniversalOrchestratorRouter());
  app.use("/api/paios", paiosOrchestratorRouter);
  app.use("/api/github", githubWebhookRouter);

  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin:
        corsOriginList.length > 0
          ? corsOriginList
          : ["http://localhost:5173", "http://localhost:3000", "*"],
      methods: ["GET", "POST"],
    },
  });
  socketService.init(io);
  initializeAgentManager(socketService);

  agentManager.registerAgent(new InnovationBridgeAgent());
  agentManager.registerAgent(new DigitalHeadhunterAgent());
  agentManager.registerAgent(new GrantHunter());
  agentManager.registerAgent(new LawDetectiveAgent());
  agentManager.registerAgent(new PropertyVisionaryAgent());

  const { phoenixEventBus } = await import('../core/phoenixEventBus.js');
  phoenixEventBus.connectSocketBroadcaster((event: string, data: unknown) => {
    socketService.emit(event, data);
  });
  zeroPromptRuntime.start();

  // Bridge pipelineRunner progress events to Socket.IO (BrunellaStudio + developer dashboard)
  const { pipelineRunner } = await import('../agents/developerPipeline.js');
  pipelineRunner.on('progress', (event: unknown) => {
    socketService.emit('developer:progress', event);
  });

  io.on("connection", (socket) => {
    const statuses = agentManager.listAgentStatuses();
    socket.emit('agents:snapshot', statuses);
    socket.on("robotkez:abort", async () => {
      await persistentBrowser.close();
      persistentBrowser.forceKill();
      socket.emit("robotkez:aborted", { status: "success", message: "Munkamenet megszakítva." });
    });
  });

  io.of('/robotkez-overlay').on('connection', (socket) => {
    socket.on('user_message', async (msg) => {
      try {
        const { robotkezBridge } = await import('../orchestrator/robotkez_bridge.js');
        const response = await robotkezBridge.handleMessage(msg.text);
        socket.emit('message', { text: response });
      } catch (e: any) {
        socket.emit('message', { text: `Hiba történt: ${e.message}` });
      }
    });
  });

  registerEdgeWebSocketHandlers(io);
  registerCEANWebSocketHandlers(io);
  registerFleetWebSocketHandlers(io);

  const agentLogBuffer = new Map<string, LogEvent[]>();
  const MAX_AGENT_LOGS = 500;
  let requestCount = 0;
  let errorCount = 0;
  let lastMinuteRequests = 0;
  let lastMinuteErrors = 0;

  setInterval(() => {
    lastMinuteRequests = requestCount;
    lastMinuteErrors = errorCount;
    requestCount = 0;
    errorCount = 0;
  }, 60000);

  app.use((_req, res, next) => {
    const requestStart = Date.now();
    requestCount++;
    res.on("finish", () => {
      if (res.statusCode >= 400) errorCount++;
      const durationMs = Date.now() - requestStart;
      const method = _req.method || "UNKNOWN";
      const routePath = _req.route?.path ? String(_req.route.path) : _req.path || "unknown";
      recordHttpRequest(method, routePath, res.statusCode, durationMs);
    });
    next();
  });

  logEmitter.on("log", (entry: LogEvent) => {
    const source = entry.agent || entry.source;
    const type = entry.level === "error" ? "error" : entry.level === "success" ? "success" : "info";
    socketService.broadcastLog(entry.message, type, source);
    if (entry.agent) {
      const list = agentLogBuffer.get(entry.agent) || [];
      list.push(entry);
      if (list.length > MAX_AGENT_LOGS) list.splice(0, list.length - MAX_AGENT_LOGS);
      agentLogBuffer.set(entry.agent, list);
    }
  });

  logEmitter.on("agent_status", (entry: AgentStatusEvent) => {
    socketService.updateAgentStatus(entry.agent, entry.status as any, entry.task);
  });

  setInterval(() => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    const cpuUsage = cpus.reduce((acc, cpu) => {
      const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
      return acc + ((total - cpu.times.idle) / total) * 100;
    }, 0) / cpus.length;
    io.emit("metrics_update", {
      requestsPerMinute: lastMinuteRequests,
      activeConnections: io.sockets.sockets.size,
      errorRate: lastMinuteRequests > 0 ? (lastMinuteErrors / lastMinuteRequests) * 100 : 0,
      averageResponseTime: 0,
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
    });
    io.emit("mcp_servers_status", mcpProcessManager.getServersStatus());
    io.emit("agent_update", agentManager.listAgentDefinitions());
    io.emit("tools_update", toolManager.getToolDefinitions());
    io.emit("tasks_update", agentManager.getAllTasks());
  }, 5000);

  const mcpSessions = new Map<string, ActiveTransport>();

  app.get("/sse", async (req, res) => {
    const sessionId = uuidv4();
    const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
    const server = new McpServer({ name: "mcp-brunella-core-web", version: PACKAGE_VERSION });
    await registerAllTools(server);
    mcpSessions.set(sessionId, { transport, server });
    res.on("close", () => mcpSessions.delete(sessionId));
    await server.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId || !mcpSessions.has(sessionId)) {
      res.status(404).send("Session not found");
      return;
    }
    const { transport } = mcpSessions.get(sessionId)!;
    await transport.handlePostMessage(req, res);
  });

  // STATIC ASSETS
  app.use(express.static(path.join(process.cwd(), "build", "public")));

  // ROOT FALLBACK
  app.get("/", (_req, res) => {
    const indexPath = path.join(process.cwd(), "build", "public", "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.redirect("http://localhost:5173");
    }
  });

  // SPA FALLBACK (SAFE VERSION)
  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io") || req.path.startsWith("/audio")) {
      return next();
    }
    const indexPath = path.join(process.cwd(), "build", "public", "index.html");
    if (existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  // Start Sync
  syncService.start();

  app.use(globalErrorHandler);

  startScheduler();
  startCronScheduler();
  scheduledTasksRunner.start();
  const { trackStateManager } = await import("../services/trackStateManager.js");
  await trackStateManager.fullSync();
  trackStateManager.startWatcher();
  heartbeatMonitor.start();

  httpServer.listen(config.port, () => {
    logInfo("Server", `🌐 Web UI: http://localhost:${config.port}`);
  });
}
