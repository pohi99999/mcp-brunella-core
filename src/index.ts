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
import { registerAnythingLLMTool } from "./tools/anythingLLMTool.js";
import { startWebServer } from "./server/web.js";

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
registerAnythingLLMTool(server);

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
  startWebServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Brunella Core Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});