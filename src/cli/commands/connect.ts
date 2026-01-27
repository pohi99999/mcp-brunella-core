import { McpConfigManager } from '../mcp_config';
import { McpClientManager } from '../mcp_client';
import inquirer from 'inquirer';
import chalk from 'chalk';

const configManager = new McpConfigManager();
const mcpClient = new McpClientManager();

export async function connectCommand(serverName?: string) {
    const servers = configManager.getServers();

    if (serverName) {
        const server = servers.find(s => s.name === serverName);
        if (!server) {
            console.log(chalk.red(`Hiba: A(z) '${serverName}' szerver nem található a konfigurációban.`));
            return;
        }
        await performConnection(server);
    } else {
        const { selectedServer } = await inquirer.prompt([{
            type: 'list',
            name: 'selectedServer',
            message: 'Válassz szervert a csatlakozáshoz:',
            choices: servers.map(s => ({ name: s.name, value: s }))
        }]);
        await performConnection(selectedServer);
    }
}

async function performConnection(server: any) {
    try {
        console.log(chalk.blue(`Csatlakozás a(z) ${server.name} szerverhez...`));
        // Note: McpClientManager needs to support env variables from config
        await mcpClient.connectStdio(server.name, server.command, server.args, server.env || {});
        console.log(chalk.green(`Sikeresen csatlakoztatva: ${server.name}`));
    } catch (error: any) {
        console.error(chalk.red('Hiba a csatlakozáskor:'), error.message);
    }
}
