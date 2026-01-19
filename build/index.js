"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const workspace_js_1 = require("./tools/workspace.js");
const knowledge_js_1 = require("./tools/knowledge.js");
const system_js_1 = require("./tools/system.js");
const browser_js_1 = require("./tools/browser.js");
const interpreter_js_1 = require("./tools/interpreter.js");
const copilotCliTool_js_1 = require("./tools/copilotCliTool.js");
const julesCliTool_js_1 = require("./tools/julesCliTool.js");
const ollamaTool_js_1 = require("./tools/ollamaTool.js");
const claudeTool_js_1 = require("./tools/claudeTool.js");
const llmPipeline_js_1 = require("./pipeline/llmPipeline.js");
const googleWorkspace_js_1 = require("./tools/googleWorkspace.js");
const anythingLLMTool_js_1 = require("./tools/anythingLLMTool.js");
const web_js_1 = require("./server/web.js");
// Create server instance
const server = new mcp_js_1.McpServer({
    name: "mcp-brunella-core",
    version: "1.0.0",
});
// Register Tools
(0, workspace_js_1.registerWorkspaceTools)(server);
(0, knowledge_js_1.registerKnowledgeTools)(server);
(0, system_js_1.registerSystemTools)(server);
(0, browser_js_1.registerBrowserTools)(server);
(0, interpreter_js_1.registerInterpreterTools)(server);
(0, copilotCliTool_js_1.registerCopilotCliTool)(server);
(0, julesCliTool_js_1.registerJulesCliTool)(server);
(0, ollamaTool_js_1.registerOllamaTool)(server);
(0, claudeTool_js_1.registerClaudeTool)(server);
(0, llmPipeline_js_1.registerPipelineTools)(server);
(0, googleWorkspace_js_1.registerGoogleWorkspaceTools)(server);
(0, anythingLLMTool_js_1.registerAnythingLLMTool)(server);
server.tool("ping", "A simple ping tool to verify the server is running.", {}, async () => {
    return {
        content: [
            {
                type: "text",
                text: "Pong! MCP Brunella Core is active.",
            },
        ],
    };
});
async function main() {
    // Start Web Interface
    (0, web_js_1.startWebServer)();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Brunella Core Server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
