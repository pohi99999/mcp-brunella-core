import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { agentManager } from "../agents/AgentManager.js";
import { DataScientistAgent } from "../agents/DataScientistAgent.js";
import { ResearcherAgent } from "../agents/ResearcherAgent.js";
import { OrchestratorAgent } from "../agents/OrchestratorAgent.js";
import { EvaluatorAgent } from "../agents/EvaluatorAgent.js";
import { DeveloperAgent } from "../agents/DeveloperAgent.js";
import { DynamicAgent } from "../agents/DynamicAgent.js";
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
    // Initialize Static Agents
    agentManager.registerAgent(new DataScientistAgent());
    agentManager.registerAgent(new ResearcherAgent());
    agentManager.registerAgent(new OrchestratorAgent());
    agentManager.registerAgent(new EvaluatorAgent());
    agentManager.registerAgent(new DeveloperAgent());

    const isNode = typeof process !== 'undefined' && process.release?.name === 'node';

    // Initialize Dynamic Agents (Node-only)
    if (isNode) {
        try {
            const path = await import("path");
            const agentsDir = path.join(process.cwd(), 'myai/agents');
            agentManager.registerAgent(new DynamicAgent(path.join(agentsDir, 'project_organizer.toml')));
            agentManager.registerAgent(new DynamicAgent(path.join(agentsDir, 'agent_architect.toml')));
        } catch (e) {
            console.warn("Could not load dynamic agents (Worker env or missing files):", e);
        }
    }

    // Helper for dynamic registration
    const register = async (modulePath: string, methodName: string) => {
        try {
            const module = await import(modulePath);
            if (module[methodName]) {
                await module[methodName](server);
            }
        } catch (e) {
            console.warn(`Failed to register tools from ${modulePath}:`, e);
        }
    };

    // Register External Tools
    // Node-heavy tools are registered only in Node environment
    if (isNode) {
        await register("../tools/workspace.js", "registerWorkspaceTools");
        await register("../tools/knowledge.js", "registerKnowledgeTools");
        await register("../tools/system.js", "registerSystemTools");
        await register("../tools/browser.js", "registerBrowserTools");
        await register("../tools/interpreter.js", "registerInterpreterTools");
        await register("../tools/copilotCliTool.js", "registerCopilotCliTool");
        await register("../tools/julesCliTool.js", "registerJulesCliTool");
        await register("../tools/monitor.js", "registerMonitorTools");
        await register("../tools/swarmTools.js", "registerSwarmTools");
    }

    // Universal Tools (Fetch-based or safe)
    await register("../tools/ollamaTool.js", "registerOllamaTool");
    await register("../tools/claudeTool.js", "registerClaudeTool");
    await register("../tools/anythingllm.js", "registerAnythingLLMTools");
    await register("../tools/googleWorkspace.js", "registerGoogleWorkspaceTools");
    await register("../pipeline/llmPipeline.js", "registerPipelineTools");

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