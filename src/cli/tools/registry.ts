export interface Tool {
    name: string;
    description: string;
    execute: (args: any) => Promise<any>;
}

export class ToolRegistry {
    private tools: Map<string, Tool> = new Map();

    public registerTool(tool: Tool) {
        this.tools.set(tool.name, tool);
    }

    public getTool(name: string): Tool | undefined {
        return this.tools.get(name);
    }

    public listTools(): Tool[] {
        return Array.from(this.tools.values());
    }

    public async executeTool(name: string, args: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool not found: ${name}`);
        }
        return await tool.execute(args);
    }
}

export const toolRegistry = new ToolRegistry();
