import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export class McpClientService {
    private client: Client;
    private transport: SSEClientTransport;
    public isConnected: boolean = false;

    constructor() {
        this.transport = new SSEClientTransport(new URL("/sse", window.location.href));
        this.client = new Client({
            name: "dashboard-client",
            version: "1.0.0",
        }, {
            capabilities: {}
        });
    }

    async connect() {
        if (this.isConnected) return;
        try {
            await this.client.connect(this.transport);
            this.isConnected = true;
            console.log("MCP Client connected");
        } catch (e) {
            console.error("MCP Client connection error:", e);
            throw e;
        }
    }

    async listTools() {
        if (!this.isConnected) await this.connect();
        return await this.client.listTools();
    }

    async callTool(name: string, args: any) {
        if (!this.isConnected) await this.connect();
        return await this.client.callTool({
            name,
            arguments: args
        });
    }
}

export const mcpClient = new McpClientService();
