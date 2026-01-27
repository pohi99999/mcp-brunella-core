import { Command } from 'commander';
import path from 'path';
import fs from 'fs';
import { AgentsDB } from '../../database/agents_db.js';
import { AgentRouter } from '../../agent_factory/router.js';
import { AgentSupervisor } from '../../agent_factory/supervisor.js';
import chalk from 'chalk';
import inquirer from 'inquirer';

const REGISTRY_PATH = path.resolve(process.cwd(), 'src', 'agents', 'registry.json');

type RegistryAgent = {
    name: string;
    title?: string;
    description?: string;
    capabilities?: string[];
    category?: string;
    status?: string;
    tags?: string[];
};

function loadRegistry(): { agents: RegistryAgent[] } {
    if (!fs.existsSync(REGISTRY_PATH)) {
        return { agents: [] };
    }
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
}

function saveRegistry(reg: { agents: RegistryAgent[] }) {
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2));
}

export const agentCommand = new Command('agent');

agentCommand
    .description('Manage AI Agents (Factory)');

// Registry CRUD
const registry = agentCommand.command('registry').description('Manage agent registry (registry.json)');

registry
    .command('list')
    .description('List agents in registry.json')
    .action(() => {
        const reg = loadRegistry();
        if (!reg.agents.length) {
            console.log(chalk.yellow('Nincs ügynök a registry-ben.'));
            return;
        }
        console.table(reg.agents.map(a => ({
            Name: a.name,
            Title: a.title ?? '',
            Status: a.status ?? '',
            Category: a.category ?? '',
            Tags: a.tags?.join(', ') ?? ''
        })));
    });

registry
    .command('add <name>')
    .description('Add agent to registry.json')
    .option('--title <title>', 'Title')
    .option('--description <description>', 'Description')
    .option('--category <category>', 'Category (pl. core/knowledge/ops)')
    .option('--status <status>', 'Status (active/planned)', 'active')
    .option('--tags <tags>', 'Comma separated tags')
    .option('--capabilities <caps>', 'Comma separated capabilities')
    .action((name, options) => {
        const reg = loadRegistry();
        if (reg.agents.find(a => a.name === name)) {
            console.log(chalk.red('Már létezik ilyen ügynök a registry-ben.'));
            return;
        }
        const agent: RegistryAgent = {
            name,
            title: options.title,
            description: options.description,
            category: options.category,
            status: options.status,
            tags: options.tags ? options.tags.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
            capabilities: options.capabilities ? options.capabilities.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined,
        };
        reg.agents.push(agent);
        saveRegistry(reg);
        console.log(chalk.green(`Agent '${name}' hozzáadva a registry-hez.`));
    });

registry
    .command('update <name>')
    .description('Update agent in registry.json')
    .option('--title <title>', 'Title')
    .option('--description <description>', 'Description')
    .option('--category <category>', 'Category')
    .option('--status <status>', 'Status (active/planned)')
    .option('--tags <tags>', 'Comma separated tags (teljes felülírás)')
    .option('--capabilities <caps>', 'Comma separated capabilities (teljes felülírás)')
    .action((name, options) => {
        const reg = loadRegistry();
        const agent = reg.agents.find(a => a.name === name);
        if (!agent) {
            console.log(chalk.red('Nincs ilyen ügynök a registry-ben.'));
            return;
        }
        if (options.title !== undefined) agent.title = options.title;
        if (options.description !== undefined) agent.description = options.description;
        if (options.category !== undefined) agent.category = options.category;
        if (options.status !== undefined) agent.status = options.status;
        if (options.tags !== undefined) {
            agent.tags = options.tags.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        if (options.capabilities !== undefined) {
            agent.capabilities = options.capabilities.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
        saveRegistry(reg);
        console.log(chalk.green(`Agent '${name}' frissítve a registry-ben.`));
    });

registry
    .command('remove <name>')
    .description('Remove agent from registry.json')
    .action((name) => {
        const reg = loadRegistry();
        const before = reg.agents.length;
        reg.agents = reg.agents.filter(a => a.name !== name);
        if (reg.agents.length === before) {
            console.log(chalk.red('Nincs ilyen ügynök a registry-ben.'));
            return;
        }
        saveRegistry(reg);
        console.log(chalk.green(`Agent '${name}' eltávolítva a registry-ből.`));
    });

agentCommand
    .command('list')
    .description('List all registered agents')
    .action(async () => {
        const db = new AgentsDB('agents.db');
        try {
            const agents = db.getAllAgents();
            if (agents.length === 0) {
                console.log(chalk.yellow('No agents found in the registry.'));
            } else {
                console.table(agents.map(a => ({
                    ID: a.id,
                    Name: a.name,
                    Status: a.status,
                    LastHeartbeat: a.last_heartbeat,
                    Capabilities: a.capabilities.join(', ')
                })));
            }
        } catch (e: any) {
            console.error(chalk.red(`Failed to list agents: ${e.message}`));
        } finally {
            db.close();
        }
    });

agentCommand
    .command('create <name>')
    .description('Create a new agent from template')
    .option('-t, --template <type>', 'Template type (default: python)', 'python')
    .action(async (name, options) => {
        const agentsDir = path.resolve(process.cwd(), 'src', 'agents');
        if (!fs.existsSync(agentsDir)) {
            fs.mkdirSync(agentsDir, { recursive: true });
        }

        const fileName = `${name}.py`;
        const filePath = path.join(agentsDir, fileName);

        if (fs.existsSync(filePath)) {
            console.error(chalk.red(`Agent '${name}' already exists at ${filePath}`));
            return;
        }

        // Template content
        const template = `import sys
import os
import logging

# Add project root to sys.path to import base_agent
# Assuming this script is in src/agents/ and base_agent is in src/agent_factory/sdk/python/
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../agent_factory/sdk/python')))

from base_agent import BaseAgent

logging.basicConfig(level=logging.INFO, stream=sys.stderr)

class ${name.charAt(0).toUpperCase() + name.slice(1)}Agent(BaseAgent):
    def __init__(self):
        super().__init__(
            agent_id="${name}",
            name="${name}",
            capabilities=["chat", "example"]
        )

    def on_message(self, sender_id: str, content: str):
        logging.info(f"Received message from {sender_id}: {content}")
        # Echo back
        self.send_message(sender_id, f"Echo: {content}")

if __name__ == "__main__":
    agent = ${name.charAt(0).toUpperCase() + name.slice(1)}Agent()
    agent.start()
`;

        fs.writeFileSync(filePath, template);
        console.log(chalk.green(`Agent '${name}' created successfully at ${filePath}`));
    });

agentCommand
    .command('run <agentPath>')
    .description('Run an agent (spawn process)')
    .action(async (agentPath) => {
        const db = new AgentsDB('agents.db');
        const router = new AgentRouter(db);
        const supervisor = new AgentSupervisor(router);

        let fullPath = path.resolve(process.cwd(), agentPath);
        if (!fs.existsSync(fullPath)) {
            // Try src/agents
            fullPath = path.resolve(process.cwd(), 'src', 'agents', agentPath);
            if (!fs.existsSync(fullPath)) {
                // Try appending .py
                fullPath = path.resolve(process.cwd(), 'src', 'agents', agentPath + '.py');
                if (!fs.existsSync(fullPath)) {
                    console.error(chalk.red(`Agent file not found: ${agentPath}`));
                    return;
                }
            }
        }

        console.log(chalk.blue(`Spawning agent from: ${fullPath}`));
        
        try {
            // Assuming python agents
            const pid = supervisor.spawnAgent('python', [fullPath]);
            console.log(chalk.green(`Agent spawned with PID: ${pid}`));
            console.log(chalk.yellow('Press Ctrl+C to stop...'));

            // Keep alive
            setInterval(() => {}, 1000);
        } catch (e: any) {
            console.error(chalk.red(`Failed to spawn agent: ${e.message}`));
        }
    });
