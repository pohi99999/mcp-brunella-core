import readline from 'readline';
import chalk from 'chalk';
import { McpCliClient } from './mcp_client.js';
import { renderMarkdown } from './markdown_renderer.js';

export async function startChatRepl(client: McpCliClient, agentName?: string) {
    console.log(chalk.green('Starting chat session... (Type "exit" or "quit" to leave)'));
    
    // Determine which tool to use
    let chatTool = 'chat';
    if (agentName) {
        console.log(chalk.blue(`Talking to agent: ${agentName}`));
    } else {
        // Auto-discover
        const toolsResponse = await client.listTools();
        const tools = toolsResponse.tools || [];
        const toolNames = tools.map((t: any) => t.name);
        
        if (toolNames.includes('chat')) {
            chatTool = 'chat';
        } else if (toolNames.includes('anythingllm_chat')) {
            chatTool = 'anythingllm_chat';
        } else {
            // Fallback or warning
            // Check for 'llm' or 'ask'
            const generic = toolNames.find((n: string) => n.includes('chat') || n.includes('ask') || n.includes('llm'));
            if (generic) {
                chatTool = generic;
                console.log(chalk.gray(`Using tool: ${chatTool}`));
            } else {
                console.log(chalk.yellow('Warning: No standard chat tool found. Defaulting to "chat".'));
            }
        }
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: chalk.cyan('You: ')
    });

    rl.prompt();

    rl.on('line', async (line) => {
        const input = line.trim();
        if (['exit', 'quit'].includes(input.toLowerCase())) {
            rl.close();
            return;
        }

        if (input) {
            try {
                // Show loading indicator
                process.stdout.write(chalk.gray('Thinking...'));
                
                // Call tool with multiple common parameter names to be safe
                const response = await client.callTool(chatTool, {
                    message: input,
                    prompt: input, 
                    query: input,
                    agent: agentName
                });

                // Clear loading
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);

                // Extract text from response
                let outputText = '';
                if (typeof response === 'string') {
                    outputText = response;
                } else if (response.content && Array.isArray(response.content)) {
                    outputText = response.content.map((c: any) => c.text).join('\n');
                } else if (response.text) {
                    outputText = response.text;
                } else if (response.message) {
                    outputText = response.message;
                } else if (response.result) {
                    outputText = String(response.result);
                } else {
                    outputText = JSON.stringify(response, null, 2);
                }

                console.log(chalk.magenta('Brunella:'));
                console.log(renderMarkdown(outputText));
                console.log(); // Empty line
            } catch (err: any) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                console.error(chalk.red(`Error: ${err.message}`));
            }
        }
        
        rl.prompt();
    }).on('close', () => {
        console.log(chalk.green('Goodbye!'));
        process.exit(0);
    });
}
