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
import { agentManager } from "../agents/AgentManager.js";
import { z } from "zod";

export function registerAllTools(server: McpServer) {
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

    // Register Agent Tools
    server.tool(
        "agent_list",
        "Lists all available active agents.",
        {},
        async () => {
            const agents = agentManager.listAgentDefinitions();
            return {
                content: [{ type: "text", text: JSON.stringify(agents, null, 2) }]
            };
        }
    );

    server.tool(
        "agent_registry",
        "Lists all agent definitions from the registry (active + planned).",
        {},
        async () => {
            const agents = agentManager.listRegistryDefinitions();
            return {
                content: [{ type: "text", text: JSON.stringify(agents, null, 2) }]
            };
        }
    );

    server.tool(
        "agent_delegate",
        "Delegates a task to a specific agent.",
        {
            agent_name: z.string().describe("Name of the agent (e.g., 'researcher', 'developer')"),
            task: z.string().describe("The task description")
        },
        async ({ agent_name, task }) => {
            try {
                const result = await agentManager.delegate(agent_name, task);
                return {
                    content: [{ type: "text", text: result }]
                };
            } catch (e: any) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Agent Error: ${e.message}` }]
                };
            }
        }
    );

    server.tool(
        "ping",
        "A simple ping tool to verify the server is running.",
        {},
        async () => {
            return {
                content: [
                    {
                        type: "text",
                        text: "Pong! MCP Brunella Core is active.",
                    },
                ],
            };
        }
    );
}
