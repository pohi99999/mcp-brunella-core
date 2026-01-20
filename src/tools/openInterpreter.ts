import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { spawn } from "child_process";
import path from 'path';

export function registerInterpreterTools(server: McpServer) {
  
  server.tool(
    "interpreter_open_query",
    "Sends a query to Open Interpreter for OS-level tasks and code execution.",
    {
      prompt: z.string().describe("The natural language prompt or command for the interpreter")
    },
    async ({ prompt }) => {
      // Fixed path based on environmental validation
      const interpreterPath = "F:\\OneDrive\\Desktop\\Brunella_es_en\\open-interpreter\\venv311\\Scripts\\interpreter.exe";
      
      // Using -y for non-interactive mode, --plain for cleaner output, and specifying Ollama to avoid interactive menu
      const args = [
        "-y", 
        "--plain", 
        "--stdin",
        "--model", "ollama/tinyllama", 
        "--api_base", "http://localhost:11434"
      ];

      return new Promise((resolve) => {
        const proc = spawn(interpreterPath, args, {
          cwd: process.cwd(),
          shell: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => stdout += data);
        proc.stderr.on('data', (data) => stderr += data);

        // Send the prompt via stdin
        proc.stdin.write(prompt + "\n");
        proc.stdin.end();

        proc.on('close', (code) => {
          resolve({
            content: [{
              type: "text",
              text: `Interpreter Exit Code: ${code}\n\nResponse:\n${stdout}\n\nErrors:\n${stderr}`
            }]
          });
        });

        proc.on('error', (err) => {
           resolve({
            isError: true,
            content: [{ type: "text", text: `Failed to start Open Interpreter: ${err.message}` }]
           });
        });
      });
    }
  );
}
