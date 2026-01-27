import inquirer from 'inquirer';
import chalk from 'chalk';
import { LLMClient, Message, Tool } from '../../core/llm_client.js';
import { mcpClientManager } from '../mcp_client.js';
import { toolRegistry, getNativeToolsForLLM } from '../tools/index.js';
import { MemoryManager } from '../memory.js';

const memory = new MemoryManager();

export async function chatCommand() {
    console.clear();
    console.log(chalk.cyan('💬 Brunella Chat - Gemini Enhanced'));
    console.log(chalk.gray('Type "/help" for commands, "/model" to change model.'));

    // Config initialization
    let currentModel: string = (memory.get('model') as string) || 'llava-llama3:latest';
    let baseUrl = memory.get('llm_base_url') || 'http://127.0.0.1:11434';

    console.log(chalk.blue(`🤖 Model: ${currentModel} | URL: ${baseUrl}`));

    let llm = new LLMClient({
        provider: 'ollama',
        model: currentModel,
        baseUrl: baseUrl
    });

    const messages: Message[] = [
        { role: 'system', content: 'You are Brunella, an advanced AI assistant powered by local LLMs and authentic MCP tools. You can execute tools to help the user. Be concise, professional, and helpful.' }
    ];

    while (true) {
        const { input } = await inquirer.prompt([{
            type: 'input',
            name: 'input',
            message: chalk.green('Brunella ❯')
        }]);

        if (!input || input.trim() === '') continue;
        const trimmedInput = input.trim();

        // Slash commands
        if (trimmedInput.startsWith('/')) {
            const [cmd, ...args] = trimmedInput.slice(1).split(' ');
            if (cmd === 'exit' || cmd === 'quit') {
                console.log(chalk.yellow('Viszlát!'));
                break;
            }
            if (cmd === 'clear') {
                console.clear();
                continue;
            }
            if (cmd === 'history') {
                console.log(JSON.stringify(messages, null, 2));
                continue;
            }
            if (cmd === 'model') {
                if (args.length > 0) {
                    currentModel = args[0];
                    memory.set('model', currentModel);
                    console.log(chalk.green(`Model set to: ${currentModel}`));
                    // Re-instantiate LLM client with new model
                    llm = new LLMClient({
                        provider: 'ollama',
                        model: currentModel,
                        baseUrl: baseUrl
                    });
                    messages.length = 0; // Clear existing messages
                    messages.push({ role: 'system', content: 'You are Brunella, an advanced AI assistant powered by local LLMs and authentic MCP tools. You can execute tools to help the user. Be concise, professional, and helpful.' });
                    console.log(chalk.gray('LLM client re-initialized. Chat history cleared.'));
                } else {
                    console.log(chalk.yellow(`Current model: ${currentModel}`));
                }
                continue;
            }
            if (cmd === 'url') {
                if (args.length > 0) {
                    // Update memory
                    memory.set('llm_base_url', args[0]);
                    console.log(chalk.green(`Base URL set to: ${args[0]}`));
                    // Update baseUrl variable
                    baseUrl = args[0];
                    // Re-instantiate LLM client with new base URL
                    llm = new LLMClient({
                        provider: 'ollama',
                        model: currentModel,
                        baseUrl: baseUrl
                    });
                    messages.length = 0; // Clear existing messages
                    messages.push({ role: 'system', content: 'You are Brunella, an advanced AI assistant powered by local LLMs and authentic MCP tools. You can execute tools to help the user. Be concise, professional, and helpful.' });
                    console.log(chalk.gray('LLM client re-initialized. Chat history cleared.'));
                } else {
                    console.log(chalk.yellow(`Current Base URL: ${baseUrl}`));
                }
                continue;
            }
            console.log(chalk.red('Unknown command.'));
            continue;
        }

        messages.push({ role: 'user', content: trimmedInput });

        // Tool gathering
        // 1. Native tools (CLI registry)
        const nativeTools = getNativeToolsForLLM();
        // 2. MCP tools
        const mcpTools = await mcpClientManager.getToolsForLLM();
        const tools: Tool[] = [...nativeTools, ...mcpTools];

        process.stdout.write(chalk.gray('Thinking...'));

        try {
            let currentResponse = "";

            // This loop handles the "Tool Call -> Execute -> Continue Generation" cycle
            // But strict streaming with tools in Ollama can be tricky.
            // Let's assumet single turn for now, or handle tool calls if returned.

            const response = await llm.chatStream(messages, tools, (chunk) => {
                // Clear "Thinking..." on first chunk
                if (currentResponse.length === 0) {
                    process.stdout.write('\r' + ' '.repeat(20) + '\r');
                }
                process.stdout.write(chunk);
                currentResponse += chunk;
            });

            // If we got tool calls
            if (response.tool_calls && response.tool_calls.length > 0) {
                console.log(chalk.yellow('\n🛠️  Calling tools...'));
                messages.push(response); // Add assistant's tool call message

                for (const call of response.tool_calls) {
                    const toolName = call.function.name;
                    const toolArgs = JSON.parse(call.function.arguments);

                    console.log(chalk.cyan(`  > ${toolName}(${JSON.stringify(toolArgs)})`));

                    let executionResult = "Tool not found or failed";

                    // 1) Try native registry first
                    const nativeTool = toolRegistry.getTool(toolName);
                    if (nativeTool) {
                        try {
                            const result = await nativeTool.execute(toolArgs);
                            executionResult = typeof result === 'string' ? result : JSON.stringify(result);
                        } catch (e: any) {
                            executionResult = `Native tool error: ${e.message}`;
                        }
                    } else {
                        // 2) MCP tools (prefer namespaced calls: mcp.<server>.<tool>)
                        const parsed = parseMcpToolName(toolName);
                        if (parsed) {
                            try {
                                const result = await mcpClientManager.callTool(parsed.serverName, parsed.toolName, toolArgs);
                                executionResult = JSON.stringify(result);
                            } catch (e: any) {
                                executionResult = `MCP tool error (${parsed.serverName}): ${e.message}`;
                            }
                        } else {
                            // Fallback to legacy un-namespaced MCP tool name
                            const clients = mcpClientManager.getClientNames();
                            for (const clientName of clients) {
                                try {
                                    const clientTools = await mcpClientManager.listTools(clientName);
                                    if (clientTools.tools.some(t => t.name === toolName)) {
                                        const result = await mcpClientManager.callTool(clientName, toolName, toolArgs);
                                        executionResult = JSON.stringify(result);
                                        break;
                                    }
                                } catch (e) { /* ignore */ }
                            }
                        }
                    }

                    console.log(chalk.gray(`  < Result: ${executionResult.substring(0, 50)}...`));

                    messages.push({
                        role: 'tool',
                        content: executionResult,
                        name: toolName
                    });
                }

                // Follow up call to LLM
                process.stdout.write(chalk.gray('Synthesizing...'));
                const followUp = await llm.chatStream(messages, tools, (chunk) => {
                    process.stdout.write(chunk);
                });
                messages.push(followUp);
                console.log(); // Newline
            } else {
                // Just a normal response
                messages.push(response);
                console.log(); // Newline
            }

        } catch (e: any) {
            console.error(chalk.red('\nError:'), e.message);
        }
    }
}

function parseMcpToolName(name: string) {
    if (!name.startsWith('mcp.')) return null;
    const parts = name.split('.');
    if (parts.length < 3) return null;
    const serverName = parts[1];
    const toolName = parts.slice(2).join('.');
    if (!serverName || !toolName) return null;
    return { serverName, toolName };
}
