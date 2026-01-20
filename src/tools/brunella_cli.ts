import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spawn } from "child_process";
import path from 'path';

export function registerBrunellaCliTools(server: McpServer) {
  
  server.tool(
    "brunella_cli_exec",
    "Executes a Brunella CLI command (chat, codegen, dev_agent, sandbox).",
    {
      command: z.enum(["chat", "codegen", "dev_agent", "sandbox", "project_analyze"])
        .describe("The CLI command to run"),
      argument: z.string().describe("The main argument or task description for the command"),
      model: z.string().optional().describe("Override the default LLM model")
    },
    async ({ command, argument, model }) => {
      const cliPath = path.resolve(process.cwd(), 'myai', 'cli.py');
      const args = [cliPath, command, argument];
      
      if (model) {
          args.push("--model", model);
      }

      return new Promise((resolve) => {
        const proc = spawn("python", args, {
          cwd: path.resolve(process.cwd(), 'myai'),
          shell: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data);
        proc.stderr.on('data', (data) => stderr += data);

        proc.on('close', (code) => {
          resolve({
            content: [{
              type: "text",
              text: `Exit Code: ${code}\n\nOutput:\n${stdout}\n\nErrors:\n${stderr}`
            }]
          });
        });

        proc.on('error', (err) => {
           resolve({
            isError: true,
            content: [{ type: "text", text: `Failed to start Brunella CLI: ${err.message}` }]
           });
        });
      });
    }
  );
}
