#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import { readFileSync } from 'fs';
import { join } from 'path';
import { configManager } from './utils/cliConfig';
import { BrunellaClient } from './utils/mcpClient';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import inquirer from 'inquirer';
import ora from 'ora';

const program = new Command();

// Try to read package.json version
let version = '0.0.0';
try {
  const pkg = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf-8'));
  version = pkg.version;
} catch (e) {
  // ignore
}

console.log(boxen(chalk.blue('Brunella CLI') + ` v${version}`, { padding: 1, borderStyle: 'round' }));

program
  .name('brunella')
  .description('Official CLI for Brunella Core')
  .version(version);

const configCommand = program.command('config')
  .description('Manage CLI configuration');

configCommand.command('list')
  .description('List all configuration settings')
  .action(() => {
    const settings = configManager.getAll();
    console.log(chalk.bold('Current Configuration:'));
    for (const [key, value] of Object.entries(settings)) {
      console.log(`  ${chalk.cyan(key)}: ${value}`);
    }
  });

configCommand.command('get <key>')
  .description('Get a specific configuration setting')
  .action((key) => {
    const settings = configManager.getAll();
    if (key in settings) {
      console.log(`${key}: ${settings[key as keyof typeof settings]}`);
    } else {
      console.log(chalk.red(`Key '${key}' not found.`));
    }
  });

configCommand.command('set <key> <value>')
  .description('Set a configuration setting')
  .action((key, value) => {
    configManager.set(key as any, value);
    console.log(chalk.green(`Updated ${key} to ${value}`));
  });

program.command('tools')
  .description('List available MCP tools')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      const result = await client.listTools();
      
      if (options.json) {
        console.log(JSON.stringify(result.tools, null, 2));
      } else {
        console.log(chalk.bold(`Available Tools (${result.tools.length}):`));
        for (const tool of result.tools) {
           console.log(chalk.green('• ' + tool.name) + (tool.description ? ': ' + chalk.dim(tool.description) : ''));
        }
      }
    } catch (error: any) {
      console.error(chalk.red('Error fetching tools:'), error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
  });

program.command('run <toolName> [args...]')
  .description('Run an MCP tool (pass args as key=value or single JSON string)')
  .action(async (toolName, args) => {
      const parsedArgs: any = {};
      if (args.length === 1 && args[0].trim().startsWith('{')) {
          try {
              Object.assign(parsedArgs, JSON.parse(args[0]));
          } catch (e) {
              console.error(chalk.red("Invalid JSON argument"));
              process.exit(1);
          }
      } else {
          for (const arg of args) {
              const parts = arg.split('=');
              if (parts.length >= 2) {
                  const key = parts[0];
                  const value = parts.slice(1).join('=');
                  parsedArgs[key] = value;
              }
          }
      }

      const client = new BrunellaClient();
      try {
          await client.connect();
          const result = await client.callTool(toolName, parsedArgs);
          
          const res = result as any;
          if (res.content && Array.isArray(res.content)) {
              for (const item of res.content) {
                  if (item.type === 'text') {
                      console.log(item.text);
                  } else {
                      console.log(chalk.yellow(`[${item.type}] output`));
                      if (item.type === 'resource') {
                          console.log(item.resource);
                      }
                  }
              }
          } else {
             console.log(JSON.stringify(result, null, 2));
          }
      } catch (error: any) {
          console.error(chalk.red('Tool execution failed:'), error.message);
      } finally {
          await client.close();
          process.exit(0);
      }
  });

program.command('chat')
  .description('Interactive chat with Brunella')
  .action(async () => {
      marked.setOptions({
        renderer: new TerminalRenderer() as any
      });

      console.log(chalk.cyan("Starting chat... (Type 'exit' to quit)"));
      
      const client = new BrunellaClient();
      try {
        await client.connect();

        let context = ""; 

        while (true) {
            const { prompt } = await inquirer.prompt([{ 
                type: 'input',
                name: 'prompt',
                message: 'You:',
            }]);

            if (prompt.toLowerCase() === 'exit') break;

            const fullPrompt = context ? `${context}\nUser: ${prompt}\nAssistant:` : `User: ${prompt}\nAssistant:`;
            
            const spinner = ora('Thinking...').start();
            try {
                const result = await client.callTool('ollama_generate', {
                    prompt: fullPrompt,
                    model: 'llama3.1' 
                });
                spinner.stop();
                
                const res = result as any;
                if (res.isError) {
                    console.log(chalk.red("Error:"), res.content?.[0]?.text);
                } else {
                    const response = res.content?.[0]?.text || "";
                    console.log(chalk.green('Brunella:'));
                    console.log(marked(response));
                    
                    context += `\nUser: ${prompt}\nAssistant: ${response}`;
                }
            } catch (err: any) {
                spinner.stop();
                console.error(chalk.red("Error calling tool:"), err.message);
            }
        }
      } catch (e: any) {
          console.error(chalk.red("Chat error:"), e.message);
      } finally {
          await client.close();
          process.exit(0);
      }
  });

program.command('agents')
  .description('List available agents')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const client = new BrunellaClient();
    try {
      await client.connect();
      const result = await client.callTool('agent_list', {});
      
      const res = result as any;
      const content = res.content?.[0]?.text;
      if (!content) {
          console.log("No agents found.");
          return;
      }
      
      const agents = JSON.parse(content);
      
      if (options.json) {
        console.log(JSON.stringify(agents, null, 2));
      } else {
        console.log(chalk.bold('Active Agents:'));
        if (Array.isArray(agents)) {
             for (const agent of agents) {
                 console.log(chalk.green(`• ${agent.name}`) + (agent.role ? ` (${agent.role})` : ''));
                 if (agent.description) console.log(chalk.dim(`  ${agent.description}`));
             }
        } else {
             console.log(content);
        }
      }
    } catch (error: any) {
      console.error(chalk.red('Error listing agents:'), error.message);
    } finally {
        await client.close();
        process.exit(0);
    }
  });

program.command('delegate <agentName> <task>')
  .description('Delegate a task to an agent')
  .action(async (agentName, task) => {
      const client = new BrunellaClient();
      try {
          await client.connect();
          const spinner = ora(`Delegating to ${agentName}...`).start();
          const result = await client.callTool('agent_delegate', { agent_name: agentName, task });
          spinner.stop();
          
          const res = result as any;
          if (res.content) {
              for (const item of (res.content as any[])) {
                  if (item.type === 'text') {
                      console.log(chalk.green('Result:'));
                      console.log(item.text);
                  }
              }
          }
      } catch (error: any) {
          console.error(chalk.red('Delegation failed:'), error.message);
      } finally {
          await client.close();
          process.exit(0);
      }
  });

program.parse(process.argv);
