import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from '../config/index.js';

// Dynamic imports for Node.js modules
let fs: typeof import('fs/promises') | null = null;
let path: typeof import('path') | null = null;
let child_process: typeof import('child_process') | null = null;

async function ensureModules() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        if (!fs) fs = (await import('fs/promises')).default || await import('fs/promises');
        if (!path) path = (await import('path')).default || await import('path');
        if (!child_process) child_process = (await import('child_process')).default || await import('child_process');
    }
}

const ALLOWED_COMMANDS = [
    'dir', 'ls', 
    'type', 'cat', 
    'python', 'node',
    'echo'
];

// Special check for version flags as requested
const ALLOWED_ARGS_PATTERNS = [
    /^--version$/, /^-v$/
];

async function logCommand(command: string, cwd: string, user: string = 'unknown') {
    if (!fs || !path) return;
    const logEntry = `[${new Date().toISOString()}] User: ${user} | CWD: ${cwd} | Command: ${command}\n`;
    try {
        await fs.appendFile(path.join(config.systemLogDir, 'system_commands.log'), logEntry);
    } catch (e) {
        console.error("Failed to write log:", e);
    }
}

export async function registerSystemTools(server: McpServer) {
  await ensureModules();

  server.tool(
    "system_run_command",
    "Runs a restricted system command (dir, ls, type, cat, python --version, node --version).",
    {
      command: z.string().describe("The command to run"),
      cwd: z.string().optional().describe("Working directory"),
    },
    async ({ command, cwd }) => {
      if (!child_process || !path) return { isError: true, content: [{ type: "text", text: "Tool not supported in this environment" }] };

      const args = command.split(' ');
      const executable = args[0];
      const cmdArgs = args.slice(1);

      // Validate Executable
      if (!ALLOWED_COMMANDS.includes(executable)) {
        throw new Error(`Command not allowed: ${executable}`);
      }

      // Validate Specific Commands Arguments
      if (executable === 'python' || executable === 'node') {
          const isVersionCheck = cmdArgs.some(arg => ALLOWED_ARGS_PATTERNS.some(p => p.test(arg)));
          if (!isVersionCheck && cmdArgs.length > 0) {
               throw new Error(`Interpreter commands in system_tool are restricted to version checks (e.g. --version). Use interpreter_tool for code execution.`);
          }
      }

      // Check CWD security
      const workingDir = cwd ? path.resolve(config.workspaceRoot, cwd) : config.workspaceRoot;
      if (!workingDir.startsWith(config.workspaceRoot)) {
         throw new Error(`Access denied: CWD must be within ${config.workspaceRoot}`);
      }

      await logCommand(command, workingDir);

      return new Promise((resolve) => {
        const proc = child_process!.spawn(executable, cmdArgs, {
          cwd: workingDir,
          shell: true
        });

        let stdout = '';
        let stderr = '';

        proc.stdout?.on('data', (data: any) => stdout += data);
        proc.stderr?.on('data', (data: any) => stderr += data);

        proc.on('close', (code: any) => {
          resolve({
            content: [{
              type: "text",
              text: `Exit Code: ${code}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
            }]
          });
        });

        proc.on('error', (err: any) => {
           resolve({
            isError: true,
            content: [{ type: "text", text: `Execution error: ${err.message}` }]
           });
        });
      });
    }
  );
}
