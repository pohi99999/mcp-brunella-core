import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
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
import { initDb, saveMessage } from "../utils/db.js";
import { initTasksDb } from "../utils/tasksDb.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from "./registry.js";
import { v4 as uuidv4 } from "uuid";
import { toolManager } from "./ToolManager.js";
import { mcpProcessManager } from "./McpProcessManager.js";
import { mcpClientManager } from "../utils/mcpClientManager.js";
import { agentManager } from "../agents/AgentManager.js";
import {
  corsWhitelist,
  requestId,
  requestLogging,
  apiRateLimit,
} from "./middleware.js";
import { swaggerSpec } from "./swagger.js";
import { socketService } from "./SocketService.js";
import { globalErrorHandler } from "./middleware/errorHandler.js";
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

// Javított robotkezTasks típus
const robotkezTasks = new Map<
  string,
  { status: "in-progress" | "completed" | "failed"; result?: unknown }
>();

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

  // Auto-connect to configured MCP servers (Stub for now based on configManager)
  // In a real scenario, we would read from mcp_servers.json
  logInfo("Server", "🔄 Starting MCP Bridge...");

  // Előzetes ügynök regisztráció (hogy az API végpontok működjenek SSE előtt is)
  // Megjegyzés: Ez már megtörténik az index.ts-ben a registerAllTools-on keresztül.

  const app = express();
  app.use(express.json());
  app.use(corsWhitelist);
  app.use(requestId);
  app.use(requestLogging);
  app.use("/api", apiRateLimit);

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
    requestCount++;
    res.on("finish", () => {
      if (res.statusCode >= 400) errorCount++;
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
      version: "1.0.0",
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
      const options = {
        model: data.model,
        provider: data.provider,
      };
      saveMessage(DEFAULT_CHAT_ID, "user", userMsg);
      socket.emit("bot_message_start", { isUser: false });

      try {
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
        socket.emit("bot_message", { text: errMsg });
        saveMessage(DEFAULT_CHAT_ID, "bot", errMsg);
      }
    });

    // Robotkéz API végpontok
    app.post("/api/v1/robotkez/task", async (req, res) => {
      const taskId = uuidv4();
      const { task, headless = true, vision = true } = req.body;

      if (!task) {
        res.status(400).send({ error: "A 'task' mező kötelező." });
        return;
      }

      robotkezTasks.set(taskId, { status: "in-progress" });

      try {
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        const command = `python myai/browser_task_runner.py --task "${task}" --headless ${headless} --vision ${vision}`;
        const { stdout } = await execAsync(command);

        // Csak az stdout feldolgozása JSON-ként
        const result = JSON.parse(stdout);

        robotkezTasks.set(taskId, { status: "completed", result });
        res.status(200).send({ taskId });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Ismeretlen hiba";
        robotkezTasks.set(taskId, { status: "failed", result: errorMessage });
        res
          .status(500)
          .send({ error: "Feladat végrehajtási hiba.", details: errorMessage });
      }
    });

    app.get("/api/v1/robotkez/task/:id", (req, res) => {
      const { id } = req.params;
      const task = robotkezTasks.get(id);

      if (!task) {
        res.status(404).send({ error: "Feladat nem található." });
        return;
      }

      res.status(200).send(task);
    });
  });

  httpServer.listen(config.port, () => {
    logInfo("Server", `🌐 Web UI: http://localhost:${config.port}`);
  });
}
