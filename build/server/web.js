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
const logger_js_1 = require("../utils/logger.js");
const llmPipeline_js_1 = require("../pipeline/llmPipeline.js");
const db_js_1 = require("../utils/db.js");
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
const logger = new logger_js_1.Logger('web_ui.log');
function startWebServer() {
    (0, db_js_1.initDb)();
    const app = (0, express_1.default)();
    const httpServer = (0, http_1.createServer)(app);
    const io = new socket_io_1.Server(httpServer);
    app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
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
    const PORT = 3000;
    httpServer.listen(PORT, () => {
        console.error(`🌐 Web UI: http://localhost:${PORT}`);
    });
}
