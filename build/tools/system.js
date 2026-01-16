"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSystemTools = registerSystemTools;
const zod_1 = require("zod");
const child_process_1 = require("child_process");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const index_js_1 = require("../config/index.js");
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
async function logCommand(command, cwd, user = 'unknown') {
    const logEntry = `[${new Date().toISOString()}] User: ${user} | CWD: ${cwd} | Command: ${command}\n`;
    try {
        await promises_1.default.appendFile(path_1.default.join(index_js_1.config.systemLogDir, 'system_commands.log'), logEntry);
    }
    catch (e) {
        console.error("Failed to write log:", e);
    }
}
function registerSystemTools(server) {
    server.tool("system_run_command", "Runs a restricted system command (dir, ls, type, cat, python --version, node --version).", {
        command: zod_1.z.string().describe("The command to run"),
        cwd: zod_1.z.string().optional().describe("Working directory"),
    }, async ({ command, cwd }) => {
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
                // Allow empty args (repl) or version check only for these interpreters in system tool
                // But wait, the prompt says "python --version" OR "node --version".
                // It implies general execution might be restricted here, 
                // but the interpreter tool is for code execution.
                // Let's be strict: only allow version checks for python/node here.
                throw new Error(`Interpreter commands in system_tool are restricted to version checks (e.g. --version). Use interpreter_tool for code execution.`);
            }
        }
        // Check CWD security
        const workingDir = cwd ? path_1.default.resolve(index_js_1.config.workspaceRoot, cwd) : index_js_1.config.workspaceRoot;
        if (!workingDir.startsWith(index_js_1.config.workspaceRoot)) {
            throw new Error(`Access denied: CWD must be within ${index_js_1.config.workspaceRoot}`);
        }
        await logCommand(command, workingDir);
        return new Promise((resolve) => {
            const proc = (0, child_process_1.spawn)(executable, cmdArgs, {
                cwd: workingDir,
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
                            text: `Exit Code: ${code}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
                        }]
                });
            });
            proc.on('error', (err) => {
                resolve({
                    isError: true,
                    content: [{ type: "text", text: `Execution error: ${err.message}` }]
                });
            });
        });
    });
}
