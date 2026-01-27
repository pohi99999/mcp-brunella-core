import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { Logger } from '../utils/logger.js';
import { initDb, saveMessage, getMessages, createChat } from '../utils/db.js';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerAllTools } from './registry.js';
import { v4 as uuidv4 } from 'uuid';
import { toolManager } from './ToolManager.js';
import { agentManager } from '../agents/AgentManager.js';
import { mcpProcessManager } from './McpProcessManager.js';
import { searchRAG } from '../utils/rag.js';
import { LLMClient } from '../core/llm_client.js';
import { mcpClientManager } from '../cli/mcp_client.js';
import { MemoryManager } from '../cli/memory.js';
import { McpConfigManager } from '../cli/mcp_config.js';
const logger = new Logger('web_ui.log');
const memory = new MemoryManager();
const configManager = new McpConfigManager();
export async function startWebServer() {
    const webUiEnabled = process.env.WEB_UI_ENABLED !== "0" && process.env.WEB_UI_ENABLED !== "false";
    if (!webUiEnabled) {
        console.error("WEB_UI_ENABLED=0 -> Web UI disabled");
        return;
    }
    initDb();
    // Auto-connect to configured MCP servers
    console.log("🔄 Auto-connecting to configured MCP servers...");
    const servers = configManager.getServers();
    for (const server of servers) {
        // Skip self or special entries if needed
        if (server.name === 'brunella-core' || server.name === 'mcp-brunella-core')
            continue;
        try {
            // Check if already connected (optional optimization, but connectStdio usually spawns new)
            // Ideally we check if client exists.
            if (mcpClientManager.getClient(server.name)) {
                console.log(`ℹ️  Already connected to ${server.name}`);
                continue;
            }
            console.log(`🔌 Connecting to ${server.name}...`);
            await mcpClientManager.connectStdio(server.name, server.command, server.args, server.env || {});
            console.log(`✅ Connected to ${server.name}`);
        }
        catch (e) {
            console.error(`❌ Failed to auto-connect to ${server.name}: ${e.message}`);
        }
    }
    // Register tools globally for Socket.IO clients
    try {
        registerAllTools(toolManager);
        console.log("Tools registered to Global ToolManager");
    }
    catch (e) {
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
    const broadcastLog = (level, message, source = 'core') => {
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
    const mcpSessions = new Map();
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
        const sessionId = req.query.sessionId;
        if (!sessionId || !mcpSessions.has(sessionId)) {
            res.status(404).send("Session not found");
            return;
        }
        const { transport } = mcpSessions.get(sessionId);
        await transport.handlePostMessage(req, res);
    });
    app.use(express.static(path.join(process.cwd(), 'build', 'public')));
    io.on('connection', (socket) => {
        const DEFAULT_CHAT_ID = 'main-session';
        // 1. Send Tool Definitions immediately
        void emitToolsUpdate(socket);
        // Send initial MCP status
        socket.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
        // 2. Handle Tool Execution
        socket.on('run_tool', async (data) => {
            console.log(`Socket Tool Run Request: ${data.name}`);
            try {
                // Try Local ToolManager first
                let result;
                try {
                    result = await toolManager.executeTool(data.name, data.args);
                }
                catch (localError) {
                    // If not found locally, try MCP Clients
                    console.log(`Tool not found locally, trying MCP clients for ${data.name}...`);
                    const clients = mcpClientManager.getClientNames();
                    let found = false;
                    for (const clientName of clients) {
                        try {
                            const clientTools = await mcpClientManager.listTools(clientName);
                            if (clientTools.tools.some(t => t.name === data.name)) {
                                const mcpResult = await mcpClientManager.callTool(clientName, data.name, data.args);
                                result = mcpResult; // Note: MCP result structure might differ
                                found = true;
                                break;
                            }
                        }
                        catch (e) { /* continue */ }
                    }
                    if (!found)
                        throw localError; // Throw original error if not found in MCP either
                }
                socket.emit('tool_result', {
                    name: data.name,
                    result: result,
                    id: data.id
                });
            }
            catch (e) {
                console.error(`Tool execution error: ${e.message}`);
                socket.emit('tool_error', {
                    name: data.name,
                    error: e.message,
                    id: data.id
                });
            }
        });
        // 3. Handle MCP Server management
        socket.on('mcp_server:start', async (name) => {
            try {
                await mcpProcessManager.startServer(name);
                io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
                broadcastLog('info', `MCP Szerver elindítva: ${name}`, 'mcp-manager');
            }
            catch (e) {
                broadcastLog('error', `Hiba az MCP szerver indításakor (${name}): ${e.message}`, 'mcp-manager');
            }
        });
        socket.on('mcp_server:stop', (name) => {
            try {
                mcpProcessManager.stopServer(name);
                io.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
                broadcastLog('info', `MCP Szerver leállítva: ${name}`, 'mcp-manager');
            }
            catch (e) {
                broadcastLog('error', `Hiba az MCP szerver leállításakor (${name}): ${e.message}`, 'mcp-manager');
            }
        });
        socket.on('request_mcp_status', () => {
            socket.emit('mcp_servers_status', mcpProcessManager.getServersStatus());
        });
        // 4. Handle Flow Editor
        socket.on('flow:save', async (data) => {
            try {
                const flowsDir = path.join(process.cwd(), 'conductor', 'flows');
                if (!fs.existsSync(flowsDir))
                    fs.mkdirSync(flowsDir, { recursive: true });
                const filePath = path.join(flowsDir, `${data.name}.json`);
                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                broadcastLog('info', `Flow elmentve: ${data.name}`, 'adk-manager');
                socket.emit('flow:saved', { name: data.name });
            }
            catch (e) {
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
                const files = fs.readdirSync(flowsDir).filter((f) => f.endsWith('.json'));
                const flows = files.map((f) => {
                    const content = fs.readFileSync(path.join(flowsDir, f), 'utf-8');
                    return JSON.parse(content);
                });
                socket.emit('flow:list_result', flows);
            }
            catch (e) {
                console.error("Error listing flows:", e);
            }
        });
        // 5. Handle Knowledge Management
        socket.on('knowledge:search', async (query) => {
            try {
                const results = await searchRAG(query);
                socket.emit('knowledge:search_results', results);
            }
            catch (e) {
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
            }
            catch (e) {
                socket.emit('knowledge:status_result', { ollama: 'offline', db: 'LanceDB' });
            }
        });
        try {
            const history = getMessages(DEFAULT_CHAT_ID);
            if (history.length === 0) {
                createChat(DEFAULT_CHAT_ID, 'Main Session');
            }
            else {
                history.forEach((msg) => {
                    // Adapt DB format to UI format
                    socket.emit('bot_message', {
                        text: msg.content,
                        isUser: msg.role === 'user',
                        isLog: msg.is_log === 1
                    });
                });
            }
        }
        catch (e) {
            console.error("DB History error:", e);
        }
        socket.on('user_message', async (data) => {
            const userMsg = data.text;
            const allowedTools = Array.isArray(data.tools) ? data.tools : null;
            saveMessage(DEFAULT_CHAT_ID, 'user', userMsg);
            let currentResponseText = "";
            socket.emit('bot_message_start', { isUser: false });
            try {
                const plan = await agentManager.createPlan(userMsg);
                socket.emit('plan_created', plan);
                for (const step of plan.steps) {
                    step.status = 'running';
                    socket.emit('plan_step_update', step);
                    let result = "";
                    if (step.agent === 'orchestrator') {
                        result = await runOrchestratorWithTools(step.description, allowedTools, (chunk) => {
                            currentResponseText += chunk;
                            socket.emit('bot_message_chunk', { text: chunk });
                        });
                    }
                    else {
                        result = await agentManager.delegate(step.agent, step.description);
                        const chunk = `\n\n[${step.agent}]\n${result}`;
                        currentResponseText += chunk;
                        socket.emit('bot_message_chunk', { text: chunk });
                    }
                    step.status = 'completed';
                    step.result = result;
                    socket.emit('plan_step_update', step);
                }
                saveMessage(DEFAULT_CHAT_ID, 'bot', currentResponseText);
                socket.emit('bot_message_end', {});
            }
            catch (e) {
                const errMsg = `⚠️ Hiba: ${e.message}`;
                socket.emit('bot_message', { text: errMsg });
                saveMessage(DEFAULT_CHAT_ID, 'bot', errMsg);
            }
        });
    });
    const portValue = Number(process.env.WEB_UI_PORT || 3000);
    const PORT = Number.isFinite(portValue) ? portValue : 3000;
    httpServer.listen(PORT, () => {
        console.log(`🌐 Web UI: http://localhost:${PORT}`);
    });
}
async function emitToolsUpdate(socket) {
    try {
        const local = toolManager.getToolDefinitions();
        const mcpTools = await getMcpToolDefinitions();
        socket.emit('tools_update', [...local, ...mcpTools]);
    }
    catch (e) {
        socket.emit('tools_update', toolManager.getToolDefinitions());
    }
}
async function getMcpToolDefinitions() {
    const tools = [];
    const clients = mcpClientManager.getClientNames();
    for (const clientName of clients) {
        try {
            const result = await mcpClientManager.listTools(clientName);
            result.tools.forEach((t) => {
                tools.push({
                    name: `mcp.${clientName}.${t.name}`,
                    description: t.description || '',
                    inputSchema: t.inputSchema
                });
            });
        }
        catch {
            // ignore
        }
    }
    return tools;
}
async function runOrchestratorWithTools(userMsg, allowedTools, onChunk) {
    const currentModel = memory.get('model') || 'llava-llama3:latest';
    const baseUrl = memory.get('llm_base_url') || 'http://127.0.0.1:11434';
    const llm = new LLMClient({
        provider: 'ollama',
        model: currentModel,
        baseUrl: baseUrl
    });
    const messages = [
        { role: 'system', content: 'You are Brunella, an AI assistant. You can use tools. Be helpful and concise.' },
        { role: 'user', content: userMsg }
    ];
    const localTools = toolManager.getToolDefinitions().map(def => ({
        type: 'function',
        function: {
            name: def.name,
            description: def.description || '',
            parameters: def.inputSchema
        }
    }));
    const mcpTools = await mcpClientManager.getToolsForLLM();
    let tools = [...localTools, ...mcpTools];
    if (allowedTools) {
        tools = tools.filter(t => allowedTools.includes(t.function.name));
    }
    let currentResponseText = "";
    const response = await llm.chatStream(messages, tools, (chunk) => {
        currentResponseText += chunk;
        onChunk(chunk);
    });
    if (response.tool_calls && response.tool_calls.length > 0) {
        onChunk('\n\n🛠️ Eszközök futtatása...\n');
        messages.push(response);
        for (const call of response.tool_calls) {
            const toolName = call.function.name;
            const toolArgs = JSON.parse(call.function.arguments);
            const executionResult = await executeToolByName(toolName, toolArgs);
            const shortResult = executionResult.substring(0, 120);
            onChunk(`> ${toolName}: ${shortResult}...\n`);
            messages.push({ role: 'tool', content: executionResult, name: toolName });
        }
        const followUp = await llm.chatStream(messages, tools, (chunk) => {
            currentResponseText += chunk;
            onChunk(chunk);
        });
        currentResponseText = followUp.content ? currentResponseText : currentResponseText;
    }
    return currentResponseText;
}
async function executeToolByName(toolName, toolArgs) {
    if (toolName.startsWith('mcp.')) {
        const parsed = parseMcpToolName(toolName);
        if (!parsed)
            return 'Invalid MCP tool name';
        try {
            const result = await mcpClientManager.callTool(parsed.serverName, parsed.toolName, toolArgs);
            return JSON.stringify(result);
        }
        catch (e) {
            return `MCP tool error: ${e.message}`;
        }
    }
    try {
        const result = await toolManager.executeTool(toolName, toolArgs);
        return typeof result === 'string' ? result : JSON.stringify(result);
    }
    catch (e) {
        return `Tool error: ${e.message}`;
    }
}
function parseMcpToolName(name) {
    const parts = name.split('.');
    if (parts.length < 3)
        return null;
    return { serverName: parts[1], toolName: parts.slice(2).join('.') };
}
