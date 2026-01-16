"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInterpreterTools = registerInterpreterTools;
const zod_1 = require("zod");
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const os_1 = __importDefault(require("os"));
const vm2_1 = require("vm2");
const MAX_OUTPUT_SIZE = 1024 * 100; // 100KB limit
const TIMEOUT_MS = 5000; // 5s timeout
async function runPythonCode(code) {
    const tmpDir = os_1.default.tmpdir();
    const filePath = path_1.default.join(tmpDir, `mcp_py_${Date.now()}.py`);
    await promises_1.default.writeFile(filePath, code);
    return new Promise((resolve) => {
        // Python sandbox: Clean env, limited time
        const proc = (0, child_process_1.spawn)('python', [filePath], {
            env: {
                // Only pass minimal env vars needed for python to run, hide system secrets
                PATH: process.env.PATH,
                SYSTEMROOT: process.env.SYSTEMROOT,
                TEMP: process.env.TEMP
            },
            cwd: tmpDir
        });
        let stdout = '';
        let stderr = '';
        let outputSize = 0;
        const dataHandler = (type) => (data) => {
            outputSize += data.length;
            if (outputSize > MAX_OUTPUT_SIZE) {
                proc.kill();
                resolve({
                    isError: true,
                    content: [{ type: "text", text: `Execution terminated: Output exceeded limit (${MAX_OUTPUT_SIZE} bytes).` }]
                });
                return;
            }
            if (type === 'stdout')
                stdout += data.toString();
            else
                stderr += data.toString();
        };
        proc.stdout.on('data', dataHandler('stdout'));
        proc.stderr.on('data', dataHandler('stderr'));
        const timeout = setTimeout(() => {
            proc.kill();
            resolve({
                isError: true,
                content: [{ type: "text", text: `Execution timed out (${TIMEOUT_MS}ms).` }]
            });
        }, TIMEOUT_MS);
        proc.on('close', (code) => {
            clearTimeout(timeout);
            promises_1.default.unlink(filePath).catch(() => { });
            resolve({
                content: [{
                        type: "text",
                        text: `Exit Code: ${code}\n\nSTDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`
                    }]
            });
        });
    });
}
async function runNodeCode(code) {
    return new Promise((resolve) => {
        try {
            const vm = new vm2_1.VM({
                timeout: TIMEOUT_MS,
                sandbox: {
                    console: {
                        log: (...args) => {
                            output += args.map(a => String(a)).join(' ') + '\n';
                        },
                        error: (...args) => {
                            output += '[ERROR] ' + args.map(a => String(a)).join(' ') + '\n';
                        }
                    }
                }
            });
            let output = '';
            // Capture output logic is manual in vm2, 
            // usually we redirect console.log in sandbox.
            const result = vm.run(code);
            resolve({
                content: [{
                        type: "text",
                        text: `Output:\n${output}\n\nReturn Value:\n${String(result)}`
                    }]
            });
        }
        catch (error) {
            resolve({
                isError: true,
                content: [{ type: "text", text: `Sandbox Error: ${error.message}` }]
            });
        }
    });
}
function registerInterpreterTools(server) {
    server.tool("interpreter_run_python", "Runs Python code in a restricted process (clean env, timeout).", {
        code: zod_1.z.string().describe("Python code to execute"),
    }, async ({ code }) => {
        return await runPythonCode(code);
    });
    server.tool("interpreter_run_node", "Runs Node.js code in a VM2 sandbox (no fs/net access).", {
        code: zod_1.z.string().describe("JavaScript code to execute"),
    }, async ({ code }) => {
        return await runNodeCode(code);
    });
}
