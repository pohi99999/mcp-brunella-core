import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

export async function registerAllTools(server: McpServer) {
    // Dynamically import Node.js-specific modules only in Node environment
    const isNode = typeof process !== 'undefined' && process.versions?.node;

    if (isNode) {
        const path = await import('path');
        const { agentManager } = await import('../agents/AgentManager.js');
        const DataScientistAgent = (await import('../agents/DataScientistAgent.js')).default;
        const ResearcherAgent = (await import('../agents/ResearcherAgent.js')).default;
        const { OrchestratorAgent } = await import('../agents/OrchestratorAgent.js');
        const { EvaluatorAgent } = await import('../agents/EvaluatorAgent.js');
        const { DeveloperAgent } = await import('../agents/DeveloperAgent.js');
        const { DynamicAgent } = await import('../agents/DynamicAgent.js');

        // Initialize Static Agents
        agentManager.registerAgent(new DataScientistAgent());
        agentManager.registerAgent(new ResearcherAgent());
        agentManager.registerAgent(new OrchestratorAgent());
        agentManager.registerAgent(new EvaluatorAgent());
        agentManager.registerAgent(new DeveloperAgent());

        // Initialize Dynamic Agents
        try {
            const agentsDir = path.default.join(process.cwd(), 'myai/agents');
            agentManager.registerAgent(new DynamicAgent(path.default.join(agentsDir, 'project_organizer.toml')));
            agentManager.registerAgent(new DynamicAgent(path.default.join(agentsDir, 'agent_architect.toml')));
        } catch (e) {
            console.warn("Could not load dynamic agents:", e);
        }

        // Register Node-specific tools
        const { registerWorkspaceTools } = await import('../tools/workspace.js');
        const { registerKnowledgeTools } = await import('../tools/knowledge.js');
        const { registerSystemTools } = await import('../tools/system.js');
        const { registerBrowserTools } = await import('../tools/browser.js');
        const { registerInterpreterTools } = await import('../tools/interpreter.js');
        const { registerCopilotCliTool } = await import('../tools/copilotCliTool.js');
        const { registerJulesCliTool } = await import('../tools/julesCliTool.js');
        const { registerOllamaTool } = await import('../tools/ollamaTool.js');
        const { registerClaudeTool } = await import('../tools/claudeTool.js');
        const { registerPipelineTools } = await import('../pipeline/llmPipeline.js');
        const { registerGoogleWorkspaceTools } = await import('../tools/googleWorkspace.js');
        const { registerAnythingLLMTools } = await import('../tools/anythingllm.js');
        const { registerMonitorTools } = await import('../tools/monitor.js');
        const { registerSwarmTools } = await import('../tools/swarmTools.js');
        const { registerGithubModelsTool } = await import('../tools/githubModelsTool.js');
        const { registerGeminiTool } = await import('../tools/geminiTool.js');

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
        registerGithubModelsTool(server);
        registerGeminiTool(server);

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
    }

    // Always register ping tool (works in any environment)
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