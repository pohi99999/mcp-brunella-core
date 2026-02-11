import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { logError, logInfo } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface McpServerConfig {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

export class BrunellaClient {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map();
  private toolCache: Map<string, string> = new Map(); // tool name -> server name

  async connect() {
    // Load config from mcp_servers.json
    const configPath = path.resolve(process.cwd(), "mcp_servers.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`MCP config not found at ${configPath}`);
    }

    const servers: McpServerConfig[] = JSON.parse(
      fs.readFileSync(configPath, "utf-8"),
    );

    for (const server of servers) {
      if (server.disabled) {
        logInfo("MCP", `Skipping disabled server: ${server.name}`);
        continue;
      }
      try {
        // For 'brunella-core', we use the build path directly if it's relative
        let command = server.command;
        let args = [...server.args];

        if (server.name === "brunella-core" && args[0] === "./build/index.js") {
          args[0] = path.resolve(process.cwd(), "build", "index.js");
        }

        // Resolve env values: replace "xxxxx" placeholders with process.env equivalents
        const resolvedEnv: Record<string, string> = {};
        if (server.env) {
          for (const [key, val] of Object.entries(server.env)) {
            resolvedEnv[key] = val === "xxxxx" ? (process.env[key] ?? "") : val;
          }
        }

        const transport = new StdioClientTransport({
          command: command,
          args: args,
          env: {
            ...process.env,
            ...resolvedEnv,
            // Allow overriding via env var, default to false for CLI
            WEB_UI_ENABLED: process.env.WEB_UI_ENABLED || "false",
          },
        });

        const client = new Client(
          { name: `brunella-cli-${server.name}`, version: "1.0.0" },
          { capabilities: {} },
        );

        await client.connect(transport);
        this.clients.set(server.name, client);
        this.transports.set(server.name, transport);
        // logInfo('MCP', `Connected to MCP server: ${server.name}`);
      } catch (e: any) {
        logError("MCP", `Failed to connect to ${server.name}: ${e.message}`);
      }
    }
  }

  async listTools() {
    const allTools: any[] = [];
    for (const [name, client] of this.clients) {
      const result = await client.listTools();
      // Cache tool -> server mapping
      for (const tool of result.tools) {
        this.toolCache.set(tool.name, name);
      }
      allTools.push(...result.tools);
    }
    return { tools: allTools };
  }

  async callTool(name: string, args: any) {
    // Try cache first
    if (this.toolCache.has(name)) {
      const serverName = this.toolCache.get(name)!;
      const client = this.clients.get(serverName);
      if (client) {
        try {
          return await client.callTool({ name, arguments: args });
        } catch (error: any) {
          // If cached lookup fails, fall through to full search
          logError(
            "MCP",
            `Tool '${name}' failed on cached server '${serverName}', retrying...`,
          );
          this.toolCache.delete(name);
        }
      }
    }

    // Fallback: Search for which client has this tool
    for (const [serverName, client] of this.clients) {
      const result = await client.listTools();
      const tool = result.tools.find((t) => t.name === name);
      if (tool) {
        this.toolCache.set(name, serverName); // Update cache
        return client.callTool({ name, arguments: args });
      }
    }
    throw new Error(`Tool '${name}' not found on any connected MCP server.`);
  }

  async close() {
    for (const [name, transport] of this.transports) {
      if (transport && transport.close) {
        await transport.close();
      }
    }
  }
}
