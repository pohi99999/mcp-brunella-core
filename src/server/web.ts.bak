import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { config } from '../config/index.js';
import { Logger } from '../utils/logger.js';
import { SelfHealingPipeline } from '../pipeline/llmPipeline.js';
import { initDb, saveMessage, getMessages, createChat, DbMessage } from '../utils/db.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from './registry.js';
import { v4 as uuidv4 } from 'uuid';
import { toolManager } from './ToolManager.js';
import { agentManager } from '../agents/AgentManager.js';
import { mcpProcessManager } from './McpProcessManager.js';
import { searchRAG, initRAG } from '../utils/rag.js';

async function chatWithOllama(prompt: string, system: string = ""): Promise<string> {
    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "qwen2.5-coder:1.5b",
                prompt: prompt,
                system: system,
                stream: false
            })
        });
        const data = await response.json();
        return data.response || "Error: No response from Ollama";
    } catch (e) {
        return "Nem érem el az agyamat (Ollama).";
    }
}

const logger = new Logger('web_ui.log');

interface ActiveTransport {
    transport: SSEServerTransport;
    server: McpServer;
}

export function startWebServer() {
    const webUiEnabled = process.env.WEB_UI_ENABLED !== "0" && process.env.WEB_UI_ENABLED !== "false";
    if (!webUiEnabled) {
        console.error("WEB_UI_ENABLED=0 -> Web UI disabled");
        return;
    }

    initDb();

    // Register tools globally for Socket.IO clients
    try {
        registerAllTools(toolManager as any);
        console.log("Tools registered to Global ToolManager");
    } catch (e) {
        console.error("Failed to register tools to ToolManager:", e);
    }

    const app = express();
    // Allow JSON body for MCP POST messages
    app.use(express.json());

    const httpServer = createServer(app);
    const io = new Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    // Helper to broadcast logs to dashboard
    const broadcastLog = (level: string, message: string, source: string = 'core') => {
        io.emit('system_log', {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            level,
            message,
            source
        });
    };

    // Broadcast metrics every 5 seconds
    setInterval(() => {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        io.emit('metrics_update', {
            requestsPerMinute: Math.floor(Math.random() * 50), // Mock for now
            activeConnections: io.sockets.sockets.size,
            errorRate: Math.random() * 2,
            averageResponseTime: 10 + Math.random() * 50,
            cpuUsage: os.loadavg()[0] * 10, // Approximate
            memoryUsage: ((totalMem - freeMem) / totalMem) * 100
        });

        // Also broadcast MCP servers status
        io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
    }, 5000);

    // MCP SSE Support
    const mcpSessions = new Map<string, ActiveTransport>();

    app.get('/sse', async (req, res) => {
        const sessionId = uuidv4();
        console.log(`New MCP SSE connection: ${sessionId}`);

        // Create a transport that points to the POST endpoint with the session ID
        const transport = new SSEServerTransport(`/messages?sessionId=${sessionId}`, res);

        const server = new McpServer({
            name: "mcp-brunella-core-web",
            version: "1.0.0",
        });

        registerAllTools(server);

        mcpSessions.set(sessionId, { transport, server });

        // Cleanup on close
        res.on('close', () => {
            console.log(`MCP SSE connection closed: ${sessionId}`);
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

    app.use(express.static(path.join(process.cwd(), 'build', 'public')));

    io.on('connection', (socket) => {
        const DEFAULT_CHAT_ID = 'main-session';

        // 1. Send Tool Definitions immediately
        socket.emit('tools_update', toolManager.getToolDefinitions());
        
        // Send initial MCP status
        socket.emit('mcp_servers_status', mcpProcessManager.getServersStatus());

        // 2. Handle Tool Execution
        socket.on('run_tool', async (data: { name: string, args: any, id?: string }) => {
            console.log(`Socket Tool Run Request: ${data.name}`);
            try {
                const result = await toolManager.executeTool(data.name, data.args);
                socket.emit('tool_result', { 
                    name: data.name, 
                    result: result,
                    id: data.id 
                });
            } catch (e: any) {
                console.error(`Tool execution error: ${e.message}`);
                socket.emit('tool_error', { 
                    name: data.name, 
                    error: e.message,
                    id: data.id 
                });
            }
        });

        // 3. Handle MCP Server management
        socket.on('mcp_server:start', async (name: string) => {
            try {
                await mcpProcessManager.startServer(name);
                io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
                broadcastLog('info', `MCP Szerver elindítva: ${name}`, 'mcp-manager');
            } catch (e: any) {
                broadcastLog('error', `Hiba az MCP szerver indításakor (${name}): ${e.message}`, 'mcp-manager');
            }
        });

        socket.on('mcp_server:stop', (name: string) => {
            try {
                mcpProcessManager.stopServer(name);
                io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
                broadcastLog('info', `MCP Szerver leállítva: ${name}`, 'mcp-manager');
            } catch (e: any) {
                broadcastLog('error', `Hiba az MCP szerver leállításakor (${name}): ${e.message}`, 'mcp-manager');
            }
        });

        socket.on('request_mcp_status', () => {
            socket.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
        });

        // 4. Handle Flow Editor
        socket.on('flow:save', async (data: { name: string, nodes: any[], edges: any[] }) => {
            try {
                const flowsDir = path.join(process.cwd(), 'conductor', 'flows');
                if (!fs.existsSync(flowsDir)) fs.mkdirSync(flowsDir, { recursive: true });
                
                const filePath = path.join(flowsDir, `${data.name}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                broadcastLog('info', `Flow elmentve: ${data.name}`, 'adk-manager');
                socket.emit('flow:saved', { name: data.name });
            } catch (e: any) {
                broadcastLog('error', `Hiba a flow mentésekor: ${e.message}`, 'adk-manager');
            }
        });

        socket.on('flow:list', () => {
            try {
                const flowsDir = path.join(process.cwd(), 'conductor', 'flows');
                if (!fs.existsSync(flowsDir)) {
                    socket.emit('flow:list_result', []);
                    return;
                }
                const files = fs.readdirSync(flowsDir).filter((f: string) => f.endsWith('.json'));
                const flows = files.map((f: string) => {
                    const content = fs.readFileSync(path.join(flowsDir, f), 'utf-8');
                    return JSON.parse(content);
                });
                socket.emit('flow:list_result', flows);
            } catch (e: any) {
                console.error("Error listing flows:", e);
            }
        });

        // 5. Handle Knowledge Management
        socket.on('knowledge:search', async (query: string) => {
            try {
                const results = await searchRAG(query);
                socket.emit('knowledge:search_results', results);
            } catch (e: any) {
                socket.emit('knowledge:error', e.message);
            }
        });

        socket.on('knowledge:status', async () => {
            try {
                // Simplified status check
                const response = await fetch("http://localhost:11434/api/tags");
                const isOllamaUp = response.ok;
                socket.emit('knowledge:status_result', {
                    ollama: isOllamaUp ? 'online' : 'offline',
                    db: 'LanceDB',
                    indexedCount: 'Helyi keresés szükséges' // TODO: implement actual count in rag.ts
                });
            } catch (e) {
                socket.emit('knowledge:status_result', { ollama: 'offline', db: 'LanceDB' });
            }
        });

        try {
            const history: DbMessage[] = getMessages(DEFAULT_CHAT_ID);
            if (history.length === 0) {
                createChat(DEFAULT_CHAT_ID, 'Main Session');
            } else {
                history.forEach((msg: DbMessage) => {
                    // Adapt DB format to UI format
                    socket.emit('bot_message', {
                        text: msg.content,
                        isUser: msg.role === 'user',
                        isLog: msg.is_log === 1
                    });
                });
            }
        } catch (e) {
            console.error("DB History error:", e);
        }

        socket.on('user_message', async (data) => {
            const userMsg = data.text;
            saveMessage(DEFAULT_CHAT_ID, 'user', userMsg);

            const intentPrompt = `Analyze this user request: "${userMsg}". Classify as PLAN_TASK (if it involves multiple steps, agents, or looking up info then acting), CODING_TASK (if pure code generation), or CHAT. Return ONLY the word.`;
            const intentResponse = await chatWithOllama(intentPrompt);
            const category = (intentResponse || "CHAT").trim();

            if (category.includes("PLAN_TASK")) {
                const startMsg = "🔍 Összetett kérés észlelve. Tervet készítek...";
                socket.emit('bot_message', { text: startMsg });
                saveMessage(DEFAULT_CHAT_ID, 'bot', startMsg);

                try {
                    const plan = await agentManager.createPlan(userMsg);
                    socket.emit('plan_created', plan); // Send initial plan to UI

                    const result = await agentManager.executePlan(plan, (event, data) => {
                        socket.emit(event, data); // Forward plan events to UI
                    });

                    const finalMsg = `✅ Terv végrehajtva:\n\n${result}`;
                    socket.emit('bot_message', { text: finalMsg });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', finalMsg);
                } catch (e: any) {
                    const errMsg = `⚠️ Hiba a tervezés/végrehajtás során: ${e.message}`;
                    socket.emit('bot_message', { text: errMsg });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', errMsg);
                }

            } else if (category.includes("CODING_TASK")) {
                const startMsg = "Indítom a Self-Healing Pipeline-t...";
                socket.emit('bot_message', { text: startMsg });
                saveMessage(DEFAULT_CHAT_ID, 'bot', startMsg);

                const pipeline = new SelfHealingPipeline();
                pipeline.on('progress', (msg) => {
                    socket.emit('bot_message', { text: msg, isLog: true });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', msg, true);
                });

                try {
                    const result = await pipeline.run(userMsg);
                    const finalMsg = `✅ Kész! Itt az eredmény:\n\
\
javascript
${result}
\
\
`;
                    socket.emit('bot_message', { text: finalMsg });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', finalMsg);
                } catch (e: any) {
                    const errMsg = `⚠️ Sajnos nem sikerült: ${e.message}`;
                    socket.emit('bot_message', { text: errMsg });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', errMsg);
                }

            } else {
                const response = await chatWithOllama(userMsg, "You are Brunella, a helpful AI assistant.");
                socket.emit('bot_message', { text: response });
                saveMessage(DEFAULT_CHAT_ID, 'bot', response);
            }
        });
    });

    const portValue = Number(process.env.WEB_UI_PORT || 3000);
    const PORT = Number.isFinite(portValue) ? portValue : 3000;
    httpServer.listen(PORT, () => {
        console.error(`🌐 Web UI: http://localhost:${PORT}`);
    });
}
