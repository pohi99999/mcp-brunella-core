import inquirer from 'inquirer';
import chalk from 'chalk';
import { toolRegistry } from '../tools/registry';
import '../tools/fs_tools';
import '../tools/browser_tools';
import '../tools/search_tools';
import { conductorCommand } from './conductor';
import { connectCommand } from './connect';

export async function chatCommand() {
    console.log(chalk.cyan('\n💬 Brunella Chat (Interactive Mode)'));
    console.log(chalk.gray('Type "/help" for available commands.\n'));

    while (true) {
        const { input } = await inquirer.prompt([{
            type: 'input',
            name: 'input',
            message: chalk.green('Brunella >')
        }]);

        if (!input || input.trim() === '') continue;

        if (input.trim() === '/exit' || input.trim() === '/quit') {
            console.log(chalk.yellow('Viszlát!'));
            break;
        }

        if (input.startsWith('/')) {
            await handleSlashCommand(input);
            continue;
        }

        console.log(chalk.blue('Echo:'), input);
        // TODO: Process input with Agent or Tools
    }
}

async function handleSlashCommand(input: string) {
    const [command, ...args] = input.slice(1).split(' ');

    switch (command) {
        case 'help':
            console.log(chalk.bold('\nAvailable commands:'));
            console.log(chalk.yellow('/help') + '  - Show this help');
            console.log(chalk.yellow('/exit') + '  - Exit chat');
            console.log(chalk.yellow('/clear') + ' - Clear screen');
            console.log(chalk.yellow('/tools') + ' - List available tools');
            console.log(chalk.yellow('/connect [name]') + ' - Connect to an MCP server');
            console.log(chalk.yellow('/tool <name> [args]') + ' - Execute a tool (args as JSON)\n');
            break;
        case 'clear':
            console.clear();
            break;
        case 'connect':
            await connectCommand(args[0]);
            break;
        case 'tools':
            console.log(chalk.bold('\nAvailable Tools:'));
            toolRegistry.listTools().forEach(t => {
                console.log(chalk.cyan(`- ${t.name.padEnd(15)}`) + `: ${t.description}`);
            });
            console.log();
            break;
        case 'conductor':
            await conductorCommand(args[0] || 'status');
            break;
        case 'tool':
            if (!args[0]) {
                console.log(chalk.red('Error: Tool name required.'));
                break;
            }
            const toolName = args[0];
            const toolArgsStr = args.slice(1).join(' ');
            let toolArgs = {};
            try {
                if (toolArgsStr) toolArgs = JSON.parse(toolArgsStr);
                console.log(chalk.gray(`Executing ${toolName}...`));
                const result = await toolRegistry.executeTool(toolName, toolArgs);
                console.log(chalk.green('Result:'), result);
            } catch (e: any) {
                console.error(chalk.red('Error executing tool:'), e.message);
            }
            break;
        default:
            console.log(chalk.red(`Unknown command: /${command}.`) + ' Type /help for help.');
    }
}
