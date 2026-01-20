import { Logger } from "../utils/logger.js";
import { searchRAG } from "../utils/rag.js";
import { SelfHealingPipeline } from "../pipeline/llmPipeline.js";
import fs from "fs";
import path from "path";
const logger = new Logger('agent-manager.log');
export class AgentManager {
    agents = {};
    definitions = {};
    constructor() {
        this.loadRegistry();
        this.registerBuiltInAgents();
    }
    loadRegistry() {
        const registryPath = path.join(process.cwd(), "src", "agents", "registry.json");
        try {
            if (fs.existsSync(registryPath)) {
                const raw = fs.readFileSync(registryPath, "utf-8");
                const data = JSON.parse(raw);
                this.definitions = Object.fromEntries((data.agents || []).map((agent) => [agent.name, agent]));
                logger.log(`Agent registry loaded: ${registryPath}`);
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.log(`Agent registry load failed: ${errorMessage}`);
        }
    }
    registerBuiltInAgents() {
        // 1. KUTATÓ ÜGYNÖK (Research Agent)
        this.registerAgent({
            name: "researcher",
            description: "Keres a tudásbázisban és összefoglalja az információkat.",
            capabilities: ["rag_search", "summarization"],
            execute: async (task) => {
                await logger.log(`[Researcher] Task received: ${task}`);
                // 1. Keresés a RAG-ban
                const results = await searchRAG(task, 5);
                if (results.length === 0) {
                    return "Nem találtam releváns információt a tudásbázisban.";
                }
                // 2. Összegzés (Itt hívhatnánk az Ollamát is egy 'summarize' prompttal)
                const summary = results.map((r) => `- ${r.path}: ${r.content.substring(0, 200)}...`).join('\n');
                return `Találatok a tudásbázisból:\n${summary}`;
            }
        });
        // 2. FEJLESZTŐ ÜGYNÖK (Developer Agent)
        this.registerAgent({
            name: "developer",
            description: "Kódot generál és javít a pipeline segítségével.",
            capabilities: ["code_generation", "self_healing"],
            execute: async (task) => {
                await logger.log(`[Developer] Task received: ${task}`);
                const pipeline = new SelfHealingPipeline();
                try {
                    const code = await pipeline.run(task);
                    return `Sikeres kódgenerálás:\n\n${code}`;
                }
                catch (e) {
                    const errorMessage = e instanceof Error ? e.message : String(e);
                    return `Hiba a fejlesztés során: ${errorMessage}`;
                }
            }
        });
        // Sync built-ins to definitions
        ['researcher', 'developer'].forEach(name => {
            if (!this.definitions[name] && this.agents[name]) {
                const agent = this.agents[name];
                this.definitions[name] = {
                    name: agent.name,
                    title: agent.name.charAt(0).toUpperCase() + agent.name.slice(1),
                    description: agent.description,
                    capabilities: agent.capabilities,
                    status: 'active'
                };
            }
        });
    }
    registerAgent(agent) {
        this.agents[agent.name] = agent;
        logger.log(`Agent registered: ${agent.name}`);
    }
    getAgent(name) {
        return this.agents[name];
    }
    listAgents() {
        return Object.keys(this.agents);
    }
    listAgentDefinitions() {
        const registered = this.listAgents();
        const definitions = registered.map((name) => this.definitions[name]).filter(Boolean);
        return definitions.length > 0
            ? definitions
            : registered.map((name) => ({
                name,
                title: name,
                description: "",
                capabilities: [],
                status: "active"
            }));
    }
    listRegistryDefinitions() {
        return Object.values(this.definitions);
    }
    async delegate(agentName, task) {
        const agent = this.getAgent(agentName);
        if (!agent) {
            throw new Error(`Agent '${agentName}' not found.`);
        }
        return await agent.execute(task);
    }
    updateAgent(name, updates) {
        if (!this.definitions[name]) {
            // Try to find active agent
            const agent = this.agents[name];
            if (agent) {
                this.definitions[name] = {
                    name: agent.name,
                    title: agent.name,
                    description: agent.description,
                    capabilities: agent.capabilities,
                    status: "active"
                };
            }
            else {
                throw new Error(`Agent '${name}' not found.`);
            }
        }
        this.definitions[name] = { ...this.definitions[name], ...updates };
        // Save to file
        const registryDir = path.join(process.cwd(), "src", "agents");
        if (!fs.existsSync(registryDir))
            fs.mkdirSync(registryDir, { recursive: true });
        const registryPath = path.join(registryDir, "registry.json");
        const fileContent = {
            version: 1,
            agents: Object.values(this.definitions)
        };
        fs.writeFileSync(registryPath, JSON.stringify(fileContent, null, 2));
        logger.log(`Agent updated and saved: ${name}`);
        return this.definitions[name];
    }
}
export const agentManager = new AgentManager();
