import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface McpServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export class BrunellaClient {
    private clients: Map<string, Client> = new Map();
    private transports: Map<string, any> = new Map();

    async connect() {
        // Load config from mcp_servers.json
        const configPath = path.resolve(process.cwd(), 'mcp_servers.json');
        if (!fs.existsSync(configPath)) {
            throw new Error(`MCP config not found at ${configPath}`);
        }

        const servers: McpServerConfig[] = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

        for (const server of servers) {
            try {
                // For 'brunella-core', we use the build path directly if it's relative
                let command = server.command;
                let args = [...server.args];

                if (server.name === 'brunella-core' && args[0] === './build/index.js') {
                    args[0] = path.resolve(process.cwd(), 'build', 'index.js');
                }

                const transport = new StdioClientTransport({
                    command: command,
                    args: args,
                    env: { ...process.env, ...(server.env || {}), WEB_UI_ENABLED: 'false' }
                });

                const client = new Client(
                    { name: `brunella-cli-${server.name}`, version: "1.0.0" },
                    { capabilities: {} }
                );

                await client.connect(transport);
                this.clients.set(server.name, client);
                this.transports.set(server.name, transport);
                // console.log(`Connected to MCP server: ${server.name}`);
            } catch (e: any) {
                console.error(`Failed to connect to ${server.name}: ${e.message}`);
            }
        }
    }

    async listTools() {
        const allTools: any[] = [];
        for (const [name, client] of this.clients) {
            const result = await client.listTools();
            // Add server name to tool if needed or just merge
            allTools.push(...result.tools);
        }
        return { tools: allTools };
    }

    async callTool(name: string, args: any) {
        // Search for which client has this tool
        for (const [serverName, client] of this.clients) {
            const result = await client.listTools();
            if (result.tools.some(t => t.name === name)) {
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
