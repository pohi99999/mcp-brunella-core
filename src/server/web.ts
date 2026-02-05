import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import osUtils from 'os-utils';
import fetch from 'node-fetch';
import swaggerUi from 'swagger-ui-express';
import { Logger } from '../utils/logger.js';
import { initDb, saveMessage, getMessages, createChat, DbMessage } from '../utils/db.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from './registry.js';
import { v4 as uuidv4 } from 'uuid';
import { toolManager } from './ToolManager.js';
import { mcpProcessManager } from './McpProcessManager.js';
import { ConfigManager } from '../utils/cliConfig.js';
import { mcpClientManager } from '../utils/mcpClientManager.js';
import { agentManager } from '../agents/AgentManager.js';
import {
    checkOllamaHealth,
    checkAnythingLLMHealth,
    buildHealthResponse,
} from '../utils/health.js';
import { chatWithOllama } from '../core/llm_client.js';
import { corsWhitelist, requestId, requestLogging, apiRateLimit } from './middleware.js';
import { swaggerSpec } from './swagger.js';
import { socketService } from './SocketService.js';

const logger = new Logger('web_ui.log');
const configManager = new ConfigManager();

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
        console.error("WEB_UI_ENABLED=0 -> Web UI disabled");
        return;
    }

    try {
        initDb();
    } catch (e) {
        console.error("DB Init failed:", e);
    }

    // Auto-connect to configured MCP servers (Stub for now based on configManager)
    // In a real scenario, we would read from mcp_servers.json
    console.log("🔄 Starting MCP Bridge...");

    const app = express();
    app.use(express.json());
    app.use(corsWhitelist);
    app.use(requestId);
    app.use(requestLogging);
    app.use('/api', apiRateLimit);

    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: corsOriginList.length > 0 ? corsOriginList : ['http://localhost:5173', 'http://localhost:3000', '*'],
            methods: ['GET', 'POST'],
        },
    });
    socketService.init(io);

    // Metrics Loop
    setInterval(() => {
        osUtils.cpuUsage((cpuPercent) => {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            io.emit('metrics_update', {
                requestsPerMinute: 0, // TODO: Track requests
                activeConnections: io.sockets.sockets.size,
                errorRate: 0, // TODO: Track errors
                averageResponseTime: 0,
                cpuUsage: cpuPercent * 100,
                memoryUsage: ((totalMem - freeMem) / totalMem) * 100
            });
            io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());

            // Push Agent & Tool status updates
            io.emit('agent_update', agentManager.listAgentDefinitions());
            io.emit('tools_update', toolManager.getToolDefinitions());
            io.emit('tasks_update', agentManager.getAllTasks());
        });
    }, 5000);

    const mcpSessions = new Map<string, ActiveTransport>();

    app.get('/sse', async (req, res) => {
        const sessionId = uuidv4();
        const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
        const server = new McpServer({
            name: "mcp-brunella-core-web",
            version: "1.0.0",
        });

        registerAllTools(server);
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

    // REST API Endpoints for Dashboard

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
    app.get('/api/health', async (req, res) => {
        try {
            const [ollama, anythingllm] = await Promise.all([
                checkOllamaHealth(),
                checkAnythingLLMHealth(),
            ]);
            const agentsCount = agentManager.listAgents().length;
            const mcpCount = mcpProcessManager.getServersStatus().length;
            const payload = buildHealthResponse(
                ollama,
                anythingllm,
                agentsCount,
                mcpCount,
                (req as any).id
            );
            res.json(payload);
        } catch (e: any) {
            res.status(500).json({ status: 'error', message: e.message });
        }
    });

    /**
     * @swagger
     * /api/agents:
     *   get:
     *     summary: List Agents
     *     description: Returns a list of all registered agents and their capabilities.
     *     responses:
     *       200:
     *         description: List of agents
     */
    app.get('/api/agents', (req, res) => {
        try {
            const agents = agentManager.listAgentDefinitions();
            res.json({ agents });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/agents/:agentName/execute', async (req, res) => {
        try {
            const { agentName } = req.params;
            const { task, context } = req.body;

            if (!task) {
                res.status(400).json({ error: 'Task is required' });
                return;
            }

            const result = await agentManager.delegate(agentName, task, context);
            res.json({ result });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Tasks API
    app.get('/api/tasks', (req, res) => {
        try {
            const tasks = agentManager.getAllTasks();
            res.json({ tasks });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tasks', async (req, res) => {
        try {
            const { description, agentName, context, parentId } = req.body;

            if (!description || !agentName) {
                res.status(400).json({ error: 'Description and agentName are required' });
                return;
            }

            const taskId = agentManager.queueTask(description, agentName, context, parentId);
            res.json({ taskId, status: 'queued' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * @swagger
     * /api/ollama/models:
     *   get:
     *     summary: List Ollama Models
     *     description: Fetches available models from the configured Ollama instance.
     *     responses:
     *       200:
     *         description: List of models
     */
    app.get('/api/ollama/models', async (req, res) => {
        try {
            const baseUrl = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';
            const response = await fetch(`${baseUrl}/api/tags`, {
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.statusText}`);
            }

            const data: any = await response.json();
            res.json({ models: data.models || [] });
        } catch (e: any) {
            res.status(500).json({ error: e.message, models: [] });
        }
    });

    app.post('/api/ollama/generate', async (req, res) => {
        try {
            const { prompt, model, system } = req.body;

            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const selectedModel = model || process.env.OLLAMA_MODEL || 'gemma2:9b';
            const response = await chatWithOllama(prompt, system, selectedModel);
            res.json({ response });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // AnythingLLM API
    app.get('/api/anythingllm/workspaces', async (req, res) => {
        try {
            const baseUrl = process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001';
            const apiKey = process.env.ANYTHINGLLM_API_KEY;

            if (!apiKey) {
                res.status(500).json({ error: 'AnythingLLM API key not configured', workspaces: [] });
                return;
            }

            const response = await fetch(`${baseUrl}/api/v1/workspaces`, {
                headers: { 'Authorization': `Bearer ${apiKey}` },
                signal: AbortSignal.timeout(10000)
            });

            if (!response.ok) {
                throw new Error(`AnythingLLM API error: ${response.statusText}`);
            }

            const data: any = await response.json();
            res.json({ workspaces: data.workspaces || [] });
        } catch (e: any) {
            res.status(500).json({ error: e.message, workspaces: [] });
        }
    });

    app.post('/api/anythingllm/chat', async (req, res) => {
        try {
            const { workspace, message, mode } = req.body;

            if (!workspace || !message) {
                res.status(400).json({ error: 'Workspace and message are required' });
                return;
            }

            const baseUrl = process.env.ANYTHINGLLM_BASE_URL || 'http://localhost:3001';
            const apiKey = process.env.ANYTHINGLLM_API_KEY;

            if (!apiKey) {
                res.status(500).json({ error: 'AnythingLLM API key not configured' });
                return;
            }

            const response = await fetch(`${baseUrl}/api/v1/workspace/${workspace}/chat`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message, mode: mode || 'chat' }),
                signal: AbortSignal.timeout(60000)
            });

            if (!response.ok) {
                throw new Error(`AnythingLLM API error: ${response.statusText}`);
            }

            const data: any = await response.json();
            res.json({ response: data.textResponse || data.response });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Chat messages API
    app.get('/api/chat/messages', (req, res) => {
        try {
            const chatId = req.query.chatId as string || 'main-session';
            const messages = getMessages(chatId);
            res.json({ messages });
        } catch (e: any) {
            res.status(500).json({ error: e.message, messages: [] });
        }
    });

    // Tools API
    app.post('/api/debug/broadcast-log', (req, res) => {
        try {
            const { message, type = 'info' } = req.body;
            if (!message) {
                res.status(400).json({ error: 'message is required' });
                return;
            }
            socketService.broadcastLog(message, type);
            res.json({ ok: true, message: 'Log broadcast sent' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/debug/agent-status', (req, res) => {
        try {
            const { agentName, status, taskDescription } = req.body;
            if (!agentName || !status) {
                res.status(400).json({ error: 'agentName and status are required' });
                return;
            }
            socketService.updateAgentStatus(agentName, status, taskDescription);
            res.json({ ok: true, message: 'Agent status update sent' });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/tools', (req, res) => {
        try {
            const tools = toolManager.getToolDefinitions();
            res.json({ tools });
        } catch (e: any) {
            res.status(500).json({ error: e.message, tools: [] });
        }
    });

    app.post('/api/tools/:toolName/execute', async (req, res) => {
        try {
            const { toolName } = req.params;
            const args = req.body;

            const result = await toolManager.executeTool(toolName, args);
            res.json({ result });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.use(express.static(path.join(process.cwd(), 'build', 'public')));

    io.on('connection', (socket) => {
        const DEFAULT_CHAT_ID = 'main-session';
        console.log('Client connected to Dashboard');
        socket.emit('system:log', { message: 'Rendszer indítása... Mission Control csatlakozva.', type: 'success', timestamp: Date.now() });

        socket.emit('tools_update', toolManager.getToolDefinitions());
        socket.emit('mcp_servers_status', mcpProcessManager.getServersStatus());

        socket.on('run_tool', async (data: { name: string, args: any, id?: string }) => {
            console.log(`Socket Tool Run Request: ${data.name}`);
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

    const PORT = Number(process.env.PORT || 3000);
    httpServer.listen(PORT, () => {
        console.log(`🌐 Web UI: http://localhost:${PORT}`);
    });
}