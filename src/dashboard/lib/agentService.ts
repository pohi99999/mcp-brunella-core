import { mcpClient } from './mcpClient';

export interface AgentDefinition {
    name: string;
    role: string;
    description: string;
    capabilities: string[];
    systemPrompt?: string;
    model?: string;
    temperature?: number;
}

export class AgentService {
    async listAgents(): Promise<AgentDefinition[]> {
        try {
            const result = await mcpClient.callTool('agent_list', {});
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return JSON.parse(result.content[0].text);
            }
            return [];
        } catch (e) {
            console.error("Failed to list agents:", e);
            throw e;
        }
    }

    async getRegistry(): Promise<AgentDefinition[]> {
        try {
            const result = await mcpClient.callTool('agent_registry', {});
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return JSON.parse(result.content[0].text);
            }
            return [];
        } catch (e) {
            console.error("Failed to get agent registry:", e);
            throw e;
        }
    }

    async updateAgent(name: string, updates: Partial<AgentDefinition>): Promise<AgentDefinition> {
        try {
            const result = await mcpClient.callTool('agent_update', { name, updates });
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return JSON.parse(result.content[0].text);
            }
            throw new Error("Invalid response from agent_update");
        } catch (e) {
            console.error("Failed to update agent:", e);
            throw e;
        }
    }

    async delegateTask(agentName: string, task: string): Promise<string> {
        try {
            const result = await mcpClient.callTool('agent_delegate', { agent_name: agentName, task });
            if (result.content && result.content[0] && result.content[0].type === 'text') {
                 return result.content[0].text;
            }
            return "No response content";
        } catch (e) {
            console.error("Failed to delegate task:", e);
            throw e;
        }
    }
}

export const agentService = new AgentService();