import { IAgent, AgentRegistry } from "./types.js";
import { Logger } from "../utils/logger.js";
import { searchRAG } from "../utils/rag.js";
import { SelfHealingPipeline } from "../pipeline/llmPipeline.js";
import fs from "fs";
import path from "path";

const logger = new Logger('agent-manager.log');

export class AgentManager {
    private agents: AgentRegistry = {};
    private definitions: Record<string, AgentDefinition> = {};

    constructor() {
        this.loadRegistry();
        this.registerBuiltInAgents();
    }

    private loadRegistry() {
        const registryPath = path.join(process.cwd(), "src", "agents", "registry.json");
        try {
            const raw = fs.readFileSync(registryPath, "utf-8");
            const data = JSON.parse(raw) as AgentRegistryFile;
            this.definitions = Object.fromEntries(
                (data.agents || []).map((agent) => [agent.name, agent])
            );
            logger.log(`Agent registry loaded: ${registryPath}`);
        } catch (error: any) {
            logger.log(`Agent registry load failed: ${error.message}`);
        }
    }

    private registerBuiltInAgents() {
        // 1. KUTATÓ ÜGYNÖK (Research Agent)
        this.registerAgent({
            name: "researcher",
            description: "Keres a tudásbázisban és összefoglalja az információkat.",
            capabilities: ["rag_search", "summarization"],
            execute: async (task: string) => {
                await logger.log(`[Researcher] Task received: ${task}`);
                
                // 1. Keresés a RAG-ban
                const results = await searchRAG(task, 5);
                if (results.length === 0) {
                    return "Nem találtam releváns információt a tudásbázisban.";
                }

                // 2. Összegzés (Itt hívhatnánk az Ollamát is egy 'summarize' prompttal)
                const summary = results.map((r: any) => `- ${r.path}: ${r.content.substring(0, 200)}...`).join('\n');
                return `Találatok a tudásbázisból:\n${summary}`;
            }
        });

        // 2. FEJLESZTŐ ÜGYNÖK (Developer Agent)
        this.registerAgent({
            name: "developer",
            description: "Kódot generál és javít a pipeline segítségével.",
            capabilities: ["code_generation", "self_healing"],
            execute: async (task: string) => {
                await logger.log(`[Developer] Task received: ${task}`);
                const pipeline = new SelfHealingPipeline();
                try {
                    const code = await pipeline.run(task);
                    return `Sikeres kódgenerálás:\n\n${code}`;
                } catch (e: any) {
                    return `Hiba a fejlesztés során: ${e.message}`;
                }
            }
        });
    }

    public registerAgent(agent: IAgent) {
        this.agents[agent.name] = agent;
        logger.log(`Agent registered: ${agent.name}`);
    }

    public getAgent(name: string): IAgent | undefined {
        return this.agents[name];
    }

    public listAgents(): string[] {
        return Object.keys(this.agents);
    }

    public listAgentDefinitions(): AgentDefinition[] {
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

    public listRegistryDefinitions(): AgentDefinition[] {
        return Object.values(this.definitions);
    }

    public async delegate(agentName: string, task: string): Promise<string> {
        const agent = this.getAgent(agentName);
        if (!agent) {
            throw new Error(`Agent '${agentName}' not found.`);
        }
        return await agent.execute(task);
    }
}

export const agentManager = new AgentManager();

interface AgentDefinition {
    name: string;
    title: string;
    description: string;
    capabilities: string[];
    tools?: string[];
    notes?: string;
    category?: string;
    status?: "active" | "planned" | "deprecated";
    tags?: string[];
}

interface AgentRegistryFile {
    version: number;
    agents: AgentDefinition[];
}
