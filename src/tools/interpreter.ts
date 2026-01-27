import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VM } from 'vm2';
import path from 'path';
import fs from 'fs/promises';
import { globalPythonShell } from "../utils/pythonShell.js";

const MAX_OUTPUT_SIZE = 1024 * 100; // 100KB limit
const TIMEOUT_MS = 5000; // 5s timeout

async function runNodeCode(code: string): Promise<{ content: { type: "text", text: string }[], isError?: boolean }> {
    return new Promise((resolve) => {
        try {
            let output = '';
            let outputSize = 0;

            const appendOutput = (text: string) => {
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
                        log: (...args: any[]) => {
                            appendOutput(args.map(a => String(a)).join(' ') + '\n');
                        },
                        error: (...args: any[]) => {
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
                    .catch((error: any) => {
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

        } catch (error: any) {
            resolve({
                isError: true,
                content: [{ type: "text", text: `Sandbox Error: ${error.message}` }]
            });
        }
    });
}

export function registerInterpreterTools(server: McpServer) {
    server.tool(
        "interpreter_run_python",
        "Runs Python code in a PERSISTENT shell (stateful). Variables are preserved between calls. 'myai' folder is automatically in sys.path.",
        {
            code: z.string().describe("Python code to execute"),
            reset: z.boolean().optional().describe("If true, restarts the shell before execution (clears state).")
        },
        async ({ code, reset }) => {
            try {
                if (reset) {
                    await globalPythonShell.restart();
                }

                // Ensure myai is in path
                const setupCode = "import sys, os; myai_path = os.path.join(os.getcwd(), 'myai'); " +
                                 "if myai_path not in sys.path: sys.path.append(myai_path)\n";
                
                const fullCode = setupCode + code;
                const output = await globalPythonShell.execute(fullCode);

                return {
                    content: [{
                        type: "text",
                        text: output.trim()
                    }]
                };
            } catch (e: any) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Python Error: ${e.message}` }]
                };
            }
        }
    );

    server.tool(
        "python_list_scripts",
        "Lists available Python scripts in the 'myai' directory.",
        {},
        async () => {
            try {
                const myaiPath = path.join(process.cwd(), "myai");
                const files = await fs.readdir(myaiPath);
                const scripts = files.filter(f => f.endsWith(".py") && f !== "__init__.py");
                
                return {
                    content: [{
                        type: "text",
                        text: scripts.length > 0 
                            ? `Available scripts in 'myai':\n${scripts.map(s => `- ${s}`).join("\n")}`
                            : "No Python scripts found in 'myai' folder."
                    }]
                };
            } catch (e: any) {
                return {
                    isError: true,
                    content: [{ type: "text", text: `Error listing scripts: ${e.message}` }]
                };
            }
        }
    );

    server.tool(
        "interpreter_run_node",
        "Runs Node.js code in a VM2 sandbox (no fs/net access).",
        {
            code: z.string().describe("JavaScript code to execute"),
        },
        async ({ code }) => {
            return await runNodeCode(code);
        }
    );
}
