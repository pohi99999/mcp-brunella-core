import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// Dynamic import for web server to avoid bundling Node.js modules in Worker
// import { startWebServer } from "./server/web.js";
import { registerAllTools } from "./server/registry.js";
import { agentManager } from "./agents/AgentManager.js";
import { validateSecrets } from "./utils/validateSecrets.js";

// Create server instance
const server = new McpServer({
  name: "mcp-brunella-core",
  version: "1.0.0",
});

async function main() {
  // Register Tools (now async)
  await registerAllTools(server);
  
  validateSecrets();

  // Start Web Server only in Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
          const { startWebServer } = await import("./server/web.js");
          await startWebServer();
      } catch (e) {
          console.error("Failed to start web server (likely non-Node environment):", e);
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
