"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startWebServer = startWebServer;
const express_1 = __importDefault(require("express"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const logger_js_1 = require("../utils/logger.js");
const llmPipeline_js_1 = require("../pipeline/llmPipeline.js");
const db_js_1 = require("../utils/db.js");
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const sse_js_1 = require("@modelcontextprotocol/sdk/server/sse.js");
const registry_js_1 = require("./registry.js");
const uuid_1 = require("uuid");
async function chatWithOllama(prompt, system = "") {
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
    }
    catch (e) {
        return "Nem érem el az agyamat (Ollama).";
    }
}
const logger = new logger_js_1.Logger('web_ui.log');
function startWebServer() {
    const webUiEnabled = process.env.WEB_UI_ENABLED !== "0" && process.env.WEB_UI_ENABLED !== "false";
    if (!webUiEnabled) {
        console.error("WEB_UI_ENABLED=0 -> Web UI disabled");
        return;
    }
    (0, db_js_1.initDb)();
    const app = (0, express_1.default)();
    // Allow JSON body for MCP POST messages
    app.use(express_1.default.json());
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer, {
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
        const totalMem = os_1.default.totalmem();
        const freeMem = os_1.default.freemem();
        io.emit('metrics_update', {
            requestsPerMinute: Math.floor(Math.random() * 50), // Mock for now
            activeConnections: io.sockets.sockets.size,
            errorRate: Math.random() * 2,
            averageResponseTime: 10 + Math.random() * 50,
            cpuUsage: os_1.default.loadavg()[0] * 10, // Approximate
            memoryUsage: ((totalMem - freeMem) / totalMem) * 100
        });
    }, 5000);
    // MCP SSE Support
    const mcpSessions = new Map();
    app.get('/sse', async (req, res) => {
        const sessionId = (0, uuid_1.v4)();
        console.log(`New MCP SSE connection: ${sessionId}`);
        // Create a transport that points to the POST endpoint with the session ID
        const transport = new sse_js_1.SSEServerTransport(`/messages?sessionId=${sessionId}`, res);
        const server = new mcp_js_1.McpServer({
            name: "mcp-brunella-core-web",
            version: "1.0.0",
        });
        (0, registry_js_1.registerAllTools)(server);
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
    app.use(express_1.default.static(path_1.default.join(process.cwd(), 'build', 'public')));
    io.on('connection', (socket) => {
        const DEFAULT_CHAT_ID = 'main-session';
        try {
            const history = (0, db_js_1.getMessages)(DEFAULT_CHAT_ID);
            if (history.length === 0) {
                (0, db_js_1.createChat)(DEFAULT_CHAT_ID, 'Main Session');
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
            (0, db_js_1.saveMessage)(DEFAULT_CHAT_ID, 'user', userMsg);
            const intentPrompt = `Analyze this user request: "${userMsg}". Classify as CODING_TASK or CHAT. Return ONLY the word.`;
            const intentResponse = await chatWithOllama(intentPrompt);
            const category = (intentResponse || "CHAT").trim();
            if (category.includes("CODING_TASK")) {
                const startMsg = "Indítom a Self-Healing Pipeline-t...";
                socket.emit('bot_message', { text: startMsg });
                (0, db_js_1.saveMessage)(DEFAULT_CHAT_ID, 'bot', startMsg);
                const pipeline = new llmPipeline_js_1.SelfHealingPipeline();
                pipeline.on('progress', (msg) => {
                    socket.emit('bot_message', { text: msg, isLog: true });
                    (0, db_js_1.saveMessage)(DEFAULT_CHAT_ID, 'bot', msg, true);
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
                    (0, db_js_1.saveMessage)(DEFAULT_CHAT_ID, 'bot', finalMsg);
                }
                catch (e) {
                    const errMsg = `⚠️ Sajnos nem sikerült: ${e.message}`;
                    socket.emit('bot_message', { text: errMsg });
                    (0, db_js_1.saveMessage)(DEFAULT_CHAT_ID, 'bot', errMsg);
                }
            }
            else {
                const response = await chatWithOllama(userMsg, "You are Brunella, a helpful AI assistant.");
                socket.emit('bot_message', { text: response });
                (0, db_js_1.saveMessage)(DEFAULT_CHAT_ID, 'bot', response);
            }
        });
    });
    const portValue = Number(process.env.WEB_UI_PORT || 3000);
    const PORT = Number.isFinite(portValue) ? portValue : 3000;
    httpServer.listen(PORT, () => {
        console.error(`🌐 Web UI: http://localhost:${PORT}`);
    });
}
