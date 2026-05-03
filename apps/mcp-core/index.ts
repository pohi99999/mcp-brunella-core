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
    console.error("[BOOT] 1/6 Loading dotenv...");
    await import("dotenv/config");

    // ── Phase 0: Lightweight imports only ────────────────────────
    // Heavy modules (AgentManager, registry) are imported AFTER the
    // web server is listening to avoid OOM before the event loop runs.
    const otelDisabled = ["1", "true", "yes", "on"].includes(
      (process.env.OTEL_SDK_DISABLED ?? "").trim().toLowerCase(),
    );
    const otelEndpoint = (process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "").trim();

    if (otelDisabled || !otelEndpoint) {
      console.error(
        "[BOOT] 2/6 Skipping OTel init (disabled or no OTLP endpoint)",
      );
    } else {
      console.error("[BOOT] 2/6 Loading OTel module...");
      const { initOtelTracing } = await import("@packages/utils/otelTracing.js");
      console.error("[BOOT] 3/6 Calling initOtelTracing...");
      initOtelTracing();
    }
    console.error("[BOOT] 4/6 Loading web server module...");
    const { startWebServer } = await import("./server/web.js");
    console.error("[BOOT] 5/6 Loading validateSecrets...");
    const { validateSecrets } = await import("@packages/utils/validateSecrets.js");
    const { readFileSync } = await import("fs");

    console.error("[BOOT] 5b/6 Calling validateSecrets...");
    validateSecrets();

    // ── Phase 1: Start web server (Express listen + Socket.IO) ──
    // Returns as soon as :3000 is accepting connections.
    // deferredInit() runs in the background handling routes, agents, etc.
    console.error("[BOOT] 6/6 Calling startWebServer...");
    await startWebServer();
    console.error("[BOOT] DONE — startWebServer returned");

    // ── Phase 2: MCP stdio (interactive or explicitly forced for tests) ──
    // In web-only mode (no TTY), everything is handled by deferredInit in web.ts.
    // An explicit override keeps production web-only behavior intact while
    // still allowing child-process test harnesses to exercise stdio MCP.
    const forceStdio = ["1", "true", "yes", "on"].includes(
      (process.env.BRUNELLA_FORCE_STDIO ?? "").trim().toLowerCase(),
    );
    const webOnly = ["1", "true", "yes", "on"].includes(
      (process.env.BRUNELLA_WEB_ONLY ?? "").trim().toLowerCase(),
    );
    const shouldStartStdio = !webOnly && (Boolean(process.stdin.isTTY) || forceStdio);

    if (shouldStartStdio) {
      const { McpServer } =
        await import("@modelcontextprotocol/sdk/server/mcp.js");
      const { StdioServerTransport } =
        await import("@modelcontextprotocol/sdk/server/stdio.js");
      const { registerAllTools } = await import("./server/registry.js");

      const pkgVersion = (() => {
        try {
          const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
          return typeof pkg.version === "string" ? pkg.version : "1.0.0";
        } catch {
          return "1.0.0";
        }
      })();

      const server = new McpServer({
        name: "mcp-brunella-core",
        version: pkgVersion,
      });

      await registerAllTools(server);

      const transport = new StdioServerTransport();
      await server.connect(transport);
      const { mcpProcessManager } = await import("./server/McpProcessManager.js");
      mcpProcessManager.markInternalServerRunning("brunella-core");
      console.error("MCP Brunella Core Server running on stdio");

      // Graceful shutdown for MCP mode
      const shutdown = async (signal: string) => {
        console.error(`\n[Shutdown] ${signal} received`);
        try {
          const { agentManager } = await import("@packages/agents/AgentManager.js");
          agentManager.stopWorkerLoop();
          const { mcpProcessManager } = await import("./server/McpProcessManager.js");
          await mcpProcessManager.stopAll();
          mcpProcessManager.markInternalServerStopped("brunella-core");
          const { remoteSessionManager } = await import("@packages/core-logic/RemoteSessionManager.js");
          remoteSessionManager.stopCleanupTimer();
          const { stopLangSmithFlush } = await import("@packages/utils/agentTracer.js");
          stopLangSmithFlush();
          const { shutdownWebServer } = await import("./server/web.js");
          await shutdownWebServer();
          const { shutdownOtelTracing } = await import("@packages/utils/otelTracing.js");
          await shutdownOtelTracing();
          await server.close?.();
        } catch (e) {
          console.error("[Shutdown] Error:", e);
        }
        process.exit(0);
      };
      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    } else {
      console.error("MCP Brunella Core Server running in web-only mode (no stdin TTY)");

      // Graceful shutdown for web-only mode
      const shutdown = async (signal: string) => {
        console.error(`\n[Shutdown] ${signal} received`);
        try {
          const { agentManager } = await import("@packages/agents/AgentManager.js");
          agentManager.stopWorkerLoop();
          const { mcpProcessManager } = await import("./server/McpProcessManager.js");
          await mcpProcessManager.stopAll();
          mcpProcessManager.markInternalServerStopped("brunella-core");
          const { remoteSessionManager } = await import("@packages/core-logic/RemoteSessionManager.js");
          remoteSessionManager.stopCleanupTimer();
          const { stopLangSmithFlush } = await import("@packages/utils/agentTracer.js");
          stopLangSmithFlush();
          const { shutdownWebServer } = await import("./server/web.js");
          await shutdownWebServer();
          const { shutdownOtelTracing } = await import("@packages/utils/otelTracing.js");
          await shutdownOtelTracing();
        } catch (e) {
          console.error("[Shutdown] Error:", e);
        }
        process.exit(0);
      };
      process.on("SIGTERM", () => shutdown("SIGTERM"));
      process.on("SIGINT", () => shutdown("SIGINT"));
    }
  } else {
    console.warn(
      "MCP Brunella Core: Non-Node.js environment detected. Skipping Node-specific initialization.",
    );
  }
}

main().catch((error: unknown) => {
  console.error("\n[FATAL ERROR] Server failed to start!");
  console.error("================================================");
  
  if (error instanceof Error) {
    console.error("Error Type: Error");
    console.error("Message:", error.message);
    console.error("Stack:", error.stack);
    console.error("Cause:", error.cause);
  } else if (typeof error === "string") {
    console.error("Error Type: String");
    console.error("Message:", error);
  } else if (typeof error === "object" && error !== null) {
    console.error("Error Type: Object");
    console.error("Keys:", Object.keys(error));
    console.error("Full object:", error);
    try {
      console.error("JSON:", JSON.stringify(error, null, 2));
    } catch (stringifyErr) {
      console.error("Could not stringify error:", stringifyErr instanceof Error ? stringifyErr.message : stringifyErr);
    }
  } else {
    console.error("Error Type: Other");
    console.error("Value:", error);
    console.error("Type:", typeof error);
  }
  
  console.error("================================================");
  console.error("\nTip: Check logs/ directory for more details");
  console.error("  - logs/error.log");
  console.error("  - logs/server.log");
  console.error("  - logs/health.log");
  
  if (typeof process !== "undefined" && process.exit) {
    process.exit(1);
  }
});

