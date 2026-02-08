
// Main entry point for MCP Brunella Core
// This file must remain compatible with both Node.js and Cloudflare Workers environments.
// All Node.js-specific dependencies must be imported dynamically.

async function main() {
  // Conditional execution for Node.js environment
  if (typeof process !== 'undefined' && process.versions && process.versions.node) {
    // Dynamic imports to prevent bundling Node-native modules in Worker builds
    // We use template strings or variables to prevent esbuild from analyzing and bundling these paths
    await import('dotenv/config');
    const serverPath = './server';
    const agentsPath = './agents';
    const utilsPath = './utils';

    const { McpServer } = await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

    // Obfuscated imports
    const { startWebServer } = await import(`${serverPath}/web.js`);
    const { registerAllTools } = await import(`${serverPath}/registry.js`);
    const { agentManager } = await import(`${agentsPath}/AgentManager.js`);
    const { validateSecrets } = await import(`${utilsPath}/validateSecrets.js`);

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
