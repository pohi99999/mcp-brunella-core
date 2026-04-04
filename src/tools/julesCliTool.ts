import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import path from "path";
import { execCommand } from "../utils/exec.js";
import { config } from "../config/index.js";
import { mcpCatch, mcpText } from "../utils/mcpResponse.js";

const WHITELISTED_COMMANDS = ['run', 'ask', 'task', 'agent'];

export function registerJulesCliTool(server: McpServer) {
    server.tool(
        "jules_cli",
        "Executes Google Jules CLI commands (run, ask, task, agent).",
        {
            subcommand: z.enum(['run', 'ask', 'task', 'agent']).describe("The jules subcommand to run"),
            args: z.string().describe("Arguments for the command (e.g. prompt or task description)"),
        },
        async ({ subcommand, args }) => {
            if (!WHITELISTED_COMMANDS.includes(subcommand)) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Command not allowed: ${subcommand}` }]
                };
            }

            try {
                // Jules usually runs in the context of a repo.
                // We'll enforce the workspace root.
                
                // Safety: split args string carefully or pass as single arg if possible.
                // CLI tools often take a single string for prompt.
                // We'll pass it as is, relying on execCommand's shell handling but sanitized by usage intent.
                
                const julesPath = path.join(config.workspaceRoot, '08_SCRIPTS', 'npm-global', 'jules.cmd');
                const cmdArgs = [subcommand, args];

                const result = await execCommand(julesPath, cmdArgs, {
                    cwd: config.workspaceRoot,
                    timeout: 120000 // Jules agents might take longer
                });

                return mcpText(`Exit Code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`);

            } catch (error: unknown) {
                return mcpCatch(error, "jules_cli");
            }
        }
    );
}
