import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import fs from 'fs';
import fetch from 'node-fetch';
import swaggerUi from 'swagger-ui-express';
import { Logger, logEmitter, type LogEvent, type AgentStatusEvent } from '../utils/logger.js';
import { initDb, saveMessage, getMessages, createChat, DbMessage } from '../utils/db.js';
import { initTasksDb, getTasks, getTaskCount, getTaskById, getTaskStats } from '../utils/tasksDb.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from './registry.js';
import { v4 as uuidv4 } from 'uuid';
import { toolManager } from './ToolManager.js';
import { mcpProcessManager } from './McpProcessManager.js';
import { ConfigManager } from '../utils/cliConfig.js';
import { mcpClientManager } from '../utils/mcpClientManager.js';
import { agentManager } from '../agents/AgentManager.js';
import { AgentArchitect } from '../agents/AgentArchitect.js';
import {
    checkOllamaHealth,
    checkAnythingLLMHealth,
    buildHealthResponse,
} from '../utils/health.js';
import { chatWithOllama, generateResponse } from '../core/llm_client.js';
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

    try {
        initTasksDb();
    } catch (e) {
        console.error("Tasks DB Init failed:", e);
    }

    // Auto-connect to configured MCP servers (Stub for now based on configManager)
    // In a real scenario, we would read from mcp_servers.json
    console.log("🔄 Starting MCP Bridge...");

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
        console.error("GET /api/agents hit");
        try {
            const agents = agentManager.listAgentDefinitions();
            res.json({ agents });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/registry', (req, res) => {
        try {
            const registry = agentManager.getRegistry();
            res.json(registry);
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

    /**
     * @swagger
     * /api/agents/create:
     *   post:
     *     summary: Create New Agent
     *     description: Generates a new dynamic agent, saves its config and registers it.
     */
    app.post('/api/agents/create', async (req, res) => {
        try {
            const result = await AgentArchitect.createAgent(req.body);
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (e: any) {
            res.status(500).json({ success: false, message: e.message });
        }
    });

    app.get('/api/agents/status', (req, res) => {
        try {
            const status = agentManager.listAgentStatuses();
            res.json({ agents: status });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/agents/:agentName/logs', (req, res) => {
        const { agentName } = req.params;
        const levelFilter = typeof req.query.level === 'string' ? req.query.level : undefined;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const logListener = (entry: LogEvent) => {
            if (entry.agent !== agentName) return;
            if (levelFilter && entry.level !== levelFilter) return;
            res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
        };

        logEmitter.on('log', logListener);

        req.on('close', () => {
            logEmitter.off('log', logListener);
        });
    });

    app.get('/api/cloudflare/agents', async (req, res) => {
        try {
            const edgeStatus = agentManager.getEdgeStatus();
            if (!edgeStatus.enabled) {
                res.json({ agents: [], status: 'disabled' });
                return;
            }

            // In a real scenario, we would proxy the request to the Cloudflare Worker URL
            // const workerUrl = process.env.CLOUDFLARE_WORKER_URL;
            // const response = await fetch(`${workerUrl}/agents`);
            // const data = await response.json();

            res.json({
                status: edgeStatus.healthy ? 'connected' : 'error',
                agents: [
                    { name: 'EdgeOrchestrator', status: 'active', tasks: 2 },
                    { name: 'EdgeKVReader', status: 'idle', tasks: 0 }
                ]
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/providers/status', async (req, res) => {
        console.error("GET /api/providers/status hit");
        try {
            const { generateResponse } = await import('../core/llm_client.js');

            const checks = [
                { id: 'ollama', name: 'Ollama (Helyi)', test: () => generateResponse('hi', 'ollama') },
                { id: 'gemini', name: 'Google Gemini', test: () => generateResponse('hi', 'gemini') },
                { id: 'github', name: 'GitHub Models', test: () => generateResponse('hi', 'github') }
            ];

            const results = await Promise.all(checks.map(async (c) => {
                try {
                    const start = Date.now();
                    await c.test();
                    return { id: c.id, name: c.name, status: 'online', latency: Date.now() - start };
                } catch (e: any) {
                    return { id: c.id, name: c.name, status: 'offline', error: e.message };
                }
            }));

            res.json({ providers: results });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Files API
    app.get('/api/files/list', async (req, res) => {
        try {
            const relPath = req.query.path as string || '.';
            if (relPath.includes('..')) {
                res.status(400).json({ error: 'Invalid path' });
                return;
            }

            const fullPath = path.resolve(process.cwd(), relPath);
            if (!fullPath.startsWith(process.cwd())) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const entries = await fs.promises.readdir(fullPath, { withFileTypes: true });
            const files = entries.map(entry => {
                const stats = fs.statSync(path.join(fullPath, entry.name));
                return {
                    name: entry.name,
                    isDirectory: entry.isDirectory(),
                    path: path.join(relPath, entry.name).replace(/\\/g, '/'),
                    size: entry.isFile() ? stats.size : 0,
                    modified: stats.mtime
                };
            });

            res.json({ files });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/files/content', async (req, res) => {
        try {
            const filePath = req.query.path as string;
            if (!filePath || filePath.includes('..')) {
                res.status(400).json({ error: 'Invalid path' });
                return;
            }

            const fullPath = path.resolve(process.cwd(), filePath);
            if (!fullPath.startsWith(process.cwd())) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }

            const content = await fs.promises.readFile(fullPath, 'utf-8');
            res.json({ content });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // RAG API
    app.get('/api/rag/stats', async (req, res) => {
        try {
            const { getRAGCount } = await import('../utils/rag.js');
            const count = await getRAGCount();
            res.json({
                table: 'memory',
                provider: 'LanceDB',
                status: 'online',
                rowCount: count
            });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/rag/query', async (req, res) => {
        try {
            const { query, limit } = req.query;
            if (!query) {
                res.status(400).json({ error: 'Query is required' });
                return;
            }
            const { searchRAG } = await import('../utils/rag.js');
            const results = await searchRAG(query as string, limit ? parseInt(limit as string) : 5);
            res.json({ results });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/rag/ingest', async (req, res) => {
        try {
            const { text, metadata } = req.body;
            if (!text) {
                res.status(400).json({ error: 'Text is required' });
                return;
            }
            const { addToIndex } = await import('../utils/rag.js');
            await addToIndex(metadata?.path || `manual_${Date.now()}`, text);
            res.json({ status: 'success', indexed: true });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Incubator API
    app.post('/api/incubator/gold-sample', async (req, res) => {
        try {
            const pythonBaseUrl = process.env.PYTHON_SUBSET_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${pythonBaseUrl}/incubator/gold-sample`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body)
            });
            const data: any = await response.json();
            res.status(response.status).json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/incubator/stats', async (req, res) => {
        try {
            const pythonBaseUrl = process.env.PYTHON_SUBSET_URL || 'http://127.0.0.1:8000';
            const response = await fetch(`${pythonBaseUrl}/incubator/stats`);
            const data: any = await response.json();
            res.status(response.status).json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    // Tasks API
    app.get('/api/providers/status', async (req, res) => {
        const statuses = [];

        // Check Ollama
        try {
            const start = Date.now();
            const resp = await fetch('http://localhost:11434/api/tags');
            const latency = Date.now() - start;
            if (resp.ok) {
                statuses.push({ id: 'ollama', name: 'Ollama', status: 'online', latency });
            } else {
                statuses.push({ id: 'ollama', name: 'Ollama', status: 'error', error: `HTTP ${resp.status}`, latency });
            }
        } catch (e: any) {
            statuses.push({ id: 'ollama', name: 'Ollama', status: 'offline', error: e.message });
        }

        // Check Gemini
        try {
            if (process.env.GEMINI_API_KEY) {
                statuses.push({ id: 'gemini', name: 'Google Gemini', status: 'online', latency: 50 }); // Mock latency for now
            } else {
                statuses.push({ id: 'gemini', name: 'Google Gemini', status: 'offline', error: 'Missing API Key' });
            }
        } catch (e: any) {
             statuses.push({ id: 'gemini', name: 'Google Gemini', status: 'error', error: e.message });
        }

        // Check GitHub
        try {
            if (process.env.GITHUB_TOKEN) {
                statuses.push({ id: 'github', name: 'GitHub Models', status: 'online', latency: 60 });
            } else {
                statuses.push({ id: 'github', name: 'GitHub Models', status: 'offline', error: 'Missing Token' });
            }
        } catch (e: any) {
            statuses.push({ id: 'github', name: 'GitHub Models', status: 'error', error: e.message });
        }

        res.json({ providers: statuses });
    });

    app.get('/api/tasks', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const offset = parseInt(req.query.offset as string) || 0;
            const status = typeof req.query.status === 'string' ? req.query.status : undefined;
            const tasks = await getTasks(limit, offset, status);
            const total = await getTaskCount(status);
            res.json({ tasks, total, limit, offset, status });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/tasks/stats', async (req, res) => {
        try {
            const stats = await getTaskStats();
            res.json({ stats });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/tasks/:id', async (req, res) => {
        try {
            const id = Number(req.params.id);
            if (Number.isNaN(id)) {
                res.status(400).json({ error: 'Invalid task id' });
                return;
            }
            const task = await getTaskById(id);
            if (!task) {
                res.status(404).json({ error: 'Task not found' });
                return;
            }
            res.json({ task });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tasks/execute', async (req, res) => {
        try {
            const result = await agentManager.processPendingTasks();
            if (!result) {
                res.status(404).json({ error: 'No pending tasks' });
                return;
            }
            res.json({ result });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tasks/cancel', async (req, res) => {
        try {
            const taskId = Number(req.body.taskId);
            if (Number.isNaN(taskId)) {
                res.status(400).json({ error: 'taskId is required' });
                return;
            }
            const ok = await agentManager.cancelTask(taskId);
            if (!ok) {
                res.status(404).json({ error: 'Task not found' });
                return;
            }
            res.json({ status: 'cancelled', taskId });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.post('/api/tasks/retry', async (req, res) => {
        try {
            const taskId = Number(req.body.taskId);
            if (Number.isNaN(taskId)) {
                res.status(400).json({ error: 'taskId is required' });
                return;
            }
            const ok = await agentManager.retryTask(taskId);
            if (!ok) {
                res.status(404).json({ error: 'Task not found' });
                return;
            }
            res.json({ status: 'pending', taskId });
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

    app.get('/api/gemini/models', (req, res) => {
        try {
            const envList = process.env.GEMINI_MODELS;
            const defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const models = (envList ? envList.split(',') : [defaultModel])
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name, provider: 'gemini', tier: 'configured' }));
            res.json({ models });
        } catch (e: any) {
            res.status(500).json({ error: e.message, models: [] });
        }
    });

    app.get('/api/github-models/models', (req, res) => {
        try {
            const envList = process.env.GITHUB_MODELS;
            const defaultModel = process.env.GITHUB_MODEL || 'gpt-4o';
            const models = (envList ? envList.split(',') : [defaultModel])
                .map((name) => name.trim())
                .filter(Boolean)
                .map((name) => ({ name, provider: 'github' }));
            res.json({ models });
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
            // Combine system and prompt if system is provided
            const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
            const response = await chatWithOllama(fullPrompt, selectedModel);
            res.json({ response });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * @swagger
     * /api/gemini/generate:
     *   post:
     *     summary: Generate with Gemini
     *     description: Generates text using Google Gemini models.
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               prompt:
     *                 type: string
     *               model:
     *                 type: string
     *               system:
     *                 type: string
     *     responses:
     *       200:
     *         description: Generated response
     */
    app.post('/api/gemini/generate', async (req, res) => {
        try {
            const { prompt, model, system } = req.body;

            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const selectedModel = model || process.env.GEMINI_MODEL || 'gemini-2.5-flash';
            const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
            const response = await generateResponse(fullPrompt, 'gemini', selectedModel);
            res.json({ response });
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.get('/api/n8n/workflows', async (req, res) => {
        try {
            const baseUrl = process.env.N8N_BASE_URL || 'https://n8n-latest-fulv.onrender.com';
            const apiKey = process.env.N8N_API_KEY;
            const response = await fetch(`${baseUrl}/api/v1/workflows`, {
                headers: apiKey ? { 'X-N8N-API-KEY': apiKey } : undefined,
                signal: AbortSignal.timeout(15000)
            });

            if (!response.ok) {
                throw new Error(`n8n API error: ${response.statusText}`);
            }

            const data: any = await response.json();
            res.json(data);
        } catch (e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    /**
     * @swagger
     * /api/github-models/generate:
     *   post:
     *     summary: Generate with GitHub Models
     *     description: Generates text using GitHub Models (GPT-4o via Azure).
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             properties:
     *               prompt:
     *                 type: string
     *               model:
     *                 type: string
     *               system:
     *                 type: string
     *     responses:
     *       200:
     *         description: Generated response
     */
    app.post('/api/github-models/generate', async (req, res) => {
        try {
            const { prompt, model, system } = req.body;

            if (!prompt) {
                res.status(400).json({ error: 'Prompt is required' });
                return;
            }

            const selectedModel = model || 'gpt-4o';
            const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
            const response = await generateResponse(fullPrompt, 'github', selectedModel);
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
            const { message, type = 'info', source } = req.body;
            if (!message) {
                res.status(400).json({ error: 'message is required' });
                return;
            }
            socketService.broadcastLog(message, type, source);
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

    const PORT = Number(process.env.PORT || 3000);
    httpServer.listen(PORT, () => {
        console.log(`🌐 Web UI: http://localhost:${PORT}`);
    });
}