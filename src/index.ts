
// Main entry point for MCP Brunella Core
// This file must remain compatible with both Node.js and Cloudflare Workers environments.
// All Node.js-specific dependencies must be imported dynamically.

async function main() {
  // Conditional execution for Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Dynamic imports to prevent bundling Node-native modules in Worker builds
    await import('dotenv/config');
    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
    const { startWebServer } = await import("./server/web.js");
    const { registerAllTools } = await import("./server/registry.js");
    const { agentManager } = await import("./agents/AgentManager.js");
    const { validateSecrets } = await import("./utils/validateSecrets.js");

    // Create server instance
    const server = new McpServer({
      name: "mcp-brunella-core",
      version: "1.0.0",
    });

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
  let errorMessage = "Unknown error";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else {
    try {
      errorMessage = JSON.stringify(error);
    } catch {
      errorMessage = Object.prototype.toString.call(error);
    }
  }

  console.error("Server error:", errorMessage);
  if (error instanceof Error && error.stack) console.error(error.stack);

  if (error && typeof error === 'object' && !(error instanceof Error)) {
    try { console.error("Raw error:", JSON.stringify(error, null, 2)); } catch { /* non-serializable */ }
  }
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }
});
