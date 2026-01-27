import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

export interface ToolEntry {
    name: string;
    description: string;
    schema: z.ZodType<any>;
    handler: (args: any) => Promise<any>;
}

export class ToolManager {
    private tools = new Map<string, ToolEntry>();

    // Mocking McpServer.tool signature
    tool(name: string, description: string, schema: any, handler: (args: any) => Promise<any>) {
        let zodSchema: z.ZodType<any>;
        
        // MCP SDK passes a shape object (e.g. { arg: z.string() }) which needs to be wrapped in z.object()
        // OR sometimes it might pass a full Zod schema.
        if (schema instanceof z.ZodType) {
             zodSchema = schema;
        } else {
             zodSchema = z.object(schema);
        }

        this.tools.set(name, {
            name,
            description,
            schema: zodSchema,
            handler
        });
    }

    getToolDefinitions() {
        return Array.from(this.tools.values()).map(t => ({
            name: t.name,
            description: t.description,
            inputSchema: zodToJsonSchema(t.schema)
        }));
    }

    async executeTool(name: string, args: any) {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }
        
        // Validate args using Zod
        try {
            const parsedArgs = tool.schema.parse(args);
            return await tool.handler(parsedArgs);
        } catch (e: any) {
            throw new Error(`Invalid arguments for tool '${name}': ${e.message}`);
        }
    }
}

export const toolManager = new ToolManager();
