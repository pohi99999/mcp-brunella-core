"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const web_js_1 = require("./server/web.js");
const registry_js_1 = require("./server/registry.js");
// Create server instance
const server = new mcp_js_1.McpServer({
    name: "mcp-brunella-core",
    version: "1.0.0",
});
// Register Tools
(0, registry_js_1.registerAllTools)(server);
async function main() {
    // Start Web Interface (which will now also handle SSE)
    (0, web_js_1.startWebServer)();
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Brunella Core Server running on stdio");
}
main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
