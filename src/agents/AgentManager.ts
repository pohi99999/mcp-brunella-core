import { IAgent, AgentRegistry } from "./types.js";
import { Logger } from "../utils/logger.js";
import { searchRAG } from "../utils/rag.js";
import { SelfHealingPipeline } from "../pipeline/llmPipeline.js";

const logger = new Logger('agent-manager.log');

export class AgentManager {
    private agents: AgentRegistry = {};

    constructor() {
        this.registerBuiltInAgents();
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

    public async delegate(agentName: string, task: string): Promise<string> {
        const agent = this.getAgent(agentName);
        if (!agent) {
            throw new Error(`Agent '${agentName}' not found.`);
        }
        return await agent.execute(task);
    }
}

export const agentManager = new AgentManager();
