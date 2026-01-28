import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class McpClientManager {
    private clients: Map<string, Client> = new Map();

    async connectStdio(name: string, command: string, args: string[], env: any = {}) {
        const transport = new StdioClientTransport({
            command,
            args,
            env: { ...process.env, ...env }
        });

        const client = new Client(
            { name: "brunella-gateway", version: "1.0.0" },
            { capabilities: { } }
        );

        await client.connect(transport);
        this.clients.set(name, client);
        return client;
    }

    getClient(name: string) {
        return this.clients.get(name);
    }

    getClientNames() {
        return Array.from(this.clients.keys());
    }

    async listTools(clientName: string) {
        const client = this.getClient(clientName);
        if (!client) throw new Error(`Client ${clientName} not found`);
        return await client.listTools();
    }

    async callTool(clientName: string, toolName: string, args: any) {
        const client = this.getClient(clientName);
        if (!client) throw new Error(`Client ${clientName} not found`);
        return await client.callTool({ name: toolName, arguments: args });
    }
}

export const mcpClientManager = new McpClientManager();
