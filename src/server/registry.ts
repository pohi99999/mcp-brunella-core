import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerWorkspaceTools } from "../tools/workspace.js";
import { registerKnowledgeTools } from "../tools/knowledge.js";
import { registerSystemTools } from "../tools/system.js";
import { registerBrowserTools } from "../tools/browser.js";
import { registerInterpreterTools } from "../tools/interpreter.js";
import { registerGithubModelsTool } from "../tools/githubModelsTool.js";
import { registerGeminiTool } from "../tools/geminiTool.js";
import { registerJulesCliTool } from "../tools/julesCliTool.js";
import { registerOllamaTool } from "../tools/ollamaTool.js";
import { registerClaudeTool } from "../tools/claudeTool.js";
import { registerPipelineTools } from "../pipeline/llmPipeline.js";
import { registerGoogleWorkspaceTools } from "../tools/googleWorkspace.js";
import { registerAnythingLLMTools } from "../tools/anythingllm.js";
import { registerMonitorTools } from "../tools/monitor.js";
import { registerSwarmTools } from "../tools/swarmTools.js";
import { registerN8nTools } from "../tools/n8n.js";
import { agentManager } from "../agents/AgentManager.js";
import DataScientistAgent from "../agents/DataScientistAgent.js";
import ResearcherAgent from "../agents/ResearcherAgent.js";
import { OrchestratorAgent } from "../agents/OrchestratorAgent.js";
import { EvaluatorAgent } from "../agents/EvaluatorAgent.js";
import { DeveloperAgent } from "../agents/DeveloperAgent.js";
import { DynamicAgent } from "../agents/DynamicAgent.js";
import { z } from "zod";
import path from "path";

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
    { id: 'agent_execute', name: 'agent_execute', description: 'Ágens közvetlen végrehajtása (szinkron)', enabled: true, category: 'server', parameters: [{ name: 'agentName', type: 'string', required: true }, { name: 'task', type: 'string', required: true }, { name: 'context', type: 'string', required: false }] },
];

// Internal tool handler map
const toolHandlers = new Map<string, (args: any) => Promise<any>>();

export function registerAllTools(server: McpServer) {
    // Initialize Static Agents
    agentManager.registerAgent(new DataScientistAgent());
    agentManager.registerAgent(new ResearcherAgent());
    agentManager.registerAgent(new OrchestratorAgent());
    agentManager.registerAgent(new EvaluatorAgent());
    agentManager.registerAgent(new DeveloperAgent());

    // Initialize Dynamic Agents
    try {
        const agentsDir = path.join(process.cwd(), 'myai/agents');
        agentManager.registerAgent(new DynamicAgent(path.join(agentsDir, 'project_organizer.toml')));
        agentManager.registerAgent(new DynamicAgent(path.join(agentsDir, 'agent_architect.toml')));
    } catch (e) {
        console.warn("Could not load dynamic agents:", e);
    }

    // Register External Tools
    registerWorkspaceTools(server);
    registerKnowledgeTools(server);
    registerSystemTools(server);
    registerBrowserTools(server);
    registerInterpreterTools(server);
    registerGithubModelsTool(server);
    registerGeminiTool(server);
    registerJulesCliTool(server);
    registerOllamaTool(server);
    registerClaudeTool(server);
    registerPipelineTools(server);
    registerGoogleWorkspaceTools(server);
    registerAnythingLLMTools(server);
    registerMonitorTools(server);
    registerSwarmTools(server);
    registerN8nTools(server);

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

    const agentExecuteHandler = async ({ agentName, task, context }: any) => {
        try {
            const agent = agentManager.getAgent(agentName);
            if (!agent) {
                return { isError: true, content: [{ type: "text" as const, text: `Agent '${agentName}' not found. Use agent_list to see available agents.` }] };
            }

            // Parse context if provided as JSON string
            let parsedContext;
            if (context) {
                try {
                    parsedContext = typeof context === 'string' ? JSON.parse(context) : context;
                } catch (e: any) {
                    return { isError: true, content: [{ type: "text" as const, text: `Invalid context JSON: ${e.message}` }] };
                }
            }

            // Execute agent directly
            const result = await agent.execute(task, parsedContext);

            // Format response
            const responseText = JSON.stringify(result, null, 2);
            return { content: [{ type: "text" as const, text: responseText }] };
        } catch (e: any) {
            return { isError: true, content: [{ type: "text" as const, text: `Agent Execution Error: ${e.message}` }] };
        }
    };
    server.tool("agent_execute", "Executes an agent directly with a task (synchronous).", {
        agentName: z.string(),
        task: z.string(),
        context: z.string().optional()
    }, agentExecuteHandler);
    toolHandlers.set("agent_execute", agentExecuteHandler);

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