import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { readFileSync } from "fs";
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
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./registry.js";
import { v4 as uuidv4 } from "uuid";
import { toolManager } from "./ToolManager.js";
import { mcpProcessManager } from "./McpProcessManager.js";
import { mcpClientManager } from "../utils/mcpClientManager.js";
import { agentManager } from "../agents/AgentManager.js";
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
import { createAuditRouter } from "./auditRoutes.js";
import { createSpecRouter } from "./specRoutes.js";
import { createPhoenixRouter } from "./phoenixRoutes.js";
import { createRouterRouter } from "./routerRoutes.js";
import { createMemoryRouter } from "./memoryRoutes.js";
import { createTracksRouter } from "./tracksRoutes.js";
import { createV1Router } from "./routes/index.js";
import { createRobotkezRoutes } from "./routes/robotkez.js";
import { registerEdgeWebSocketHandlers } from "./websocket.js";

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
    logError("Server", "WEB_UI_ENABLED=0 -> Web UI disabled");
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

  // Előzetes ügynök regisztráció (hogy az API végpontok működjenek SSE előtt is)
  // Megjegyzés: Ez már megtörténik az index.ts-ben a registerAllTools-on keresztül.

  const app = express();
  app.use(express.json());
  app.use(corsWhitelist);
  app.use(requestId);
  app.use(requestLogging);
  app.use("/api", apiRateLimit);

  /**
   * @swagger
   * /metrics:
   *   get:
   *     summary: Prometheus metrics scrape endpoint
   *     description: Exposes BAS runtime metrics in Prometheus text format.
   *     responses:
   *       200:
   *         description: Prometheus metrics text payload
   */
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

  // Swagger UI
  app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

  // --- API Versioning (Phase 8) ---
  const v1Router = createV1Router();

  // Add Gold Protocol routes to v1
  v1Router.use("/telemetry", createTelemetryRouter());
  v1Router.use("/audit", createAuditRouter());
  v1Router.use("/specs", createSpecRouter());
  v1Router.use("/phoenix", createPhoenixRouter());
  v1Router.use("/router", createRouterRouter());
  v1Router.use("/memory", createMemoryRouter());

  // Add Tracks routes (EPP v2)
  v1Router.use("/tracks", createTracksRouter());

  // Add Robotkéz routes to v1
  v1Router.use("/robotkez", createRobotkezRoutes());

  // Mount v1 router at /api/v1 and /api (backwards compatibility)
  app.use("/api/v1", v1Router);
  app.use("/api", v1Router);

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

  // Register Cloudflare Edge WebSocket handlers (Iteration 2)
  registerEdgeWebSocketHandlers(io);

  const agentLogBuffer = new Map<string, LogEvent[]>();
  const MAX_AGENT_LOGS = 500;

  // Metrics counters
  let requestCount = 0;
  let errorCount = 0;
  let lastMinuteRequests = 0;
  let lastMinuteErrors = 0;

  // Reset per-minute counters every 60s
  setInterval(() => {
    lastMinuteRequests = requestCount;
    lastMinuteErrors = errorCount;
    requestCount = 0;
    errorCount = 0;
  }, 60000);

  // Middleware to count requests and errors
  app.use((_req, res, next) => {
    const requestStart = Date.now();
    requestCount++;

    res.on("finish", () => {
      if (res.statusCode >= 400) errorCount++;
      const durationMs = Date.now() - requestStart;
      const method = _req.method || "UNKNOWN";
      const routePath = _req.route?.path
        ? String(_req.route.path)
        : _req.path || "unknown";
      recordHttpRequest(method, routePath, res.statusCode, durationMs);
    });

    next();
  });

  logEmitter.on("log", (entry: LogEvent) => {
    const source = entry.agent || entry.source;
    const type =
      entry.level === "error"
        ? "error"
        : entry.level === "success"
          ? "success"
          : "info";
    socketService.broadcastLog(entry.message, type, source);

    if (entry.agent) {
      const list = agentLogBuffer.get(entry.agent) || [];
      list.push(entry);
      if (list.length > MAX_AGENT_LOGS)
        list.splice(0, list.length - MAX_AGENT_LOGS);
      agentLogBuffer.set(entry.agent, list);
    }
  });

  logEmitter.on("agent_status", (entry: AgentStatusEvent) => {
    socketService.updateAgentStatus(
      entry.agent,
      entry.status as any,
      entry.task,
    );
  });

  // Metrics Loop
  setInterval(() => {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpus = os.cpus();
    const cpuUsage =
      cpus.reduce((acc, cpu) => {
        const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
        return acc + ((total - cpu.times.idle) / total) * 100;
      }, 0) / cpus.length;

    io.emit("metrics_update", {
      requestsPerMinute: lastMinuteRequests,
      activeConnections: io.sockets.sockets.size,
      errorRate:
        lastMinuteRequests > 0
          ? (lastMinuteErrors / lastMinuteRequests) * 100
          : 0,
      averageResponseTime: 0,
      cpuUsage: Math.round(cpuUsage * 100) / 100,
      memoryUsage: ((totalMem - freeMem) / totalMem) * 100,
    });
    io.emit("mcp_servers_status", mcpProcessManager.getServersStatus());

    // Push Agent & Tool status updates
    io.emit("agent_update", agentManager.listAgentDefinitions());
    io.emit("tools_update", toolManager.getToolDefinitions());
    io.emit("tasks_update", agentManager.getAllTasks());
  }, 5000);

  const mcpSessions = new Map<string, ActiveTransport>();

  app.get("/sse", async (req, res) => {
    const sessionId = uuidv4();
    const transport = new SSEServerTransport(
      `/messages?sessionId=${sessionId}`,
      res,
    );
    const server = new McpServer({
      name: "mcp-brunella-core-web",
      version: PACKAGE_VERSION,
    });

    await registerAllTools(server);
    logger.info(
      `Registered Agents after init: ${JSON.stringify(agentManager.listAgentDefinitions())}`,
    );
    mcpSessions.set(sessionId, { transport, server });

    res.on("close", () => {
      mcpSessions.delete(sessionId);
    });

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

  app.use(express.static(path.join(process.cwd(), "build", "public")));

  // Global error handler (MUST be after all routes)
  app.use(globalErrorHandler);

  io.on("connection", (socket) => {
    const DEFAULT_CHAT_ID = "main-session";
    logInfo("Server", "Client connected to Dashboard");
    socket.emit("system:log", {
      message: "Rendszer indítása... Mission Control csatlakozva.",
      type: "success",
      timestamp: Date.now(),
    });

    socket.emit("tools_update", toolManager.getToolDefinitions());
    socket.emit("mcp_servers_status", mcpProcessManager.getServersStatus());

    socket.on(
      "run_tool",
      async (data: { name: string; args: any; id?: string }) => {
        logInfo("Server", `Socket Tool Run Request: ${data.name}`);
        try {
          // Try local toolManager first
          let result;
          try {
            result = await toolManager.executeTool(data.name, data.args);
          } catch (e) {
            // Try MCP Clients if local fails
            const clientNames = mcpClientManager.getClientNames();
            let found = false;
            for (const clientName of clientNames) {
              const mcpTools = await mcpClientManager.listTools(clientName);
              if (mcpTools.tools.some((t) => t.name === data.name)) {
                result = await mcpClientManager.callTool(
                  clientName,
                  data.name,
                  data.args,
                );
                found = true;
                break;
              }
            }
            if (!found) throw e;
          }
          socket.emit("tool_result", {
            name: data.name,
            result: result,
            id: data.id,
          });
        } catch (e: any) {
          socket.emit("tool_error", {
            name: data.name,
            error: e.message,
            id: data.id,
          });
        }
      },
    );

    // Chat Logic
    socket.on("user_message", async (data) => {
      const userMsg = data.text;
      const provider = data.provider || 'github';
      const model = data.model;

      saveMessage(DEFAULT_CHAT_ID, "user", userMsg);
      socket.emit("bot_message_start", { isUser: false });

      try {
        // Cloudflare Workers AI path
        if (provider === 'cloudflare') {
          const chatHistory = await getMessages(DEFAULT_CHAT_ID);
          const recentHistory = chatHistory.slice(-10); // Get last 10 messages
          const history = recentHistory.map((msg) => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content,
          }));

          const response = await fetch('http://localhost:3000/api/cloudflare/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instruction: userMsg,
              history: history,
              model: model,
            }),
          });

          if (!response.ok) {
            throw new Error(`Cloudflare chat failed: ${response.status}`);
          }

          const result = await response.json();
          const message = result.message || result.response || 'No response';

          socket.emit("bot_message_chunk", { text: message });
          saveMessage(DEFAULT_CHAT_ID, "bot", message);
          socket.emit("bot_message_end", {});
          return;
        }

        // Default Agent Manager path (GitHub, Gemini, Ollama)
        const plan = await agentManager.createPlan(userMsg);
        socket.emit("plan_created", plan);

        const result = await agentManager.executePlan(
          plan,
          (event: any, eventData: any) => {
            socket.emit(event, eventData);
          },
        );

        socket.emit("bot_message_chunk", { text: result });
        saveMessage(DEFAULT_CHAT_ID, "bot", result);
        socket.emit("bot_message_end", {});
      } catch (e: any) {
        const errMsg = `⚠️ Hiba: ${e.message}`;
        socket.emit("bot_message_chunk", { text: errMsg });
        saveMessage(DEFAULT_CHAT_ID, "bot", errMsg);
        socket.emit("bot_message_end", {});
      }
    });
  });

  httpServer.listen(config.port, () => {
    logInfo("Server", `🌐 Web UI: http://localhost:${config.port}`);
  });
}
