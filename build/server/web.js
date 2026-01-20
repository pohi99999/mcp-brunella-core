import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { Logger } from '../utils/logger.js';
import { SelfHealingPipeline } from '../pipeline/llmPipeline.js';
import { initDb, saveMessage, getMessages, createChat } from '../utils/db.js';
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
async function chatWithOllama(prompt, system = "") {
    try {
        const response = await fetch("http://localhost:11434/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                model: "llama3.1:latest",
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
const logger = new Logger('web_ui.log');
const transports = new Map();
export function createApp() {
    initDb();
    const app = express();
    // Priority: Serve from build/public (dashboard build)
    app.use(express.static(path.join(process.cwd(), 'build', 'public')));
    // Fallback: Serve from public (legacy or assets)
    app.use(express.static(path.join(process.cwd(), 'public')));
    return app;
}
function setupSocket(io) {
    io.on('connection', (socket) => {
        const DEFAULT_CHAT_ID = 'main-session';
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
            saveMessage(DEFAULT_CHAT_ID, 'user', userMsg);
            const intentPrompt = `Analyze this user request: "${userMsg}". Classify as CODING_TASK or CHAT. Return ONLY the word.`;
            const intentResponse = await chatWithOllama(intentPrompt);
            const category = (intentResponse || "CHAT").trim();
            if (category.includes("CODING_TASK")) {
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
                    const finalMsg = "✅ Kész! Itt az eredmény:\n\n```javascript\n" + result + "\n```";
                    socket.emit('bot_message', { text: finalMsg });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', finalMsg);
                }
                catch (e) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    const errMsg = `⚠️ Sajnos nem sikerült: ${errorMessage}`;
                    socket.emit('bot_message', { text: errMsg });
                    saveMessage(DEFAULT_CHAT_ID, 'bot', errMsg);
                }
            }
            else {
                const response = await chatWithOllama(userMsg, "You are Brunella, a helpful AI assistant.");
                socket.emit('bot_message', { text: response });
                saveMessage(DEFAULT_CHAT_ID, 'bot', response);
            }
        });
    });
}
export function setupMcpEndpoints(app, mcpServer) {
    console.log("Setting up MCP SSE endpoints...");
    app.get('/sse', async (req, res) => {
        const transport = new SSEServerTransport("/message", res);
        transports.set(transport.sessionId, transport);
        transport.onclose = () => {
            transports.delete(transport.sessionId);
        };
        await mcpServer.connect(transport);
        await transport.start();
    });
    app.post('/message', async (req, res) => {
        const sessionId = req.query.sessionId;
        const transport = transports.get(sessionId);
        if (!transport) {
            res.status(404).send("Session not found");
            return;
        }
        await transport.handlePostMessage(req, res);
    });
}
export function startWebServer(mcpServer) {
    const webUiEnabled = process.env.WEB_UI_ENABLED !== "0" && process.env.WEB_UI_ENABLED !== "false";
    if (!webUiEnabled) {
        console.error("WEB_UI_ENABLED=0 -> Web UI disabled");
        return;
    }
    const app = createApp();
    const httpServer = createServer(app);
    const io = new Server(httpServer);
    if (mcpServer) {
        setupMcpEndpoints(app, mcpServer);
    }
    setupSocket(io);
    const portValue = Number(process.env.WEB_UI_PORT || 3000);
    const PORT = Number.isFinite(portValue) ? portValue : 3000;
    httpServer.listen(PORT, () => {
        console.error(`🌐 Web UI: http://localhost:${PORT}`);
    });
}
