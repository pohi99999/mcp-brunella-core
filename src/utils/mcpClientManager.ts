import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "fs";
import { resolve } from "path";

const pkg = JSON.parse(
  readFileSync(
    resolve(import.meta.dirname ?? ".", "../../package.json"),
    "utf-8",
  ),
) as { version: string };

export class McpClientManager {
  private clients: Map<string, Client> = new Map();
  private transports: Map<string, StdioClientTransport> = new Map();

  async connectStdio(
    name: string,
    command: string,
    args: string[],
    env: Record<string, string> = {},
  ) {
    const transport = new StdioClientTransport({
      command,
      args,
      env: { ...process.env, ...env } as Record<string, string>,
    });

    const client = new Client(
      { name: "brunella-gateway", version: pkg.version },
      { capabilities: {} },
    );

    await client.connect(transport);
    this.clients.set(name, client);
    this.transports.set(name, transport);
    return client;
  }

  getClient(name: string) {
    return this.clients.get(name);
  }

  getClientNames() {
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
    for (const name of this.clients.keys()) {
      await this.disconnect(name);
    }
  }

  async listTools(clientName: string) {
    const client = this.getClient(clientName);
    if (!client) throw new Error(`Client ${clientName} not found`);
    return await client.listTools();
  }

  async callTool(
    clientName: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    const client = this.getClient(clientName);
    if (!client) throw new Error(`Client ${clientName} not found`);
    return await client.callTool({ name: toolName, arguments: args });
  }
}

export const mcpClientManager = new McpClientManager();
