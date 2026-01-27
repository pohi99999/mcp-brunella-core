import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

export class McpClientManager {
    private activeClients: Map<string, Client> = new Map();
    private clientMeta: Map<string, { command: string; args: string[]; env: Record<string, string>; retries: number; timeoutMs: number }> = new Map();
    private watchdogTimers: Map<string, NodeJS.Timeout> = new Map();
    private defaultWatchdogMs: number;

    constructor() {
        const envInterval = process.env.MCP_WATCHDOG_MS ? Number(process.env.MCP_WATCHDOG_MS) : NaN;
        this.defaultWatchdogMs = Number.isFinite(envInterval) && envInterval > 0 ? envInterval : 10000;
    }

    public async connectStdio(name: string, command: string, args: string[], env: Record<string, string> = {}, retries = 3, timeoutMs = 5000): Promise<Client> {
        console.log(`Connecting to MCP server '${name}' (${command} ${args.join(' ')})...`);

        const safeEnv: Record<string, string> = {};
        const combinedEnv = { ...process.env, ...env };
        for (const key in combinedEnv) {
            const val = combinedEnv[key];
            if (val !== undefined) {
                safeEnv[key] = val;
            }
        }

        let lastError;
        for (let i = 0; i < retries; i++) {
            try {
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

                // Timeout race to avoid hanging on connect
                const connectPromise = client.connect(transport);
                await Promise.race([
                    connectPromise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('connect timeout')), timeoutMs))
                ]);

                this.activeClients.set(name, client);
                this.clientMeta.set(name, { command, args, env: safeEnv, retries, timeoutMs });
                console.log(`✅ Connected to ${name}`);
                return client;
            } catch (error) {
                console.warn(`⚠️ Connection attempt ${i + 1}/${retries} failed for ${name}:`, error);
                lastError = error;
                await new Promise(resolve => setTimeout(resolve, 1000)); // wait 1s before retry
            }
        }

        console.error(`❌ Failed to connect to ${name} after ${retries} attempts.`);
        throw lastError;
    }

    public async listTools(clientName: string) {
        const client = await this.ensureClient(clientName);
        try {
            return await client.listTools();
        } catch (e) {
            await this.tryReconnect(clientName);
            const retry = await this.ensureClient(clientName);
            return await retry.listTools();
        }
    }

    public async callTool(clientName: string, toolName: string, args: any) {
        const client = await this.ensureClient(clientName);
        try {
            return await client.callTool({ name: toolName, arguments: args });
        } catch (e) {
            await this.tryReconnect(clientName);
            const retry = await this.ensureClient(clientName);
            return await retry.callTool({ name: toolName, arguments: args });
        }
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
                    const namespaced = `mcp.${serverName}.${tool.name}`;
                    allTools.push({
                        type: 'function',
                        function: {
                            name: namespaced,
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
        this.clientMeta.clear();
        this.watchdogTimers.forEach(t => clearInterval(t));
        this.watchdogTimers.clear();
    }

    public async healthCheck(name: string): Promise<{ status: 'ok' | 'failed'; reason?: string }> {
        try {
            const tools = await this.listTools(name);
            const hasPing = tools.tools.some((t: any) => t.name === 'ping');
            if (hasPing) {
                const res = await this.callTool(name, 'ping', {});
                if (!res || res.isError) return { status: 'failed', reason: 'ping error' };
            }
            return { status: 'ok' };
        } catch (e: any) {
            return { status: 'failed', reason: e?.message || 'unknown' };
        }
    }

    private async ensureClient(name: string): Promise<Client> {
        const existing = this.activeClients.get(name);
        if (existing) return existing;
        await this.tryReconnect(name);
        const re = this.activeClients.get(name);
        if (!re) throw new Error(`Client '${name}' not found and reconnect failed.`);
        return re;
    }

    private async tryReconnect(name: string) {
        const meta = this.clientMeta.get(name);
        if (!meta) throw new Error(`No connection metadata for '${name}'. Cannot reconnect.`);
        await this.connectStdio(name, meta.command, meta.args, meta.env, meta.retries, meta.timeoutMs);
    }

    // Egyszerű watchdog: adott kliens periodikus healthCheck-je és reconnect kísérlete
    public startWatchdog(name: string, intervalMs = 10000) {
        if (this.watchdogTimers.has(name)) return;
        const interval = this.defaultWatchdogMs ?? intervalMs;
        const timer = setInterval(async () => {
            const meta = this.clientMeta.get(name);
            if (!meta) return;
            const hc = await this.healthCheck(name);
            if (hc.status === 'failed') {
                console.warn(`Watchdog: reconnecting ${name} (${hc.reason})`);
                try {
                    await this.tryReconnect(name);
                } catch (e) {
                    console.error(`Watchdog reconnect failed for ${name}:`, (e as any)?.message ?? e);
                }
            }
        }, intervalMs);
        this.watchdogTimers.set(name, timer);
    }
}

export const mcpClientManager = new McpClientManager();

