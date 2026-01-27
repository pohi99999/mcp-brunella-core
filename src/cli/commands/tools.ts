import chalk from 'chalk';
import { toolRegistry } from '../tools/index.js';
import { mcpClientManager } from '../mcp_client.js';

export async function toolsCommand(action: string, toolName?: string, argsJson?: string) {
  switch (action) {
    case 'list':
      await listAllTools();
      break;
    case 'invoke':
      await invokeTool(toolName, argsJson);
      break;
    default:
      console.log(chalk.red(`Ismeretlen művelet: ${action}`));
      console.log(chalk.yellow('Használat: brunella tools <list|invoke> [name] [json_args]'));
  }
}

async function listAllTools() {
  const nativeTools = toolRegistry.listTools();
  console.log(chalk.cyan('🧰 Natív CLI toolok:'));
  if (nativeTools.length === 0) {
    console.log(chalk.gray('Nincs regisztrált natív tool.'));
  } else {
    nativeTools.forEach(tool => {
      console.log(`${chalk.green('✔')} ${chalk.bold(tool.name)} - ${tool.description}`);
    });
  }

  const clients = mcpClientManager.getClientNames();
  console.log(chalk.cyan('\n🔌 MCP toolok:'));
  if (clients.length === 0) {
    console.log(chalk.gray('Nincs aktív MCP kapcsolat.'));
    return;
  }

  for (const clientName of clients) {
    try {
      const result = await mcpClientManager.listTools(clientName);
      if (result.tools.length === 0) {
        console.log(chalk.gray(`- ${clientName}: nincs tool`));
        continue;
      }
      console.log(chalk.yellow(`- ${clientName}:`));
      result.tools.forEach(tool => {
        console.log(`  ${chalk.green('✔')} mcp.${clientName}.${tool.name} - ${tool.description || ''}`);
      });
    } catch (error: any) {
      console.log(chalk.red(`- ${clientName}: hiba a listázáskor (${error.message})`));
    }
  }
}

async function invokeTool(toolName?: string, argsJson?: string) {
  if (!toolName) {
    console.log(chalk.red('Hiba: Add meg a tool nevét.'));
    return;
  }

  let args: any = {};
  if (argsJson) {
    try {
      args = JSON.parse(argsJson);
    } catch (error) {
      console.log(chalk.red('Hiba: A JSON paraméterek érvénytelenek.'));
      console.log(chalk.dim('Példa: brunella tools invoke read_file {"filePath":"README.md"}'));
      return;
    }
  }

  const native = toolRegistry.getTool(toolName);
  if (native) {
    try {
      const result = await native.execute(args);
      console.log(chalk.green('✔ Natív tool eredmény:'));
      console.log(result);
    } catch (error: any) {
      console.log(chalk.red(`✖ Natív tool hiba: ${error.message}`));
    }
    return;
  }

  const parsed = parseMcpToolName(toolName);
  if (parsed) {
    try {
      const result = await mcpClientManager.callTool(parsed.serverName, parsed.toolName, args);
      console.log(chalk.green(`✔ MCP tool (${parsed.serverName}) eredmény:`));
      console.log(JSON.stringify(result, null, 2));
      return;
    } catch (error: any) {
      console.log(chalk.red(`✖ MCP tool hiba (${parsed.serverName}): ${error.message}`));
      return;
    }
  }

  const clients = mcpClientManager.getClientNames();
  for (const clientName of clients) {
    try {
      const tools = await mcpClientManager.listTools(clientName);
      if (tools.tools.some(t => t.name === toolName)) {
        const result = await mcpClientManager.callTool(clientName, toolName, args);
        console.log(chalk.green(`✔ MCP tool (${clientName}) eredmény:`));
        console.log(JSON.stringify(result, null, 2));
        return;
      }
    } catch (error: any) {
      console.log(chalk.red(`✖ MCP tool hiba (${clientName}): ${error.message}`));
      return;
    }
  }

  console.log(chalk.red(`Hiba: Tool nem található (${toolName}).`));
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
