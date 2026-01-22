"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerInterpreterTools = registerInterpreterTools;
const zod_1 = require("zod");
const vm2_1 = require("vm2");
const pythonShell_js_1 = require("../utils/pythonShell.js");
const MAX_OUTPUT_SIZE = 1024 * 100; // 100KB limit
const TIMEOUT_MS = 5000; // 5s timeout
async function runNodeCode(code) {
    return new Promise((resolve) => {
        try {
            let output = '';
            let outputSize = 0;
            const appendOutput = (text) => {
                outputSize += Buffer.byteLength(text, 'utf8');
                if (outputSize > MAX_OUTPUT_SIZE) {
                    throw new Error(`Execution terminated: Output exceeded limit (${MAX_OUTPUT_SIZE} bytes).`);
                }
                output += text;
            };
            const vm = new vm2_1.VM({
                timeout: TIMEOUT_MS,
                sandbox: {
                    console: {
                        log: (...args) => {
                            appendOutput(args.map(a => String(a)).join(' ') + '\n');
                        },
                        error: (...args) => {
                            appendOutput('[ERROR] ' + args.map(a => String(a)).join(' ') + '\n');
                        }
                    }
                }
            });
            const result = vm.run(code);
            if (result instanceof Promise) {
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error(`Execution timed out (${TIMEOUT_MS}ms).`)), TIMEOUT_MS);
                });
                Promise.race([result, timeoutPromise])
                    .then((resolved) => {
                    resolve({
                        content: [{
                                type: "text",
                                text: `Output:\n${output}\n\nReturn Value:\n${String(resolved)}`
                            }]
                    });
                })
                    .catch((error) => {
                    resolve({
                        isError: true,
                        content: [{ type: "text", text: `Sandbox Error: ${error?.message || String(error)}` }]
                    });
                });
                return;
            }
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
    server.tool("interpreter_run_python", "Runs Python code in a PERSISTENT shell (stateful). Variables are preserved between calls.", {
        code: zod_1.z.string().describe("Python code to execute"),
        reset: zod_1.z.boolean().optional().describe("If true, restarts the shell before execution (clears state).")
    }, async ({ code, reset }) => {
        try {
            if (reset) {
                await pythonShell_js_1.globalPythonShell.restart();
            }
            const output = await pythonShell_js_1.globalPythonShell.execute(code);
            // Cleanup output: remove user prompt artifacts if any
            // The shell might return '>>>' or similar depending on how clean we got the buffer
            // Our separator logic handles most, but let's trim just in case.
            return {
                content: [{
                        type: "text",
                        text: output.trim()
                    }]
            };
        }
        catch (e) {
            return {
                isError: true,
                content: [{ type: "text", text: `Python Error: ${e.message}` }]
            };
        }
    });
    server.tool("interpreter_run_node", "Runs Node.js code in a VM2 sandbox (no fs/net access).", {
        code: zod_1.z.string().describe("JavaScript code to execute"),
    }, async ({ code }) => {
        return await runNodeCode(code);
    });
}
