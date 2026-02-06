import 'dotenv/config';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { startWebServer } from "./server/web.js";
import { registerAllTools } from "./server/registry.js";
import { agentManager } from "./agents/AgentManager.js";
import { validateSecrets } from "./utils/validateSecrets.js";

// Create server instance
const server = new McpServer({
  name: "mcp-brunella-core",
  version: "1.0.0",
});

async function main() {
  validateSecrets();
  registerAllTools(server);
  await startWebServer();

  // Start Autonomous Worker Loop
  agentManager.startWorkerLoop();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Brunella Core Server running on stdio");
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("Server error:", err.message);
  if (err.stack) console.error(err.stack);
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    try { console.error("Raw error:", JSON.stringify(error, null, 2)); } catch { /* non-serializable */ }
  }
  process.exit(1);
});