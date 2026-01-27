import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class McpClientManager {
    private activeClients: Map<string, Client> = new Map();

    public async connectStdio(name: string, command: string, args: string[], env: Record<string, string> = {}): Promise<Client> {
        console.log(`Connecting to MCP server '${name}' (${command} ${args.join(' ')})...`);

        const safeEnv: Record<string, string> = {};
        const combinedEnv = { ...process.env, ...env };
        for (const key in combinedEnv) {
            const val = combinedEnv[key];
            if (val !== undefined) {
                safeEnv[key] = val;
            }
        }

        const transport = new StdioClientTransport({
            command: command,
            args: args,
            env: safeEnv
        });

        const client = new Client({
            name: "gemini-cli-client",
            version: "1.0.0"
        }, {
            capabilities: {}
        });

        try {
            await client.connect(transport);
            this.activeClients.set(name, client);
            console.log(`✅ Connected to ${name}`);
            return client;
        } catch (error) {
            console.error(`❌ Failed to connect to ${name}:`, error);
            throw error;
        }
    }

    public async listTools(clientName: string) {
        const client = this.activeClients.get(clientName);
        if (!client) throw new Error(`Client '${clientName}' not found.`);
        return await client.listTools();
    }

    public async callTool(clientName: string, toolName: string, args: any) {
        const client = this.activeClients.get(clientName);
        if (!client) throw new Error(`Client '${clientName}' not found.`);
        return await client.callTool({ name: toolName, arguments: args });
    }

    public getClient(name: string): Client | undefined {
        return this.activeClients.get(name);
    }

    public getClientNames(): string[] {
        return Array.from(this.activeClients.keys());
    }

    public async getToolsForLLM(): Promise<any[]> {
        const allTools: any[] = [];
        for (const [serverName, client] of this.activeClients.entries()) {
            try {
                const result = await client.listTools();
                for (const tool of result.tools) {
                    allTools.push({
                        type: 'function',
                        function: {
                            name: tool.name, // We might want to namespace this: serverName_toolName? For now, keep simple.
                            description: tool.description || '',
                            parameters: tool.inputSchema
                        }
                    });
                }
            } catch (e) {
                console.error(`Error listing tools for ${serverName}:`, e);
            }
        }
        return allTools;
    }

    public async disconnectAll() {
        // SDK doesn't always expose a clean disconnect on the client directly in all versions, 
        // but typically transports should be closed. 
        // For Stdio, killing the process is handled by the transport usually.
        this.activeClients.clear();
    }
}

export const mcpClientManager = new McpClientManager();

