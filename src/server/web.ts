import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import swaggerUi from 'swagger-ui-express';
import { config } from '../config/schema.js';
import { Logger, logEmitter, type LogEvent, type AgentStatusEvent, logInfo, logError, logWarn } from '../utils/logger.js';
import { initDb, saveMessage } from '../utils/db.js';
import { initTasksDb } from '../utils/tasksDb.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from './registry.js';
import { v4 as uuidv4 } from 'uuid';
import { toolManager } from './ToolManager.js';
import { mcpProcessManager } from './McpProcessManager.js';
import { mcpClientManager } from '../utils/mcpClientManager.js';
import { agentManager } from '../agents/AgentManager.js';
import { corsWhitelist, requestId, requestLogging, apiRateLimit } from './middleware.js';
import { swaggerSpec } from './swagger.js';
import { socketService } from './SocketService.js';
import { globalErrorHandler } from './middleware/errorHandler.js';
import { createTelemetryRouter } from './telemetryRoutes.js';
import { createAuditRouter } from './auditRoutes.js';
import { createSpecRouter } from './specRoutes.js';
import { createPhoenixRouter } from './phoenixRoutes.js';
import { createRouterRouter } from './routerRoutes.js';
import { createMemoryRouter } from './memoryRoutes.js';
import {
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
} from './routes/index.js';

const logger = new Logger('web_ui.log');

const corsOriginList = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

interface ActiveTransport {
    transport: SSEServerTransport;
    server: McpServer;
}

export async function startWebServer() {
    const webUiEnabled = process.env.WEB_UI_ENABLED !== "0" && process.env.WEB_UI_ENABLED !== "false";
    if (!webUiEnabled) {
        logError('Server', "WEB_UI_ENABLED=0 -> Web UI disabled");
        return;
    }

    try {
        initDb();
    } catch (e: any) {
        logError('Server', `DB Init failed: ${e.message}`);
    }

    try {
        initTasksDb();
    } catch (e: any) {
        logError('Server', `Tasks DB Init failed: ${e.message}`);
    }

    // Auto-connect to configured MCP servers (Stub for now based on configManager)
    // In a real scenario, we would read from mcp_servers.json
    logInfo('Server', "🔄 Starting MCP Bridge...");

    // Előzetes ügynök regisztráció (hogy az API végpontok működjenek SSE előtt is)
    // Megjegyzés: Ez már megtörténik az index.ts-ben a registerAllTools-on keresztül.

    const app = express();
    app.use(express.json());
    app.use(corsWhitelist);
    app.use(requestId);
    app.use(requestLogging);
    app.use('/api', apiRateLimit);

    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    // Gold Protocol: Telemetry routes (G5.2)
    app.use('/api/telemetry', createTelemetryRouter());

    // Gold Protocol: Audit routes (G6.2)
    app.use('/api/audit', createAuditRouter());

    // Gold Protocol: Spec routes (G7.1)
    app.use('/api/specs', createSpecRouter());

    // Gold Protocol: Phoenix routes (G7.2)
    app.use('/api/phoenix', createPhoenixRouter());

    // Gold Protocol: Router routes (G7.3)
    app.use('/api/router', createRouterRouter());

    // Gold Protocol: Memory routes (G7.4)
    app.use('/api/memory', createMemoryRouter());

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: corsOriginList.length > 0 ? corsOriginList : ['http://localhost:5173', 'http://localhost:3000', '*'],
            methods: ['GET', 'POST'],
        },
    });
    socketService.init(io);

    const agentLogBuffer = new Map<string, LogEvent[]>();
    const MAX_AGENT_LOGS = 500;

    logEmitter.on('log', (entry: LogEvent) => {
        const source = entry.agent || entry.source;
        const type = entry.level === 'error' ? 'error' : entry.level === 'success' ? 'success' : 'info';
        socketService.broadcastLog(entry.message, type, source);

        if (entry.agent) {
            const list = agentLogBuffer.get(entry.agent) || [];
            list.push(entry);
            if (list.length > MAX_AGENT_LOGS) list.splice(0, list.length - MAX_AGENT_LOGS);
            agentLogBuffer.set(entry.agent, list);
        }
    });

    logEmitter.on('agent_status', (entry: AgentStatusEvent) => {
        socketService.updateAgentStatus(entry.agent, entry.status as any, entry.task);
    });

    // Metrics Loop
    setInterval(() => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        io.emit('metrics_update', {
            requestsPerMinute: 0, // TODO: Track requests
            activeConnections: io.sockets.sockets.size,
            errorRate: 0, // TODO: Track errors
            averageResponseTime: 0,
            cpuUsage: 0, // TODO: Use os-utils for CPU
            memoryUsage: ((totalMem - freeMem) / totalMem) * 100
        });
        io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());

        // Push Agent & Tool status updates
        io.emit('agent_update', agentManager.listAgentDefinitions());
        io.emit('tools_update', toolManager.getToolDefinitions());
        io.emit('tasks_update', agentManager.getAllTasks());
    }, 5000);

    const mcpSessions = new Map<string, ActiveTransport>();

    app.get('/sse', async (req, res) => {
        const sessionId = uuidv4();
        const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
        const server = new McpServer({
            name: "mcp-brunella-core-web",
            version: "1.0.0",
        });

        await registerAllTools(server);
        logger.info(`Registered Agents after init: ${JSON.stringify(agentManager.listAgentDefinitions())}`);
        mcpSessions.set(sessionId, { transport, server });

        res.on('close', () => {
            mcpSessions.delete(sessionId);
        });

        await server.connect(transport);
    });

    app.post('/messages', async (req, res) => {
        const sessionId = req.query.sessionId as string;
        if (!sessionId || !mcpSessions.has(sessionId)) {
            res.status(404).send("Session not found");
            return;
        }
        const { transport } = mcpSessions.get(sessionId)!;
        await transport.handlePostMessage(req, res);
    });

    // --- REST API Routes ---
    app.use('/api/health', createHealthRoutes());
    app.use('/api/agents', createAgentRoutes());
    app.use('/api/registry', createRegistryRoutes());
    app.use('/api/cloudflare/agents', createCloudflareAgentRoutes());
    app.use('/api/providers', createProvidersRoutes());
    app.use('/api/ollama', createOllamaRoutes());
    app.use('/api/gemini', createGeminiRoutes());
    app.use('/api/github-models', createGithubModelsRoutes());
    app.use('/api/files', createFileRoutes());
    app.use('/api/rag', createRagRoutes());
    app.use('/api/tasks', createTaskRoutes());
    app.use('/api/tools', createToolRoutes());
    app.use('/api/debug', createDebugRoutes());
    app.use('/api/chat', createChatRoutes());
    app.use('/api/anythingllm', createAnythingLLMRoutes());
    app.use('/api/incubator', createIncubatorRoutes());
    app.use('/api/n8n', createN8nRoutes());

    app.use(express.static(path.join(process.cwd(), 'build', 'public')));

    // Global error handler (MUST be after all routes)
    app.use(globalErrorHandler);

    io.on('connection', (socket) => {
        const DEFAULT_CHAT_ID = 'main-session';
        logInfo('Server', 'Client connected to Dashboard');
        socket.emit('system:log', { message: 'Rendszer indítása... Mission Control csatlakozva.', type: 'success', timestamp: Date.now() });

        socket.emit('tools_update', toolManager.getToolDefinitions());
        socket.emit('mcp_servers_status', mcpProcessManager.getServersStatus());

        socket.on('run_tool', async (data: { name: string, args: any, id?: string }) => {
            logInfo('Server', `Socket Tool Run Request: ${data.name}`);
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
                        if (mcpTools.tools.some(t => t.name === data.name)) {
                            result = await mcpClientManager.callTool(clientName, data.name, data.args);
                            found = true;
                            break;
                        }
                    }
                    if (!found) throw e;
                }
                socket.emit('tool_result', { name: data.name, result: result, id: data.id });
            } catch (e: any) {
                socket.emit('tool_error', { name: data.name, error: e.message, id: data.id });
            }
        });

        // Chat Logic
        socket.on('user_message', async (data) => {
            const userMsg = data.text;
            const options = {
                model: data.model,
                provider: data.provider
            };
            saveMessage(DEFAULT_CHAT_ID, 'user', userMsg);
            socket.emit('bot_message_start', { isUser: false });

            try {
                const plan = await agentManager.createPlan(userMsg);
                socket.emit('plan_created', plan);

                const result = await agentManager.executePlan(plan, (event: any, eventData: any) => {
                    socket.emit(event, eventData);
                });

                socket.emit('bot_message_chunk', { text: result });
                saveMessage(DEFAULT_CHAT_ID, 'bot', result);
                socket.emit('bot_message_end', {});
            } catch (e: any) {
                const errMsg = `⚠️ Hiba: ${e.message}`;
                socket.emit('bot_message', { text: errMsg });
                saveMessage(DEFAULT_CHAT_ID, 'bot', errMsg);
            }
        });
    });

    httpServer.listen(config.port, () => {
        logInfo('Server', `🌐 Web UI: http://localhost:${config.port}`);
    });
}