import { IAgent, AgentRegistry, ExecutionPlan, PlanStep } from "./types.js";
import { Logger } from "../utils/logger.js";
import { searchRAG } from "../utils/rag.js";
import { SelfHealingPipeline } from "../pipeline/llmPipeline.js";
import { chatWithOllama } from "../utils/llm.js";
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

        // 3. OPS ÜGYNÖK (Ops Agent)
        this.registerAgent({
            name: "ops",
            description: "Rendszer állapot és logok felügyelete.",
            capabilities: ["monitoring", "diagnostics"],
            execute: async (task: string) => {
                await logger.log(`[Ops] Task received: ${task}`);

                if (task.includes("metrics") || task.includes("status") || task.includes("állapot")) {
                    // Itt statikusan importáljuk vagy tool hívást szimulálunk, 
                    // de mivel ez "belső" execute, közvetlenül hívhatjuk a logikát ha kiszerveznénk,
                    // vagy visszaadhatunk egy útmutatót.
                    // Egyszerűség kedvéért most szöveges választ adunk.
                    return "A rendszer metrikák lekérdezéséhez használd a `monitor_get_metrics` toolt. A logokhoz a `monitor_tail_logs`-t.";
                }

                return `Ops Agent: A kért feladat (${task}) diagnosztikát igényel. Kérlek pontosítsd, mit vizsgáljak (pl. 'system status', 'web logs').`;
            }
        });

        // 3. OPS ÜGYNÖK (Ops Agent)
        this.registerAgent({
            name: "ops",
            description: "Rendszer állapot és logok felügyelete.",
            capabilities: ["monitoring", "diagnostics"],
            execute: async (task: string) => {
                await logger.log(`[Ops] Task received: ${task}`);

                if (task.includes("metrics") || task.includes("status") || task.includes("állapot")) {
                    return "A rendszer metrikák lekérdezéséhez használd a `monitor_get_metrics` toolt. A logokhoz a `monitor_tail_logs`-t.";
                }

                return `Ops Agent: A kért feladat (${task}) diagnosztikát igényel. Kérlek pontosítsd, mit vizsgáljak (pl. 'system status', 'web logs').`;
            }
        });

        // 4. INTEGRATOR ÜGYNÖK (AnythingLLM / Knowledge)
        this.registerAgent({
            name: "integrator",
            description: "Kapcsolattartás az AnythingLLM tudásbázissal.",
            capabilities: ["integration", "knowledge_sync"],
            execute: async (task: string) => {
                await logger.log(`[Integrator] Task received: ${task}`);
                // Simple logic: If it looks like a chat query, tell user to use the tool
                return `Integrator: A(z) "${task}" feladathoz használd az 'anythingllm_chat' toolt. Ha workspace listázás kell, akkor 'anythingllm_list_workspaces'.`;
            }
        });

        // 5. ORCHESTRATOR (Brunella - The Boss)
        this.registerAgent({
            name: "orchestrator",
            description: "A Brunella rendszer központi irányítója. Delegál.",
            capabilities: ["planning", "routing", "delegation"],
            execute: async (task: string) => {
                await logger.log(`[Orchestrator] Task received: ${task}`);
                const lowerTask = task.toLowerCase();

                // Simple routing logic based on keywords
                if (lowerTask.includes("kód") || lowerTask.includes("javítsd") || lowerTask.includes("fejleszt")) {
                    return await this.delegate("developer", task);
                }
                if (lowerTask.includes("keresd") || lowerTask.includes("kutass") || lowerTask.includes("tudás")) {
                    // Could be Researcher OR Integrator (AnythingLLM)
                    // Let's prefer Integrator if AnythingLLM is mentioned
                    if (lowerTask.includes("anything") || lowerTask.includes("local") || lowerTask.includes("bázis")) {
                        return await this.delegate("integrator", task);
                    }
                    return await this.delegate("researcher", task);
                }
                if (lowerTask.includes("monitor") || lowerTask.includes("log") || lowerTask.includes("status")) {
                    return await this.delegate("ops", task);
                }

                // Default fallback
                return `Orchestrator (Brunella): Értettem a feladatot: "${task}". Mivel nem tudtam egyértelműen kategóriába sorolni, kérlek használd közvetlenül a megfelelő ügynököt (developer, ops, integrator) vagy pontosíts.`;
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

    public async createPlan(task: string): Promise<ExecutionPlan> {
        const systemPrompt = `You are the Brunella Orchestrator Planner.
Your goal is to break down a complex user task into a sequence of atomic steps.
Available Agents:
- ops: Monitoring logs, metrics, system commands.
- developer: Writing and executing Python/JS code, fixing bugs.
- researcher: Searching knowledge base (RAG).
- integrator: Interacting with AnythingLLM or external APIs.

Return strictly valid JSON. No markdown blocks.`;

        const userPrompt = `Task: "${task}"

Return a JSON object with a "steps" array. Each step must have:
- "description": What to do.
- "agent": Which agent should do it.
- "tool": (Optional) Suggested tool name.`;

        const response = await chatWithOllama(userPrompt, systemPrompt);
        
        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const planData = JSON.parse(cleanJson);
            
            return {
                task,
                steps: planData.steps.map((s: any, i: number) => ({
                    ...s,
                    id: `step-${i+1}`,
                    status: 'pending'
                }))
            };
        } catch (e) {
            logger.log(`Plan generation failed: ${e}`, 'error');
            return {
                task,
                steps: [{
                    id: 'step-1',
                    description: task,
                    agent: 'orchestrator',
                    status: 'pending'
                }]
            };
        }
    }

    public async executePlan(plan: ExecutionPlan, emitEvent?: (event: string, data: any) => void): Promise<string> {
        let finalResult = "";
        
        if (emitEvent) emitEvent('plan_created', plan);

        for (const step of plan.steps) {
            step.status = 'running';
            if (emitEvent) emitEvent('plan_step_update', step);
            
            try {
                const agent = this.getAgent(step.agent) || this.getAgent('orchestrator'); 
                
                let result = "";
                if (agent) {
                    result = await agent.execute(step.description);
                } else {
                    result = "Agent not found.";
                }

                step.status = 'completed';
                step.result = result;
                finalResult += `[Step ${step.id} - ${step.agent}]:\n${result}\n\n`;
                
            } catch (e: any) {
                step.status = 'failed';
                step.result = e.message;
                finalResult += `[Step ${step.id} Failed]: ${e.message}\n`;
            }
            
            if (emitEvent) emitEvent('plan_step_update', step);
        }

        return finalResult;
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
