// Main entry point for MCP Brunella Core
// This file must remain compatible with both Node.js and Cloudflare Workers environments.
// All Node.js-specific dependencies must be imported dynamically.

async function main() {
  // Conditional execution for Node.js environment
  if (
    typeof process !== "undefined" &&
    process.versions &&
    process.versions.node
  ) {
    // Dynamic imports to prevent bundling Node-native modules in Worker builds
    await import("dotenv/config");

    // Initialize OpenTelemetry tracing BEFORE other imports
    const { initOtelTracing } = await import("./utils/otelTracing.js");
    initOtelTracing();
    const { McpServer } =
      await import("@modelcontextprotocol/sdk/server/mcp.js");
    const { StdioServerTransport } =
      await import("@modelcontextprotocol/sdk/server/stdio.js");
    const { startWebServer } = await import("./server/web.js");
    const { registerAllTools } = await import("./server/registry.js");
    const { initializeAgentManager } = await import("./agents/AgentManager.js"); // agentManager removed from destructuring
    const { socketService } = await import("./server/SocketService.js");
    const { validateSecrets } = await import("./utils/validateSecrets.js");
    const { readFileSync } = await import("fs");

    // Read version from package.json
    const pkgVersion = (() => {
      try {
        const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
        return typeof pkg.version === "string" ? pkg.version : "1.0.0";
      } catch {
        return "1.0.0";
      }
    })();

    // Create server instance
    const server = new McpServer({
      name: "mcp-brunella-core",
      version: pkgVersion,
    });

    validateSecrets();

    // Start web server first to initialize socketService and agentManager
    await startWebServer();
    const initializedAgentManager = initializeAgentManager(socketService); // Call the initializer and capture the returned instance

    // Register Tools - agentManager should now be initialized
    await registerAllTools(server);

    // Start Autonomous Worker Loop
    initializedAgentManager.startWorkerLoop();

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Brunella Core Server running on stdio");

    // Graceful shutdown handling
    const shutdown = async (signal: string) => {
      console.error(
        `\n[Shutdown] Received ${signal}, graceful shutdown initiated...`,
      );
      try {
        initializedAgentManager.stopWorkerLoop(); // Use the captured instance
        // Flush and shut down OpenTelemetry before exit
        const { shutdownOtelTracing } = await import("./utils/otelTracing.js");
        await shutdownOtelTracing();
        await server.close?.();
        console.error("[Shutdown] Cleanup complete.");
      } catch (e) {
        console.error("[Shutdown] Error during cleanup:", e);
      }
      process.exit(0);
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  } else {
    console.warn(
      "MCP Brunella Core: Non-Node.js environment detected. Skipping Node-specific initialization.",
    );
  }
}

main().catch((error: unknown) => {
  let errorMessage = "Unknown error";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
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

  if (error && typeof error === "object" && !(error instanceof Error)) {
    try {
      console.error("Raw error:", JSON.stringify(error, null, 2));
    } catch {
      /* non-serializable */
    }
  }
  if (typeof process !== "undefined" && process.exit) {
    process.exit(1);
  }
});
