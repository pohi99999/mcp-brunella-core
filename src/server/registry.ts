import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkspaceTools } from "../tools/workspace.js";
import { registerKnowledgeTools } from "../tools/knowledge.js";
import { registerSystemTools } from "../tools/system.js";
import { registerBrowserTools } from "../tools/browser.js";
import { registerInterpreterTools } from "../tools/interpreter.js";
import { registerCopilotCliTool } from "../tools/copilotCliTool.js";
import { registerJulesCliTool } from "../tools/julesCliTool.js";
import { registerOllamaTool } from "../tools/ollamaTool.js";
import { registerClaudeTool } from "../tools/claudeTool.js";
import { registerPipelineTools } from "../pipeline/llmPipeline.js";
import { registerGoogleWorkspaceTools } from "../tools/googleWorkspace.js";
import { registerAnythingLLMTools } from "../tools/anythingllm.js";
import { registerMonitorTools } from "../tools/monitor.js";
import { registerSwarmTools } from "../tools/swarmTools.js";
import { agentManager } from "../agents/AgentManager.js";
import { DataScientistAgent } from "../agents/DataScientistAgent.js";
import { ResearcherAgent } from "../agents/ResearcherAgent.js";
import { OrchestratorAgent } from "../agents/OrchestratorAgent.js";
import { EvaluatorAgent } from "../agents/EvaluatorAgent.js";
import { z } from "zod";

// Tool list for dashboard display
export interface RegisteredToolInfo {
    id: string;
    name: string;
    description: string;
    enabled: boolean;
    category: 'server' | 'monitoring' | 'configuration' | 'custom';
    parameters: { name: string; type: string; required: boolean }[];
}

const registeredToolsList: RegisteredToolInfo[] = [
    { id: 'ping', name: 'ping', description: 'Ellenőrzi a szerver elérhetőségét', enabled: true, category: 'server', parameters: [] },
    { id: 'agent_list', name: 'agent_list', description: 'Aktív ágensek listázása', enabled: true, category: 'server', parameters: [] },
    { id: 'agent_registry', name: 'agent_registry', description: 'Összes ágens definíció listázása', enabled: true, category: 'server', parameters: [] },
    { id: 'agent_delegate', name: 'agent_delegate', description: 'Feladat delegálása ágensnek', enabled: true, category: 'server', parameters: [{ name: 'agent_name', type: 'string', required: true }, { name: 'task', type: 'string', required: true }] },
];

// Internal tool handler map
const toolHandlers = new Map<string, (args: any) => Promise<any>>();

export function registerAllTools(server: McpServer) {
    // Initialize Agents
    agentManager.registerAgent(new DataScientistAgent());
    agentManager.registerAgent(new ResearcherAgent());
    agentManager.registerAgent(new OrchestratorAgent());
    agentManager.registerAgent(new EvaluatorAgent());

    // Register External Tools
    registerWorkspaceTools(server);
    registerKnowledgeTools(server);
    registerSystemTools(server);
    registerBrowserTools(server);
    registerInterpreterTools(server);
    registerCopilotCliTool(server);
    registerJulesCliTool(server);
    registerOllamaTool(server);
    registerClaudeTool(server);
    registerPipelineTools(server);
    registerGoogleWorkspaceTools(server);
    registerAnythingLLMTools(server);
    registerMonitorTools(server);
    registerSwarmTools(server);

    // Register Agent Tools with double-registration (server + internal map)
    const agentListHandler = async () => {
        const agents = agentManager.listAgentDefinitions();
        return { content: [{ type: "text" as const, text: JSON.stringify(agents, null, 2) }] };
    };
    server.tool("agent_list", "Lists all available active agents.", {}, agentListHandler);
    toolHandlers.set("agent_list", agentListHandler);

    const agentRegistryHandler = async () => {
        const agents = agentManager.listRegistryDefinitions();
        return { content: [{ type: "text" as const, text: JSON.stringify(agents, null, 2) }] };
    };
    server.tool("agent_registry", "Lists all agent definitions.", {}, agentRegistryHandler);
    toolHandlers.set("agent_registry", agentRegistryHandler);

    const agentDelegateHandler = async ({ agent_name, task }: any) => {
        try {
            const result = await agentManager.delegate(agent_name, task);
            return { content: [{ type: "text" as const, text: result }] };
        } catch (e: any) {
            return { isError: true, content: [{ type: "text" as const, text: `Agent Error: ${e.message}` }] };
        }
    };
    server.tool("agent_delegate", "Delegates a task to an agent.", {
        agent_name: z.string(),
        task: z.string()
    }, agentDelegateHandler);
    toolHandlers.set("agent_delegate", agentDelegateHandler);

    const pingHandler = async () => ({
        content: [{ type: "text" as const, text: "Pong! MCP Brunella Core is active." }]
    });
    server.tool("ping", "A simple ping tool.", {}, pingHandler);
    toolHandlers.set("ping", pingHandler);
}

export async function executeLocalTool(name: string, args: any) {
    const handler = toolHandlers.get(name);
    if (handler) {
        return await handler(args);
    }
    throw new Error(`Tool ${name} not found or not executable directly.`);
}

export function getRegisteredToolsList(): RegisteredToolInfo[] {
    return registeredToolsList;
}