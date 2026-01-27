import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startWebServer } from "./server/web.js";
import { registerAllTools } from "./server/registry.js";

// Create server instance
const server = new McpServer({
  name: "mcp-brunella-core",
  version: "1.0.0",
});

// Register Tools
registerAllTools(server);

async function main() {
  // Start Web Interface (which will now also handle SSE)
  await startWebServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Brunella Core Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});