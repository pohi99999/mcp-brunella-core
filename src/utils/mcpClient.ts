import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import path from "path";
import fs from "fs";
import { logError, logInfo, logWarn } from "./logger.js";
import {
  hasPrebuiltTool,
  type ToolLike,
} from "./prebuiltTools.js";

interface McpServerConfig {
  name: string;
  transport?: "self" | "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  disabled?: boolean;
}

interface ConnectOptions {
  coreOnly?: boolean;
  timeoutMs?: number;
}

export class BrunellaClient {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, any> = new Map();
  private toolCache: Map<string, string> = new Map(); // tool name -> server name
  /** Names of servers whose transport is "self" and that could not be reached via SSE. */
  private selfServers: Set<string> = new Set();

  async connect(options: ConnectOptions = {}) {
    if (process.env.BRUNELLA_MCP_DISABLED === '1') {
      throw new Error('MCP connections disabled (BRUNELLA_MCP_DISABLED=1)');
    }
    // Load config from mcp_servers.json
    const configPath = path.resolve(process.cwd(), "mcp_servers.json");
    if (!fs.existsSync(configPath)) {
      throw new Error(`MCP config not found at ${configPath}`);
    }

    const allServers: McpServerConfig[] = JSON.parse(
      fs.readFileSync(configPath, "utf-8"),
    );

    const servers = options.coreOnly
      ? allServers.filter(
          (server) => server.name === "brunella-core" || server.name === "brunella-remote",
        )
      : allServers;

    const defaultTimeout = Number(process.env.BRUNELLA_MCP_CONNECT_TIMEOUT_MS || "8000");
    const timeoutMs = options.timeoutMs ?? defaultTimeout;

    const activeServers = servers.filter((s) => !s.disabled);
    for (const s of servers.filter((s) => s.disabled)) {
      logInfo("MCP", `Skipping disabled server: ${s.name}`);
    }

    const connectOne = async (server: McpServerConfig): Promise<void> => {
      let transport:
        | StdioClientTransport
        | StreamableHTTPClientTransport
        | SSEClientTransport
        | undefined;
      try {
        const transportType = server.transport ?? "stdio";
        if (transportType === "self") {
          // Attempt to reach the self-managed server's SSE endpoint.
          // The BAS HTTP server exposes /sse on the main web port (default 3000).
          const port = process.env.PORT ?? '3000';
          const sseUrl = new URL(`http://127.0.0.1:${port}/sse`);
          const sseClient = new Client(
            { name: `brunella-cli-${server.name}`, version: "1.0.0" },
            { capabilities: {} },
          );
          const sseTransport = new SSEClientTransport(sseUrl);
          const selfTimeout = 2000; // short — server is local or not running
          try {
            await Promise.race([
              sseClient.connect(sseTransport),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error(`SSE self-connect timeout (${selfTimeout}ms)`)), selfTimeout)
              ),
            ]);
            this.clients.set(server.name, sseClient);
            this.transports.set(server.name, sseTransport);
            logInfo("MCP", `Self-managed server '${server.name}' connected via SSE at ${sseUrl}`);
          } catch (e: unknown) {
            if (sseTransport?.close) {
              try { await sseTransport.close(); } catch { /* best effort */ }
            }
            const msg = e instanceof Error ? e.message : String(e);
            this.selfServers.add(server.name);
             logWarn(
               "MCP",
               `Self-managed server '${server.name}' not reachable (${msg}). ` +
               `Prebuilt fallback metadata is disabled for safety. Start the server to get live definitions.`
             );
           }
          return;
        }

        if (transportType === "http") {
          if (!server.url) {
            throw new Error(`HTTP MCP server '${server.name}' is missing a url`);
          }

          const baseUrl = new URL(server.url);
          const client = new Client(
            { name: `brunella-cli-${server.name}`, version: "1.0.0" },
            { capabilities: {} },
          );

          const tryConnect = async (
            candidate:
              | StreamableHTTPClientTransport
              | SSEClientTransport,
          ): Promise<void> => {
            transport = candidate;
            await Promise.race([
              client.connect(candidate),
              new Promise<never>((_, reject) => {
                setTimeout(() => {
                  reject(new Error(`Connect timeout (${timeoutMs}ms)`));
                }, timeoutMs);
              }),
            ]);
          };

          try {
            await tryConnect(new StreamableHTTPClientTransport(baseUrl));
          } catch {
            if (transport?.close) {
              try { await transport.close(); } catch { /* best effort */ }
            }
            await tryConnect(new SSEClientTransport(baseUrl));
          }

          this.clients.set(server.name, client);
          this.transports.set(server.name, transport);
          return;
        }

        const command = server.command;
        if (!command) {
          throw new Error(`Stdio MCP server '${server.name}' is missing a command`);
        }

        const args = [...(server.args ?? [])];
        if (server.name === "brunella-core" && args[0] === "./build/index.js") {
          args[0] = path.resolve(process.cwd(), "build", "index.js");
        }

        const resolvedEnv: Record<string, string> = {};
        if (server.env) {
          for (const [key, val] of Object.entries(server.env)) {
            resolvedEnv[key] = val === "xxxxx" ? (process.env[key] ?? "") : val;
          }
        }

        transport = new StdioClientTransport({
          command,
          args,
          env: {
            ...process.env,
            ...resolvedEnv,
            WEB_UI_ENABLED: "false",
            BRUNELLA_QUIET_LOGS: "true",
          },
        });

        const client = new Client(
          { name: `brunella-cli-${server.name}`, version: "1.0.0" },
          { capabilities: {} },
        );

        await Promise.race([
          client.connect(transport),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error(`Connect timeout (${timeoutMs}ms)`));
            }, timeoutMs);
          }),
        ]);
        this.clients.set(server.name, client);
        this.transports.set(server.name, transport);
      } catch (e: unknown) {
        if (transport && transport.close) {
          try { await transport.close(); } catch { /* best effort */ }
        }
        const message = e instanceof Error ? e.message : String(e);
        logError("MCP", `Failed to connect to ${server.name}: ${message}`);
      }
    };

    await Promise.allSettled(activeServers.map(connectOne));
  }

  async listTools() {
    if (this.clients.size === 0) {
      if (this.selfServers.size > 0) {
        logWarn(
          "MCP",
          `No live MCP connections. Returning an empty tool list instead of stale prebuilt metadata. ` +
          `Unreachable self-managed servers: ${[...this.selfServers].join(', ')}. ` +
          `Start the BAS HTTP server to enable live tool definitions.`
        );
      }
      return { tools: [] as ToolLike[] };
    }

    const liveTools: ToolLike[] = [];
    for (const [name, client] of this.clients) {
      try {
        const result = await client.listTools();
        // Cache tool -> server mapping
        const tools = Array.isArray(result.tools) ? (result.tools as ToolLike[]) : [];
        for (const tool of tools) {
          this.toolCache.set(tool.name, name);
        }
        liveTools.push(...tools);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        logError("MCP", `Failed to list tools from ${name}: ${message}`);
      }
    }

    return { tools: liveTools };
  }

  async callTool(name: string, args: any) {
    // Try cache first
    if (this.toolCache.has(name)) {
      const serverName = this.toolCache.get(name)!;
      const client = this.clients.get(serverName);
      if (client) {
        try {
          return await client.callTool({ name, arguments: args });
        } catch (error: unknown) {
          // If cached lookup fails, fall through to full search
          const message = error instanceof Error ? error.message : String(error);
          logError(
            "MCP",
            `Tool '${name}' failed on cached server '${serverName}', retrying... (${message})`,
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
    if (hasPrebuiltTool(name)) {
      if (this.selfServers.has("brunella-core")) {
        throw new Error(
          `Tool '${name}' is only known from the local prebuilt catalog, but brunella-core is self-managed and currently not connected. Start the BAS HTTP server or use brunella-remote for live tool execution.`,
        );
      }
      throw new Error(
        `Tool '${name}' exists in the prebuilt catalog, but no connected MCP server exposes it.`,
      );
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
