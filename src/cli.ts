#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { loadConfig, saveConfig } from './utils/cli_config.js';
import { McpCliClient, connectToServer } from './utils/mcp_client.js';
import { formatToolsTable, formatToolsJson } from './utils/cli_formatter.js';
import { startChatRepl } from './utils/repl.js';

const program = new Command();

program
  .name('brunella')
  .description('Brunella Core CLI - MCP Powered Assistant')
  .version('1.0.0');

program
  .command('ping')
  .description('Ping the CLI to verify it is working')
  .action(() => {
    console.log(chalk.green('Pong! Brunella CLI is ready.'));
  });

program
  .command('config')
  .description('Manage CLI configuration')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .action((options) => {
    const config = loadConfig();
    
    if (options.set) {
      const [key, value] = options.set.split('=');
      if (key && value) {
        config[key] = value;
        saveConfig(config);
        console.log(chalk.green(`Configuration updated: ${key}=${value}`));
      } else {
        console.log(chalk.red('Invalid format. Use key=value'));
      }
      return;
    }

    console.log(chalk.blue.bold('Brunella CLI Configuration:'));
    Object.entries(config).forEach(([key, value]) => {
      console.log(`${chalk.yellow(key)}: ${value}`);
    });
  });

program
  .command('status')
  .description('Check server and connection status')
  .action(async () => {
    const config = loadConfig();
    try {
        const socket = await connectToServer(config);
        console.log(chalk.green('Status: ONLINE'));
        socket.disconnect();
    } catch (err: any) {
        console.log(chalk.red(`Status: OFFLINE (${err.message})`));
        console.log(chalk.yellow('Próbálom elindítani a szervert (még nincs implementálva)...'));
    }
  });

program
  .command('tools')
  .description('List available MCP tools')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const config = loadConfig();
    try {
        const socket = await connectToServer(config);
        const client = new McpCliClient(socket);
        await client.initialize();
        
        const response = await client.listTools();
        const tools = response.tools || [];
        
        if (options.json) {
            console.log(formatToolsJson(tools));
        } else {
            console.log(formatToolsTable(tools));
        }
        
        socket.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error(chalk.red(`Error listing tools: ${err.message}`));
        process.exit(1);
    }
  });

program
  .command('run <tool> [args...]')
  .description('Run a specific MCP tool')
  .option('-j, --json <json_args>', 'Pass arguments as JSON string')
  .action(async (toolName, args, options) => {
    const config = loadConfig();
    try {
        let toolArgs: any = {};
        
        if (options.json) {
            try {
                toolArgs = JSON.parse(options.json);
            } catch (e) {
                console.error(chalk.red('Invalid JSON arguments'));
                process.exit(1);
            }
        } else if (args && args.length > 0) {
             args.forEach((arg: string) => {
                const parts = arg.split('=');
                const key = parts[0];
                const value = parts.slice(1).join('=');
                if (key && value) {
                    toolArgs[key] = value;
                }
            });
        }

        const socket = await connectToServer(config);
        const client = new McpCliClient(socket);
        await client.initialize();
        
        const result = await client.callTool(toolName, toolArgs);
        
        // Format result nicely
        if (typeof result === 'object') {
             console.log(JSON.stringify(result, null, 2));
        } else {
             console.log(result);
        }
        
        socket.disconnect();
        process.exit(0);
    } catch (err: any) {
        console.error(chalk.red(`Error running tool: ${err.message}`));
        process.exit(1);
    }
  });

program
  .command('chat [message]')
  .description('Start interactive chat or send a single message')
  .option('-a, --agent <agent>', 'Specify agent to chat with')
  .action(async (message, options) => {
    const config = loadConfig();
    try {
        const socket = await connectToServer(config);
        const client = new McpCliClient(socket);
        await client.initialize();

        if (message) {
            // Single message mode
            // Reuse the repl logic or simple call
            // Using repl logic but simpler:
            console.log(chalk.gray('Sending message...'));
            // TODO: Extract send logic from repl to reuse?
            // For now, I'll just replicate simple call or use callTool directly
            // But I need to know WHICH tool.
            // I'll start REPL if message is missing, or send one shot if present.
            // But determining tool is in repl.ts
            // So I should probably expose a "sendMessage" function in repl.ts or mcp_client.ts?
            // Or just start REPL and pre-fill input?
            // Let's keep it simple: pass to startChatRepl?
            // startChatRepl is designed for loop.
            
            // I'll duplicate the tool discovery for now or move it to mcp_client.ts
            // Actually, I'll just use callTool 'chat' or 'anythingllm_chat'
            // Let's assume 'chat' for single message.
            
            const toolsResponse = await client.listTools();
            const tools = toolsResponse.tools || [];
            const toolNames = tools.map((t: any) => t.name);
            let chatTool = 'chat';
            if (toolNames.includes('anythingllm_chat')) chatTool = 'anythingllm_chat';
            
            const result = await client.callTool(chatTool, {
                message,
                agent: options.agent
            });
            
            // Output
             if (typeof result === 'object') {
                 // Try to find text content
                 if (result.content && Array.isArray(result.content)) {
                     console.log(formatToolsJson(result.content)); // or markdown
                 } else {
                     console.log(JSON.stringify(result, null, 2));
                 }
            } else {
                 console.log(String(result));
            }
            
            socket.disconnect();
            process.exit(0);
        } else {
            // Interactive mode
            await startChatRepl(client, options.agent);
            // repl handles exit
        }
    } catch (err: any) {
        console.error(chalk.red(`Error in chat: ${err.message}`));
        process.exit(1);
    }
  });

program.parse(process.argv);
