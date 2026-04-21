// ── Lightweight static imports (Node built-ins + tiny deps) ──────
// ALL heavy modules (AgentManager, Socket.IO, Swagger, DB, schedulers,
// services, websocket handlers, metrics) are loaded dynamically inside
// startWebServer / deferredInit to prevent OOM at module-load time.
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import type { Server as HttpServer } from "http";
import path from "path";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "fs";
import { config } from "../../../packages/utils/schema.js";
import {
  Logger,
  logEmitter,
  type LogEvent,
  type AgentStatusEvent,
  logInfo,
  logError,
  logWarn,
  logDebug,
} from "../../../packages/utils/logger.js";
import { ensureError } from "../../../packages/utils/ensureError.js";
import type { AgentStatusPayload } from "../../../packages/agents/SocketService.js";
import {
  corsWhitelist,
  getCorsOrigins,
  requestId,
  requestLogging,
  apiRateLimit,
  requireOperatorAccess,
} from "./middleware.js";
import { getRuntimeTelemetry } from "../../../packages/utils/runtimeTelemetry.js";

const logger = new Logger("web_ui.log");

const PACKAGE_VERSION = (() => {
  try {
    const pkg = JSON.parse(
      readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"),
    );
    return typeof pkg.version === "string" ? pkg.version : "0.0.0";
  } catch (error: unknown) {
    logWarn("Server", `Unable to read package.json version: ${ensureError(error).message}`);
    return "0.0.0";
  }
})();

const UI_PUBLIC_DIR = path.join(process.cwd(), "build", "public");
const UI_INDEX_PATH = path.join(UI_PUBLIC_DIR, "index.html");

type RuntimePhase =
  | "booting"
  | "listening"
  | "socket-ready"
  | "db-ready"
  | "metrics-ready"
  | "routes-ready"
  | "agents-ready"
  | "autonomy-ready"
  | "ready"
  | "error";

interface RuntimeStatus {
  phase: RuntimePhase;
  ready: boolean;
  startedAt: string;
  lastError?: string;
}

const runtimeStatus: RuntimeStatus = {
  phase: "booting",
  ready: false,
  startedAt: new Date().toISOString(),
};

function setRuntimeStatus(update: Partial<RuntimeStatus>): void {
  Object.assign(runtimeStatus, update);
}

function allowUiDevFallback(): boolean {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  return process.env.UI_DEV_FALLBACK !== "0" && process.env.UI_DEV_FALLBACK !== "false";
}

function toAgentStatusPayload(status: string): AgentStatusPayload {
  return status === "idle" || status === "working" || status === "error" ? status : "working";
}

// ── Singleton guard: exported so index.ts can close it on shutdown ─
export let activeHttpServer: HttpServer | null = null;

/** Graceful HTTP server teardown — call from shutdown handlers */
export function shutdownWebServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!activeHttpServer) { resolve(); return; }
    activeHttpServer.close(() => resolve());
    // Force-close after 5 s to avoid hang
    setTimeout(() => resolve(), 5000);
  });
}

// PID lockfile path — one per working directory
const PID_FILE = path.join(process.cwd(), ".brunella.pid");

/** Write PID file; call once on server start */
function acquirePidLock(): void {
  if (existsSync(PID_FILE)) {
    const raw = (() => {
      try {
        return readFileSync(PID_FILE, "utf-8").trim();
      } catch (error: unknown) {
        logWarn("Server", `PID lockfile read failed: ${ensureError(error).message}`);
        return "";
      }
    })();
    const oldPid = parseInt(raw, 10);
    if (!isNaN(oldPid)) {
      // PM2 restart loop protection: if the lock already points to the current
      // process, do not self-block on restart.
      if (oldPid !== process.pid) {
        try {
          process.kill(oldPid, 0); // throws ESRCH if process is dead
          logWarn("Server",
            `Brunella mar fut! (PID ${oldPid}) — az uj folyamat KILEP, hogy megelozze a duplikaciót.\n` +
            `Ha le van allva, torold: del .brunella.pid`);
          process.exit(1);
        } catch (error: unknown) {
          const killError = error as { code?: string };
          if (killError.code === "ESRCH") {
            logInfo("Server", `Elavult PID-fajl torölve (PID ${oldPid} mar nem fut)`);
          } else {
            logWarn("Server", `PID probe failed for ${oldPid}: ${ensureError(error).message}`);
          }
        }
      }
    }
  }
  writeFileSync(PID_FILE, String(process.pid), "utf-8");
  // Remove on any form of exit
  process.once("exit", () => {
    try {
      unlinkSync(PID_FILE);
    } catch (error: unknown) {
      logWarn("Server", `Failed to remove PID file on exit: ${ensureError(error).message}`);
    }
  });
}

export async function startWebServer() {
  const webUiEnabled =
    process.env.WEB_UI_ENABLED !== "0" &&
    process.env.WEB_UI_ENABLED !== "false";
  if (!webUiEnabled) {
    logInfo("Server", "WEB_UI_ENABLED=0 -> Web UI disabled for current process");
    return;
  }

  // ── Singleton guard: prevent duplicate server processes ────────
  acquirePidLock();
  setRuntimeStatus({
    phase: "booting",
    ready: false,
    startedAt: new Date().toISOString(),
    lastError: undefined,
  });

  // ── Phase 1: Immediate HTTP server ─────────────────────────────
  // Start listening ASAP so /ping and the dashboard are available
  // while heavy initialization happens in the background.
  const app = express();

  app.get("/ping", (_req, res) => { res.send("pong"); });
  app.get("/livez", (_req, res) => {
    const runtime = getRuntimeTelemetry();
    res.status(200).json({
      status: "alive",
      phase: runtimeStatus.phase,
      ready: runtimeStatus.ready,
      pid: runtime.pid,
      uptimeSeconds: runtime.uptimeSeconds,
      version: PACKAGE_VERSION,
      runtime,
    });
  });
  app.get("/readyz", (_req, res) => {
    const uiBuilt = existsSync(UI_INDEX_PATH);
    const uiRequired = process.env.NODE_ENV === "production" && webUiEnabled;
    const ready = runtimeStatus.ready && (!uiRequired || uiBuilt);
    const statusCode = ready ? 200 : runtimeStatus.phase === "error" ? 500 : 503;
    const runtime = getRuntimeTelemetry();

    res.status(statusCode).json({
      status: ready ? "ready" : runtimeStatus.phase === "error" ? "error" : "starting",
      ready,
      phase: runtimeStatus.phase,
      uiBuilt,
      uiRequired,
      startedAt: runtimeStatus.startedAt,
      lastError: runtimeStatus.lastError,
      runtime,
    });
  });

  const jsonParser = express.json({ limit: "1mb" });
  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }
    jsonParser(req, res, next);
  });
  app.use(corsWhitelist);
  app.use(requestId);
  app.use(requestLogging);
  app.use("/api", apiRateLimit);

  app.use(express.static(UI_PUBLIC_DIR));

  const httpServer = createServer(app);
  activeHttpServer = httpServer; // expose for graceful shutdown

  await new Promise<void>((resolve) => {
    httpServer.listen(config.port, () => {
      logInfo("Server", `http://localhost:${config.port} listening (initializing...)`);
      setRuntimeStatus({ phase: "listening" });
      resolve();
    });
  });

  // ── Phase 1b: Socket.IO (must complete before startWebServer returns) ──
  // index.ts depends on socketService being initialized after this call.
  const { Server: SocketIOServer } = await import("socket.io");
  const socketCorsOrigins = getCorsOrigins();
  if (socketCorsOrigins.length === 0 && process.env.NODE_ENV === "production") {
    logWarn(
      "Server",
      "CORS_ORIGINS not set in production — Socket.IO browser origins are blocked until configured",
    );
  }
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin(origin, callback) {
        if (!origin) {
          callback(null, true);
          return;
        }

        if (socketCorsOrigins.includes(origin)) {
          callback(null, true);
          return;
        }

        callback(new Error(`Socket.IO origin not allowed: ${origin}`));
      },
      methods: ["GET", "POST"],
    },
  });
  const { socketService } = await import("../../../packages/agents/SocketService.js");
  socketService.init(io);
  setRuntimeStatus({ phase: "socket-ready" });

  // ── Fire-and-forget: heavy background initialization ───────────
  deferredInit(app, httpServer, io).catch((e) => {
    const message = e instanceof Error ? e.message : String(e);
    setRuntimeStatus({ phase: "error", ready: false, lastError: message });
    logError("Server", `Deferred init error: ${message}`);
  });
}

// Yield control to the event loop so HTTP requests are processed between phases.
const yieldToEventLoop = () => new Promise<void>(r => setImmediate(r));

// ── Background initialization (Phases 2-7) ────────────────────────
// Each phase dynamically imports its dependencies so they are loaded
// on-demand instead of at module-load time.
// CRITICAL: yieldToEventLoop() between phases prevents event loop starvation.
async function deferredInit(
  app: express.Express,
  httpServer: HttpServer,
  io: InstanceType<typeof import("socket.io").Server>,
) {
  // ── Phase 2: Database initialization (error-tolerant) ──────────
  try {
    const { initDb } = await import("../../../packages/utils/db.js");
    initDb();
  } catch (e: unknown) {
    logError("Server", `DB Init failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { initTasksDb } = await import("../../../packages/utils/tasksDb.js");
    initTasksDb();
  } catch (e: unknown) {
    logError("Server", `Tasks DB Init failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { initTestResultsDb } = await import("../../../packages/core-logic/testResultsService.js");
    await initTestResultsDb("data/brunella.db");
  } catch (e: unknown) {
    logError("Server", `Test Results DB Init failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { initSuggestedTasksDb } = await import("../../../packages/core-logic/suggestedTasksScanner.js");
    await initSuggestedTasksDb("data/brunella.db");
  } catch (e: unknown) {
    logError("Server", `Suggested Tasks DB Init failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  logInfo("Server", "Phase 2 complete: databases initialized");
  setRuntimeStatus({ phase: "db-ready" });
  await yieldToEventLoop();

  // ── Phase 3: Metrics & MCP Bridge ──────────────────────────────
  const {
    initMetrics,
    getPrometheusContentType,
    getPrometheusMetrics,
    recordHttpRequest,
  } = await import("../../../packages/utils/metrics.js");
  initMetrics();

  let mcpProcMgrRef: typeof import("./McpProcessManager.js").mcpProcessManager | null = null;

  try {
    const mod = await import("./McpProcessManager.js");
    mcpProcMgrRef = mod.mcpProcessManager;
    await mod.mcpProcessManager.loadConfig();
    const forceStdio = ["1", "true", "yes", "on"].includes(
      (process.env.BRUNELLA_FORCE_STDIO ?? "").trim().toLowerCase(),
    );
    if (!process.stdin.isTTY && !forceStdio) {
      mod.mcpProcessManager.markInternalServerRunning("brunella-core");
    }
    const configured = mod.mcpProcessManager.getServersStatus();
    logInfo("Server", `${configured.length} MCP server(s) configured`);
    void mod.mcpProcessManager.startAutoStartServers().catch((e: unknown) => {
      logError(
        "Server",
        `MCP auto-start failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    });
  } catch (e: unknown) {
    logError("Server", `MCP config load failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  logInfo("Server", "Phase 3 complete: metrics & MCP bridge");
  setRuntimeStatus({ phase: "metrics-ready" });
  await yieldToEventLoop();

  // ── Phase 4: API routes + Swagger ──────────────────────────────
  try {
    const swaggerUi = (await import("swagger-ui-express")).default;
    const { swaggerSpec } = await import("./swagger.js");
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  } catch (e: unknown) {
    logWarn("Server", `Swagger init failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  const { createV1Router } = await import("./routes/index.js");
  const { createOnboardingIntakeRoutes } = await import("./routes/onboardingIntake.js");
  const v1Router = createV1Router();
  const onboardingIntakeRouter = createOnboardingIntakeRoutes();

  app.use("/api/v1", v1Router);
  app.use("/api/v1/webhook/onboarding-intake", onboardingIntakeRouter);
  app.use("/api", v1Router);

  app.get("/metrics", async (_req, res) => {
    try {
      res.set("Content-Type", getPrometheusContentType());
      const metrics = await getPrometheusMetrics();
      res.end(metrics);
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  logInfo("Server", "Phase 4 complete: API routes mounted");
  setRuntimeStatus({ phase: "routes-ready" });
  await yieldToEventLoop();

  // ── Phase 5: AgentManager + ToolManager + Socket handlers ──────
  const { socketService } = await import("../../../packages/agents/SocketService.js");
  const { agentManager, initializeAgentManager } = await import("../../../packages/agents/AgentManager.js");
  const { toolManager } = await import("./ToolManager.js");

  // Wire up socketService so agents can broadcast status updates
  initializeAgentManager(socketService);

  // Specialized agents (dynamic — saves ~500MB at startup)
  try {
    const [
      { InnovationBridgeAgent },
      { DigitalHeadhunterAgent },
      { GrantHunter },
      { LawDetectiveAgent },
      { PropertyVisionaryAgent },
      { ViktoriaPhygitalAgent },
    ] = await Promise.all([
      import("../../../packages/agents/InnovationBridgeAgent.js"),
      import("../../../packages/agents/DigitalHeadhunterAgent.js"),
      import("../../../packages/agents/GrantHunter.js"),
      import("../../../packages/agents/LawDetectiveAgent.js"),
      import("../../../packages/agents/PropertyVisionaryAgent.js"),
      import("../../../packages/agents/ViktoriaPhygitalAgent.js"),
    ]);
    agentManager.registerAgent(new InnovationBridgeAgent());
    agentManager.registerAgent(new DigitalHeadhunterAgent());
    agentManager.registerAgent(new GrantHunter());
    agentManager.registerAgent(new LawDetectiveAgent());
    agentManager.registerAgent(new PropertyVisionaryAgent());
    agentManager.registerAgent(new ViktoriaPhygitalAgent());
  } catch (e: unknown) {
    logError("Server", `Specialized agent registration failed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // WebSocket connection handlers
  io.on("connection", (socket) => {
    const statuses = agentManager.listAgentStatuses();
    socket.emit("agents:snapshot", statuses);
    socket.on("robotkez:abort", async () => {
      const { persistentBrowser } = await import("../../../packages/utils/persistentBrowser.js");
      await persistentBrowser.close();
      persistentBrowser.forceKill();
      socket.emit("robotkez:aborted", { status: "success", message: "Munkamenet megszakítva." });
    });
  });

  io.of("/robotkez-overlay").on("connection", (socket) => {
    socket.on("user_message", async (msg: { text: string }) => {
      try {
        const { robotkezBridge } = await import("../../../packages/core-logic/robotkez_bridge.js");
        const response = await robotkezBridge.handleMessage(msg.text);
        socket.emit("message", { text: response });
      } catch (e: unknown) {
        socket.emit("message", { text: `Hiba: ${e instanceof Error ? e.message : String(e)}` });
      }
    });
  });

  try {
    const { registerEdgeWebSocketHandlers, registerCEANWebSocketHandlers, registerFleetWebSocketHandlers } =
      await import("./websocket.js");
    registerEdgeWebSocketHandlers(io);
    registerCEANWebSocketHandlers(io);
    registerFleetWebSocketHandlers(io);
  } catch (e: unknown) {
    logWarn("Server", `WebSocket handlers: ${e instanceof Error ? e.message : String(e)}`);
  }

  logInfo("Server", "Phase 5 complete: agents & websocket handlers");
  setRuntimeStatus({ phase: "agents-ready" });
  await yieldToEventLoop();

  // ── Phase 6: Phoenix, ZeroPrompt, CEAN, Pipeline ───────────────
  try {
    const { phoenixEventBus } = await import("../../../packages/core-logic/phoenixEventBus.js");
    const { initializeBuiltinHooks } = await import("../../../packages/core-logic/hooks/builtinHooks.js");
    initializeBuiltinHooks();
    phoenixEventBus.connectSocketBroadcaster((event: string, data: unknown) => {
      socketService.emit(event, data);
    });
  } catch (e: unknown) {
    logWarn("Server", `Phoenix EventBus: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { zeroPromptRuntime } = await import("../../../packages/core-logic/zeroPromptRuntime.js");
    const { githubRemediationRuntime } = await import("../../../packages/core-logic/githubRemediationRuntime.js");
    const { approvalManager } = await import("../../../packages/utils/approvalManager.js");
    const { approvalRouter } = await import("../../../packages/core-logic/approvalRouter.js");
    const { ephemeralAgentManager } = await import("../../../packages/core-logic/ephemeralAgentManager.js");
    const { trustRegistry } = await import("../../../packages/core-logic/federation/trustRegistry.js");
    const { capabilityManifestManager } = await import("../../../packages/core-logic/federation/capabilityManifest.js");
    const { negotiationProtocol } = await import("../../../packages/core-logic/federation/negotiationProtocol.js");
    const { notificationChannels } = await import("../../../packages/core-logic/notificationChannels.js");

    try {
      capabilityManifestManager.assertSigningSecretConfigured();
    } catch (e: unknown) {
      logWarn("Server", `Federation manifest signing: ${e instanceof Error ? e.message : String(e)}`);
    }
    const restoredApprovals = approvalManager.hydrateFromStore();
    const restoredWorkflows = approvalRouter.hydrateFromStore();
    const restoredEphemeral = ephemeralAgentManager.hydrateFromStore();
    const restoredPeers = trustRegistry.hydrateFromStore();
    const restoredManifests = capabilityManifestManager.hydrateFromStore();
    const restoredNegotiations = negotiationProtocol.hydrateFromStore();
    const restoredDeliveries = notificationChannels.hydrateFromStore();
    const restoredRemediationRuns = githubRemediationRuntime.hydrateFromStore();

    zeroPromptRuntime.start();
    githubRemediationRuntime.start();
    logInfo(
      "Server",
      `Autonomy runtime restored: approvals=${restoredApprovals}, workflows=${restoredWorkflows}, ephemeral=${restoredEphemeral}, peers=${restoredPeers}, manifests=${restoredManifests}, negotiations=${restoredNegotiations}, deliveries=${restoredDeliveries}, remediationRuns=${restoredRemediationRuns}`,
    );
  } catch (e: unknown) {
    logWarn("Server", `ZeroPrompt runtime: ${e instanceof Error ? e.message : String(e)}`);
  }

  import("../../../packages/core-logic/ceanFallback.js").catch((e: unknown) => {
    logWarn("Server", `CEAN fallback: ${e instanceof Error ? e.message : String(e)}`);
  });

  try {
    const { githubPollingService } = await import("../../../packages/core-logic/githubPollingService.js");
    githubPollingService.loadConfig(".github-polling.json");
    githubPollingService.startPolling();
  } catch (e: unknown) {
    logWarn("Server", `GitHub polling: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { pipelineRunner } = await import("../../../packages/agents/developerPipeline.js");
    pipelineRunner.on("progress", (event: unknown) => {
      socketService.emit("developer:progress", event);
    });
  } catch (e: unknown) {
    logWarn("Server", `Pipeline runner: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { initializeInvoicePipeline } = await import("../../../packages/core-logic/invoicePipeline.js");
    initializeInvoicePipeline();
    logInfo("Server", "L5 Invoice Pipeline initialized");
  } catch (e: unknown) {
    logWarn("Server", `Invoice Pipeline: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { initializeSdlcHooks } = await import("../../../packages/core-logic/sdlcHooks.js");
    initializeSdlcHooks();
    logInfo("Server", "SDLC Hooks initialized");
  } catch (e: unknown) {
    logWarn("Server", `SDLC Hooks: ${e instanceof Error ? e.message : String(e)}`);
  }

  logInfo("Server", "Phase 6 complete: Phoenix, ZeroPrompt, CEAN");
  setRuntimeStatus({ phase: "autonomy-ready" });
  await yieldToEventLoop();

  // ── Phase 6.5: Start AgentManager worker loop ──────────────────
  // (only deferredInit does this; index.ts only does it in MCP/TTY mode)
  try {
    agentManager.startWorkerLoop();
  } catch (e: unknown) {
    logWarn("Server", `Worker loop start: ${e instanceof Error ? e.message : String(e)}`);
  }
  await yieldToEventLoop();

  // ── Phase 7: Request metrics, log forwarding, system intervals ─
  const os = await import("os");

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
    socketService.updateAgentStatus(entry.agentName, toAgentStatusPayload(entry.status), entry.message);
  });

  // System metrics broadcast — staggered recurring setTimeout (not setInterval)
  // Uses setTimeout chain so each tick yields before scheduling the next
  const mcpProcMgr = mcpProcMgrRef ?? (await import("./McpProcessManager.js")).mcpProcessManager;
  function scheduleMetricsBroadcast() {
    setTimeout(() => {
      try {
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
        io.emit("mcp_servers_status", mcpProcMgr.getServersStatus());
        // Stagger heavy agent/tool data emissions into setImmediate so event loop breathes
        setImmediate(() => {
          try {
            io.emit("agent_update", agentManager.listAgentDefinitions());
            io.emit("tools_update", toolManager.getToolDefinitions());
          } catch (error: unknown) {
            logDebug("Server", `Agent/tool update emit skipped: ${ensureError(error).message}`);
          }
          setImmediate(() => {
            try {
              io.emit("tasks_update", agentManager.getAllTasks());
            } catch (error: unknown) {
              logDebug("Server", `Task update emit skipped: ${ensureError(error).message}`);
            }
          });
        });
      } catch (e: unknown) {
        logWarn("Server", `Metrics broadcast error: ${ensureError(e).message}`);
      }
      scheduleMetricsBroadcast();
    }, 5000);
  }
  scheduleMetricsBroadcast();

  // ── MCP SSE bridge ─────────────────────────────────────────────
  const mcpSessions = new Map<string, { transport: any; server: any }>();

  app.get("/sse", requireOperatorAccess, async (req, res) => {
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { SSEServerTransport } = await import("@modelcontextprotocol/sdk/server/sse.js");
    const { registerAllTools } = await import("./registry.js");
    const transport = new SSEServerTransport("/messages", res);
    const server = new McpServer({ name: "mcp-brunella-core-web", version: PACKAGE_VERSION });
    await registerAllTools(server);
    mcpSessions.set(transport.sessionId, { transport, server });
    transport.onclose = () => {
      mcpSessions.delete(transport.sessionId);
    };
    await server.connect(transport);
  });

  app.post("/messages", requireOperatorAccess, async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId || !mcpSessions.has(sessionId)) {
      res.status(404).send("Session not found");
      return;
    }
    const { transport } = mcpSessions.get(sessionId)!;
    await transport.handlePostMessage(req, res, req.body);
  });

  // ── Root & SPA fallback (MUST be AFTER api routes) ─────────────
  app.get("/", (_req, res) => {
    if (existsSync(UI_INDEX_PATH)) {
      res.sendFile(UI_INDEX_PATH);
      return;
    }

    if (allowUiDevFallback()) {
      res.redirect("http://localhost:5173");
      return;
    }

    res.status(503).json({
      error: "Dashboard static build is missing",
      expectedPath: UI_INDEX_PATH,
    });
  });

  app.use((req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/socket.io") || req.path.startsWith("/audio")) {
      return next();
    }
    if (existsSync(UI_INDEX_PATH)) {
      res.sendFile(UI_INDEX_PATH);
      return;
    }

    if (allowUiDevFallback()) {
      res.redirect(`http://localhost:5173${req.originalUrl}`);
      return;
    }

    next();
  });

  // ── Schedulers, sync, heartbeat (last phase) ───────────────────
  try {
    const { syncService } = await import("../../../packages/utils/syncService.js");
    syncService.start();
  } catch (e: unknown) {
    logWarn("Server", `Sync service: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { globalErrorHandler } = await import("./middleware/errorHandler.js");
    app.use(globalErrorHandler);
  } catch (e: unknown) {
    logWarn("Server", `Error handler: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { startScheduler } = await import("./schedulers/testRunner.js");
    startScheduler();
  } catch (e: unknown) {
    logWarn("Server", `Test runner scheduler: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { startScheduler: startCronScheduler } = await import("./cron.js");
    startCronScheduler();
  } catch (e: unknown) {
    logWarn("Server", `Cron scheduler: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { scheduledTasksRunner } = await import("./schedulers/scheduledTasksRunner.js");
    scheduledTasksRunner.start();
  } catch (e: unknown) {
    logWarn("Server", `Scheduled tasks runner: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { trackStateManager } = await import("../../../packages/core-logic/trackStateManager.js");
    setImmediate(() => {
      void trackStateManager.fullSync().catch((e: unknown) => {
        logWarn("Server", `Track state manager fullSync: ${e instanceof Error ? e.message : String(e)}`);
      });
    });
    trackStateManager.startWatcher();
  } catch (e: unknown) {
    logWarn("Server", `Track state manager: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const { heartbeatMonitor } = await import("../../../packages/utils/heartbeatMonitor.js");
    const { fastApiService } = await import("../../../packages/core-logic/fastApiService.js");
    heartbeatMonitor.onFailure("fastapi", async (health) => {
      logError("Phoenix", `FastAPI service failed: ${health.error}`);
      logInfo("Phoenix", "Triggering FastAPI silent restart...");
      await fastApiService.restart();
    });
    heartbeatMonitor.start();
  } catch (e: unknown) {
    logWarn("Server", `Heartbeat monitor: ${e instanceof Error ? e.message : String(e)}`);
  }

  setRuntimeStatus({ phase: "ready", ready: true, lastError: undefined });
  logInfo("Server", `Fully initialized on http://localhost:${config.port}`);
}

