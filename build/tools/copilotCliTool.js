"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCopilotCliTool = registerCopilotCliTool;
const zod_1 = require("zod");
const exec_js_1 = require("../utils/exec.js");
const index_js_1 = require("../config/index.js");
const WHITELISTED_COMMANDS = ['suggest', 'explain', 'test', 'fix'];
function registerCopilotCliTool(server) {
    server.tool("copilot_cli", "Executes GitHub Copilot CLI commands (suggest, explain, test, fix).", {
        subcommand: zod_1.z.enum(['suggest', 'explain', 'test', 'fix']).describe("The copilot subcommand to run"),
        query: zod_1.z.string().describe("The query or code snippet for Copilot"),
    }, async ({ subcommand, query }) => {
        if (!WHITELISTED_COMMANDS.includes(subcommand)) {
            return {
                isError: true,
                content: [{ type: "text", text: `Command not allowed: ${subcommand}` }]
            };
        }
        try {
            // Construct args. Note: Copilot CLI structure might vary based on installation (alias vs direct).
            // Assuming 'gh copilot <subcommand> "<query>"' or 'copilot <subcommand> "<query>"'
            // We'll assume 'copilot' is in PATH or an alias. If it's 'gh copilot', we'd need to adjust.
            // Let's try 'gh copilot' as it's the standard extension way, or fall back to 'copilot' if user set alias.
            // Safe bet: 'gh copilot <subcommand> -- <query>' to avoid arg parsing issues.
            const args = ['copilot', subcommand, '--', query];
            const result = await (0, exec_js_1.execCommand)('gh', args, {
                cwd: index_js_1.config.workspaceRoot,
                timeout: 60000 // Copilot might take a while
            });
            return {
                content: [{
                        type: "text",
                        text: `Exit Code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`
                    }]
            };
        }
        catch (error) {
            return {
                isError: true,
                content: [{ type: "text", text: `Execution error: ${error.message}` }]
            };
        }
    });
}
