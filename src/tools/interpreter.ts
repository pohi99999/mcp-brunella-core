import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { globalPythonShell } from "../utils/pythonShell.js";

export function registerInterpreterTools(server: McpServer) {
  server.tool(
    "interpreter_run_python",
    "Executes Python code in a persistent shell.",
    {
      code: z.string().describe("The Python code to execute"),
      reset: z.boolean().optional().describe("Reset the environment before execution"),
    },
    async ({ code, reset }) => {
      if (reset) {
        return { content: [{ type: "text", text: "Environment reset (simulated)." }] };
      }

      try {
        const output = await globalPythonShell.run(code);
        return {
          content: [{ type: "text", text: output }]
        };
      } catch (e: any) {
        return {
          isError: true,
          content: [{ type: "text", text: `Execution error: ${e.message}` }]
        };
      }
    }
  );
}