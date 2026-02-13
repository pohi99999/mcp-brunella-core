import { readFileSync } from "fs";
import { resolve } from "path";
import { logInfo, logError, logWarn } from "../utils/logger.js";
import { mcpClientManager } from "../utils/mcpClientManager.js";

interface McpServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, unknown>;
  disabled?: boolean;
}

interface ServerStatus {
  name: string;
  status: "running" | "stopped" | "error";
  error?: string;
}

export class McpProcessManager {
  private serverStatuses = new Map<string, ServerStatus>();
  private configs: McpServerConfig[] = [];

  async loadConfig(): Promise<McpServerConfig[]> {
    try {
      const configPath = resolve(process.cwd(), "mcp_servers.json");
      const raw = readFileSync(configPath, "utf-8");
      this.configs = JSON.parse(raw) as McpServerConfig[];
      logInfo("MCP", `Loaded ${this.configs.length} MCP server config(s)`);

      // Initialize statuses (skip self-reference)
      for (const cfg of this.configs) {
        if (cfg.name === "brunella-core") continue;
        this.serverStatuses.set(cfg.name, {
          name: cfg.name,
          status: cfg.disabled ? "stopped" : "stopped",
        });
      }

      return this.configs;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logWarn("MCP", `Could not load mcp_servers.json: ${msg}`);
      this.configs = [];
      return [];
    }
  }

  async startAll(): Promise<void> {
    if (this.configs.length === 0) {
      await this.loadConfig();
    }

    for (const cfg of this.configs) {
      if (cfg.disabled || cfg.name === "brunella-core") continue;
      await this.startServer(cfg.name);
    }
  }

  async startServer(name: string): Promise<void> {
    const cfg = this.configs.find((c) => c.name === name);
    if (!cfg) {
      logError("MCP", `Server config not found: ${name}`);
      return;
    }

    if (cfg.disabled) {
      logWarn("MCP", `Server ${name} is disabled`);
      this.serverStatuses.set(name, { name, status: "stopped" });
      return;
    }

    try {
      logInfo(
        "MCP",
        `Starting external MCP server: ${name} (${cfg.command} ${(cfg.args || []).join(" ")})`,
      );

      const env: Record<string, string> = {};
      if (cfg.env) {
        for (const [k, v] of Object.entries(cfg.env)) {
          env[k] = typeof v === "string" ? v : JSON.stringify(v);
        }
      }

      await mcpClientManager.connectStdio(
        name,
        cfg.command,
        cfg.args || [],
        env,
      );

      this.serverStatuses.set(name, { name, status: "running" });
      logInfo("MCP", `✅ MCP server connected: ${name}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError("MCP", `Failed to start MCP server ${name}: ${msg}`);
      this.serverStatuses.set(name, { name, status: "error", error: msg });
    }
  }

  async stopServer(name: string): Promise<void> {
    try {
      await mcpClientManager.disconnect(name);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logWarn("MCP", `Error disconnecting ${name}: ${msg}`);
    }
    this.serverStatuses.set(name, { name, status: "stopped" });
    logInfo("MCP", `Server stopped: ${name}`);
  }

  async stopAll(): Promise<void> {
    for (const name of this.serverStatuses.keys()) {
      const status = this.serverStatuses.get(name);
      if (status?.status === "running") {
        await this.stopServer(name);
      }
    }
  }

  getServersStatus(): ServerStatus[] {
    return Array.from(this.serverStatuses.values());
  }
}

export const mcpProcessManager = new McpProcessManager();
