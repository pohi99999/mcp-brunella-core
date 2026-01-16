"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerJulesCliTool = registerJulesCliTool;
const zod_1 = require("zod");
const exec_js_1 = require("../utils/exec.js");
const index_js_1 = require("../config/index.js");
const WHITELISTED_COMMANDS = ['run', 'ask', 'task', 'agent'];
function registerJulesCliTool(server) {
    server.tool("jules_cli", "Executes Google Jules CLI commands (run, ask, task, agent).", {
        subcommand: zod_1.z.enum(['run', 'ask', 'task', 'agent']).describe("The jules subcommand to run"),
        args: zod_1.z.string().describe("Arguments for the command (e.g. prompt or task description)"),
    }, async ({ subcommand, args }) => {
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
            const cmdArgs = [subcommand, args];
            const result = await (0, exec_js_1.execCommand)('jules', cmdArgs, {
                cwd: index_js_1.config.workspaceRoot,
                timeout: 120000 // Jules agents might take longer
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
