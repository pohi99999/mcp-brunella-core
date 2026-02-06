import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAllTools } from "./server/registry.js";
import { agentManager } from "./agents/AgentManager.js";
import { validateSecrets } from "./utils/validateSecrets.js";

// Create server instance
const server = new McpServer({
  name: "mcp-brunella-core",
  version: "1.0.0",
});

// Register Tools
registerAllTools(server);

async function main() {
  validateSecrets();

  // Conditionally load web server only if not in Worker environment
  // We check for process.release.name === 'node' which usually absent or different in Workers
  if (typeof process !== 'undefined' && process.release?.name === 'node') {
      try {
          const { startWebServer } = await import("./server/web.js");
          await startWebServer();
      } catch (e) {
          console.error("Failed to start web server (likely in Worker env):", e);
      }
  }

  // Start Autonomous Worker Loop
  agentManager.startWorkerLoop();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Brunella Core Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});