import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Create server instance
const server = new McpServer({
  name: "mcp-brunella-core",
  version: "1.0.0",
});

async function main() {
  // Conditional execution for Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Dynamic imports to prevent bundling Node-native modules in Worker builds
    await import('dotenv/config');
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const { startWebServer } = await import("./server/web.js");
    const { registerAllTools } = await import("./server/registry.js");
    const { agentManager } = await import("./agents/AgentManager.js");
    const { validateSecrets } = await import("./utils/validateSecrets.js");

    // Register Tools
    await registerAllTools(server);

    validateSecrets();

    await startWebServer();

    // Start Autonomous Worker Loop
    agentManager.startWorkerLoop();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Brunella Core Server running on stdio");
  } else {
    console.warn("MCP Brunella Core: Non-Node.js environment detected. Skipping Node-specific initialization.");
  }
}

main().catch((error: unknown) => {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error("Server error:", err.message);
  if (err.stack) console.error(err.stack);
  if (error && typeof error === 'object' && !(error instanceof Error)) {
    try { console.error("Raw error:", JSON.stringify(error, null, 2)); } catch { /* non-serializable */ }
  }
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }
});
