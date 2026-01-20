import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import { spawn } from "child_process";
import os from 'os';
import { VM } from 'vm2';
const MAX_OUTPUT_SIZE = 1024 * 100; // 100KB limit
const TIMEOUT_MS = 5000; // 5s timeout
async function runPythonCode(code) {
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, `mcp_py_${Date.now()}.py`);
    await fs.writeFile(filePath, code);
    return new Promise((resolve) => {
        // Python sandbox: Clean env, limited time
        const proc = spawn('python', [filePath], {
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
            fs.unlink(filePath).catch(() => { });
            resolve({
                isError: true,
                content: [{ type: "text", text: `Execution timed out (${TIMEOUT_MS}ms).` }]
            });
        }, TIMEOUT_MS);
        proc.on('close', (code) => {
            clearTimeout(timeout);
            fs.unlink(filePath).catch(() => { });
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
            let output = '';
            let outputSize = 0;
            const appendOutput = (text) => {
                outputSize += Buffer.byteLength(text, 'utf8');
                if (outputSize > MAX_OUTPUT_SIZE) {
                    throw new Error(`Execution terminated: Output exceeded limit (${MAX_OUTPUT_SIZE} bytes).`);
                }
                output += text;
            };
            const vm = new VM({
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
            // Capture output logic is manual in vm2, 
            // usually we redirect console.log in sandbox.
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
export function registerInterpreterTools(server) {
    server.tool("interpreter_run_python", "Runs Python code in a restricted process (clean env, timeout).", {
        code: z.string().describe("Python code to execute"),
    }, async ({ code }) => {
        return await runPythonCode(code);
    });
    server.tool("interpreter_run_node", "Runs Node.js code in a VM2 sandbox (no fs/net access).", {
        code: z.string().describe("JavaScript code to execute"),
    }, async ({ code }) => {
        return await runNodeCode(code);
    });
}
