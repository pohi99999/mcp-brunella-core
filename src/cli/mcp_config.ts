import fs from 'fs';
import path from 'path';

export interface McpServerConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export class McpConfigManager {
    private configPath: string;

    constructor() {
        this.configPath = path.resolve(__dirname, '..', '..', 'mcp_servers.json');
        this.ensureDefaultConfig();
    }

    private ensureDefaultConfig() {
        if (!fs.existsSync(this.configPath)) {
            const defaults: McpServerConfig[] = [
                {
                    name: 'github',
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-github'],
                    env: { GITHUB_PERSONAL_ACCESS_TOKEN: '' }
                },
                {
                    name: 'chrome',
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-chrome-devtools']
                },
                {
                    name: 'computer-use',
                    command: 'npx',
                    args: ['-y', '@modelcontextprotocol/server-computer-use']
                },
                {
                    name: 'docker',
                    command: 'docker',
                    args: ['run', '-i', '--rm', 'mcp/docker'] 
                    // Note: This is a placeholder command. Ideally, we use an official image or npx package if available.
                    // Checking conventions, often it's 'npx -y @modelcontextprotocol/server-docker' if node-based, 
                    // or python based. For now, assuming a hypothetical npx package for consistency, or we can use the 'docker' CLI directly via a wrapper.
                    // Let's use the 'npx' variant assuming availability, or fallback to a known working config later.
                    // Actually, let's use a more generic placeholder that requires configuration.
                },
                {
                    name: 'brunella-core',
                    command: 'node',
                    args: ['./build/index.js']
                }
            ];
            fs.writeFileSync(this.configPath, JSON.stringify(defaults, null, 2));
        }
    }

    public getServers(): McpServerConfig[] {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
    }
}
