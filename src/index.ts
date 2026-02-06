import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// Dynamic import for Stdio transport to avoid bundling Node.js modules in Worker
// import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

  // Start Web Server & Stdio Transport only in Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
          // Dynamic import for Web Server
          const { startWebServer } = await import("./server/web.js");
          await startWebServer();

          // Dynamic import for Stdio Transport
          const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
          const transport = new StdioServerTransport();
          await server.connect(transport);
          console.error("MCP Brunella Core Server running on stdio");
      } catch (e) {
          console.error("Failed to start Node.js services:", e);
      }
  } else {
      console.log("MCP Brunella Core running in non-Node environment (Worker mode)");
      // In Worker mode, we might attach listeners here if needed,
      // but for now we ensure it doesn't crash on build.
  }

  // Start Autonomous Worker Loop (Environment agnostic)
  agentManager.startWorkerLoop();
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
