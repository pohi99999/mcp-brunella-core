import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerWorkspaceTools } from "./tools/workspace.js";
import { registerKnowledgeTools } from "./tools/knowledge.js";
import { registerSystemTools } from "./tools/system.js";
import { registerBrowserTools } from "./tools/browser.js";
import { registerInterpreterTools } from "./tools/interpreter.js";
import { registerCopilotCliTool } from "./tools/copilotCliTool.js";
import { registerJulesCliTool } from "./tools/julesCliTool.js";
import { registerOllamaTool } from "./tools/ollamaTool.js";
import { registerClaudeTool } from "./tools/claudeTool.js";
import { registerPipelineTools } from "./pipeline/llmPipeline.js";
import { registerGoogleWorkspaceTools } from "./tools/googleWorkspace.js";
import { registerAnythingLLMTools } from "./tools/anythingllm.js";
import { registerMonitorTools } from "./tools/monitor.js";
import { registerBrunellaCliTools } from "./tools/brunella_cli.js";
import { startWebServer } from "./server/web.js";
import { agentManager } from "./agents/AgentManager.js";
import { z } from "zod";

// Create server instance
const server = new McpServer({
  name: "mcp-brunella-core",
  version: "1.0.0",
});

// Register Tools
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
registerBrunellaCliTools(server);

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
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            return {
                isError: true,
                content: [{ type: "text", text: `Agent Error: ${errorMessage}` }]
            };
        }
    }
);

server.tool(
    "agent_update",
    "Updates an agent definition and saves it to the registry.",
    {
        name: z.string().describe("Name of the agent to update"),
        updates: z.object({
            description: z.string().optional(),
            capabilities: z.array(z.string()).optional(),
            status: z.enum(["active", "planned", "deprecated"]).optional()
        }).describe("Fields to update")
    },
    async ({ name, updates }) => {
        try {
            const agent = agentManager.updateAgent(name, updates);
            return {
                content: [{ type: "text", text: JSON.stringify(agent, null, 2) }]
            };
        } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            return {
                isError: true,
                content: [{ type: "text", text: `Update Error: ${errorMessage}` }]
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

async function main() {
  // Start Web Interface
  startWebServer(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Brunella Core Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
