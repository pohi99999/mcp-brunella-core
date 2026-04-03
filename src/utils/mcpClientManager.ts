import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { logWarn } from "./logger.js";

const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dirname ?? ".", "../../package.json"), "utf-8"),
) as { version: string };

export interface McpStdioConnectionRequest {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  onClose?: () => void;
  onError?: (error: Error) => void;
}

export interface McpClientConnection {
  client: Client;
  pid: number | null;
}

function toChildEnvironment(env: Record<string, string> = {}): Record<string, string> {
  const inherited: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      inherited[key] = value;
    }
  }

  return {
    ...inherited,
    ...env,
  };
}

export class McpClientManager {
  private clients = new Map<string, Client>();
  private transports = new Map<string, StdioClientTransport>();
  private pendingConnections = new Map<string, Promise<McpClientConnection>>();

  async connectStdio(
    request: McpStdioConnectionRequest,
  ): Promise<McpClientConnection> {
    const existingClient = this.clients.get(request.name);
    const existingTransport = this.transports.get(request.name);

    if (existingClient && existingTransport) {
      return {
        client: existingClient,
        pid: existingTransport.pid,
      };
    }

    const pending = this.pendingConnections.get(request.name);
    if (pending) {
      return pending;
    }

    const connectionPromise = this.createConnection(request).finally(() => {
      this.pendingConnections.delete(request.name);
    });

    this.pendingConnections.set(request.name, connectionPromise);
    return connectionPromise;
  }

  private async createConnection(
    request: McpStdioConnectionRequest,
  ): Promise<McpClientConnection> {
    const transport = new StdioClientTransport({
      command: request.command,
      args: request.args ?? [],
      env: toChildEnvironment(request.env),
      cwd: request.cwd,
      stderr: "pipe",
    });

    const stderrStream = transport.stderr;
    const handleStderrData = (chunk: Buffer | string) => {
      const text = Buffer.isBuffer(chunk)
        ? chunk.toString("utf-8").trim()
        : String(chunk).trim();
      if (text.length > 0) {
        logWarn("MCP", `[${request.name}] stderr: ${text}`);
      }
    };
    if (stderrStream) {
      stderrStream.on("data", handleStderrData);
    }

    const client = new Client(
      { name: "brunella-gateway", version: pkg.version },
      { capabilities: {} },
    );

    transport.onclose = () => {
      stderrStream?.removeListener("data", handleStderrData);
      this.clients.delete(request.name);
      this.transports.delete(request.name);
      request.onClose?.();
    };

    transport.onerror = (error: Error) => {
      request.onError?.(error);
    };

    try {
      await client.connect(transport);
      this.clients.set(request.name, client);
      this.transports.set(request.name, transport);
      return {
        client,
        pid: transport.pid,
      };
    } catch (error: unknown) {
      stderrStream?.removeListener("data", handleStderrData);
      await transport.close().catch(() => undefined);
      throw error;
    }
  }

  getClient(name: string): Client | undefined {
    return this.clients.get(name);
  }

  getPid(name: string): number | null {
    return this.transports.get(name)?.pid ?? null;
  }

  getClientNames(): string[] {
    return Array.from(this.clients.keys());
  }

  async disconnect(name: string): Promise<void> {
    const client = this.clients.get(name);
    if (client) {
      await client.close();
      this.clients.delete(name);
    }

    const transport = this.transports.get(name);
    if (transport) {
      await transport.close();
      this.transports.delete(name);
    }
  }

  async disconnectAll(): Promise<void> {
    for (const name of Array.from(this.clients.keys())) {
      await this.disconnect(name);
    }
  }

  async listTools(clientName: string) {
    const client = this.getClient(clientName);
    if (!client) {
      throw new Error(`Client ${clientName} not found`);
    }

    return client.listTools();
  }

  async callTool(
    clientName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const client = this.getClient(clientName);
    if (!client) {
      throw new Error(`Client ${clientName} not found`);
    }

    return client.callTool({ name: toolName, arguments: args });
  }
}

export const mcpClientManager = new McpClientManager();
