import { IAgent, AgentRegistry, ExecutionPlan, PlanStep } from "./types.js";
import { Logger } from "../utils/logger.js";
import { searchRAG } from "../utils/rag.js";
import { SelfHealingPipeline } from "../pipeline/llmPipeline.js";
import { chatWithOllama } from "../utils/llm.js";
import { chatAnythingLLM, listAnythingLLMWorkspaces } from "../tools/anythingllm.js";
import fs from "fs";
import path from "path";
import { DataScientistAgent } from "./DataScientistAgent.js";

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
        // 0. ADATTUDÓS (Data Scientist) - Persistent Service
        const dataScientist = new DataScientistAgent();
        this.registerAgent({
            name: "data_scientist",
            description: "ADATTUDÓS szerepkör. Nyers adatokat tisztít, strukturál és validál a 'refiner' logika alapján.",
            capabilities: ["data_cleaning", "structuring", "validation"],
            execute: async (task: string) => {
                await logger.log(`[DataScientist] Task received: ${task}`);

                // Treat the task as the raw content to refine
                // Remove command prefixes if present
                let content = task;
                if (content.toLowerCase().startsWith("clean") || content.toLowerCase().startsWith("refine")) {
                    content = content.replace(/^(clean|refine)\s*[:]?\s*/i, "");
                }

                const result = await dataScientist.refineData(content, 'agent_request');

                if (result) {
                    return `Adattisztítás Eredménye:\n${JSON.stringify(result, null, 2)}`;
                } else {
                    return "Az adat zajnak minősült vagy nem releváns a rendszer számára (Low Relevance / Dropped).";
                }
            }
        });

        // 1. KUTATÓ ÜGYNÖK (Research Agent)
        this.registerAgent({
            name: "researcher",
            description: "KUTATÓ szerepkör. Keres a tudásbázisban a TÁPLÁLÓ rétegből, és összefoglalja az információkat.",
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

        // 2. NODE.JS FEJLESZTŐ ÜGYNÖK (Node Developer)
        this.registerAgent({
            name: "node_developer",
            description: "ADATTUDÁS/TANÍTÓ szerepkör. Javascript/Node.js kódot generál és futtat.",
            capabilities: ["nodejs", "javascript", "code_generation"],
            execute: async (task: string) => {
                await logger.log(`[NodeDeveloper] Task received: ${task}`);
                const pipeline = new SelfHealingPipeline();
                try {
                    const code = await pipeline.run(task);
                    return `Sikeres kódgenerálás (Node.js):\n\n${code}`;
                } catch (e: any) {
                    return `Hiba a fejlesztés során: ${e.message}`;
                }
            }
        });

        // 2b. PYTHON FEJLESZTŐ ÜGYNÖK (Python Developer)
        this.registerAgent({
            name: "python_developer",
            description: "ADATTUDÁS/TANÍTÓ szerepkör. Python scripteket ír és futtat (adatelemzés, matek).",
            capabilities: ["python", "data_analysis", "math"],
            execute: async (task: string) => {
                await logger.log(`[PythonDeveloper] Task received: ${task}`);

                // Prompt Ollama to generate python code for the task
                const systemPrompt = "You are a Python Expert. Write a script for the following task. Output ONLY the code, no markdown.";
                const code = await chatWithOllama(task, systemPrompt);

                // Clean code
                const cleanCode = code.replace(/```python/g, "").replace(/```/g, "").trim();

                // Execute using globalPythonShell (bridge is in interpreter tool, but we can call it here)
                const { globalPythonShell } = await import("../utils/pythonShell.js");

                try {
                    const output = await globalPythonShell.execute(cleanCode);
                    return `Python Code:\n${cleanCode}\n\nOutput:\n${output}`;
                } catch (e: any) {
                    return `Python Execution Error: ${e.message}`;
                }
            }
        });

        // 3. OPS ÜGYNÖK (Ops Agent)
        this.registerAgent({
            name: "ops",
            description: "IMMUNRENDSZER felügyelő. Rendszer állapot és logok felügyelete.",
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

        // 4. INTEGRATOR ÜGYNÖK (AnythingLLM / Knowledge)
        this.registerAgent({
            name: "integrator",
            description: "Adattudás és Integráció. Kapcsolattartás az AnythingLLM tudásbázissal.",
            capabilities: ["integration", "knowledge_sync"],
            execute: async (task: string) => {
                await logger.log(`[Integrator] Task received: ${task}`);
                const lowerTask = task.toLowerCase();
                const workspaceMatch = task.match(/workspace\s*[:=]\s*([a-zA-Z0-9._-]+)/i);
                const workspace = workspaceMatch?.[1];

                try {
                    if (lowerTask.includes("workspace") || lowerTask.includes("list") || lowerTask.includes("listáz")) {
                        const data = await listAnythingLLMWorkspaces();
                        return `AnythingLLM workspaces:\n${JSON.stringify(data, null, 2)}`;
                    }

                    const data = await chatAnythingLLM(task, workspace);
                    return `AnythingLLM válasz:\n${JSON.stringify(data, null, 2)}`;
                } catch (e: any) {
                    return `AnythingLLM hiba: ${e.message}`;
                }
            }
        });

        // 5. ORCHESTRATOR (Brunella - The Boss)
        this.registerAgent({
            name: "orchestrator",
            description: "AZ AGYPIAC vezetője (Karmester). A Brunella rendszer központi irányítója.",
            capabilities: ["planning", "routing", "delegation", "chat"],
            execute: async (task: string) => {
                await logger.log(`[Orchestrator] Task received: ${task}`);
                const lowerTask = task.toLowerCase();

                // Simple routing logic based on keywords
                if (lowerTask.includes("tisztítsd") || lowerTask.includes("szűrd") || lowerTask.includes("refine") || lowerTask.includes("clean")) {
                    return await this.delegate("data_scientist", task);
                }
                if (lowerTask.includes("python") || lowerTask.includes("számold") || lowerTask.includes("adat")) {
                    return await this.delegate("python_developer", task);
                }
                if (lowerTask.includes("kód") || lowerTask.includes("javítsd") || lowerTask.includes("fejleszt") || lowerTask.includes("javascript") || lowerTask.includes("node")) {
                    return await this.delegate("node_developer", task);
                }
                if (lowerTask.includes("keresd") || lowerTask.includes("kutass") || lowerTask.includes("tudás")) {
                    if (lowerTask.includes("anything") || lowerTask.includes("local") || lowerTask.includes("bázis")) {
                        return await this.delegate("integrator", task);
                    }
                    return await this.delegate("researcher", task);
                }
                if (lowerTask.includes("monitor") || lowerTask.includes("log") || lowerTask.includes("status")) {
                    return await this.delegate("ops", task);
                }

                // If no specific agent found, answer directly as Brunella
                const response = await chatWithOllama(task, "You are Brunella, the core AI of this system. Answer the user directly and helpfully in the same language they used.");
                return response;
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
Your goal is to decide if a task is a simple chat/question or a complex operation.

Available Agents:
- ops: Monitoring logs, metrics, system commands.
- node_developer: Writing/executing Node.js code.
- python_developer: Writing/executing Python code.
- data_scientist: Cleaning and structuring raw text data (refining).
- researcher: Searching knowledge base (RAG).
- integrator: Interacting with AnythingLLM.

CRITICAL RULES:
1. If the input is a question (e.g. "magyarul tudsz?", "hogy vagy?", "ki vagy?"), return ONLY ONE step for the "orchestrator". DO NOT break it down.
2. Only create multiple steps if the task involves multiple distinct actions (e.g. "find logs AND fix the code").
3. Return strictly valid JSON. No markdown.`;

        const userPrompt = `Task: "${task}"

Return a JSON object: {"steps": [{"description": "...", "agent": "...", "tool": "..."}]}`;

        const response = await chatWithOllama(userPrompt, systemPrompt);

        try {
            const cleanJson = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const planData = JSON.parse(cleanJson);

            return {
                task,
                steps: planData.steps.map((s: any, i: number) => ({
                    ...s,
                    id: `step-${i + 1}`,
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
