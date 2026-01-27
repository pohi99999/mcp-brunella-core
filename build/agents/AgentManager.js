import { Logger } from "../utils/logger.js";
import { searchRAG } from "../utils/rag.js";
import { SelfHealingPipeline } from "../pipeline/llmPipeline.js";
import { chatWithOllama } from "../utils/llm.js";
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
            const raw = fs.readFileSync(registryPath, "utf-8");
            const data = JSON.parse(raw);
            this.definitions = Object.fromEntries((data.agents || []).map((agent) => [agent.name, agent]));
            logger.log(`Agent registry loaded: ${registryPath}`);
        }
        catch (error) {
            logger.log(`Agent registry load failed: ${error.message}`);
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
        // 2. NODE.JS FEJLESZTŐ ÜGYNÖK (Node Developer)
        this.registerAgent({
            name: "node_developer",
            description: "Javascript/Node.js kódot generál és futtat.",
            capabilities: ["nodejs", "javascript", "code_generation"],
            execute: async (task) => {
                await logger.log(`[NodeDeveloper] Task received: ${task}`);
                const pipeline = new SelfHealingPipeline();
                try {
                    const code = await pipeline.run(task);
                    return `Sikeres kódgenerálás (Node.js):\n\n${code}`;
                }
                catch (e) {
                    return `Hiba a fejlesztés során: ${e.message}`;
                }
            }
        });
        // 2b. PYTHON FEJLESZTŐ ÜGYNÖK (Python Developer)
        this.registerAgent({
            name: "python_developer",
            description: "Python scripteket ír és futtat (adatelemzés, matek).",
            capabilities: ["python", "data_analysis", "math"],
            execute: async (task) => {
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
                }
                catch (e) {
                    return `Python Execution Error: ${e.message}`;
                }
            }
        });
        // 3. OPS ÜGYNÖK (Ops Agent)
        this.registerAgent({
            name: "ops",
            description: "Rendszer állapot és logok felügyelete.",
            capabilities: ["monitoring", "diagnostics"],
            execute: async (task) => {
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
            description: "Kapcsolattartás az AnythingLLM tudásbázissal.",
            capabilities: ["integration", "knowledge_sync"],
            execute: async (task) => {
                await logger.log(`[Integrator] Task received: ${task}`);
                // Simple logic: If it looks like a chat query, tell user to use the tool
                return `Integrator: A(z) "${task}" feladathoz használd az 'anythingllm_chat' toolt. Ha workspace listázás kell, akkor 'anythingllm_list_workspaces'.`;
            }
        });
        // 5. ORCHESTRATOR (Brunella - The Boss)
        this.registerAgent({
            name: "orchestrator",
            description: "A Brunella rendszer központi irányítója. Delegál vagy válaszol.",
            capabilities: ["planning", "routing", "delegation", "chat"],
            execute: async (task) => {
                await logger.log(`[Orchestrator] Task received: ${task}`);
                const lowerTask = task.toLowerCase();
                // Simple routing logic based on keywords
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
    async createPlan(task) {
        const systemPrompt = `You are the Brunella Orchestrator Planner.
Your goal is to decide if a task is a simple chat/question or a complex operation.

Available Agents:
- ops: Monitoring logs, metrics, system commands.
- node_developer: Writing/executing Node.js code.
- python_developer: Writing/executing Python code.
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
                steps: planData.steps.map((s, i) => ({
                    ...s,
                    id: `step-${i + 1}`,
                    status: 'pending'
                }))
            };
        }
        catch (e) {
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
    async executePlan(plan, emitEvent) {
        let finalResult = "";
        if (emitEvent)
            emitEvent('plan_created', plan);
        for (const step of plan.steps) {
            step.status = 'running';
            if (emitEvent)
                emitEvent('plan_step_update', step);
            try {
                const agent = this.getAgent(step.agent) || this.getAgent('orchestrator');
                let result = "";
                if (agent) {
                    result = await agent.execute(step.description);
                }
                else {
                    result = "Agent not found.";
                }
                step.status = 'completed';
                step.result = result;
                finalResult += `[Step ${step.id} - ${step.agent}]:\n${result}\n\n`;
            }
            catch (e) {
                step.status = 'failed';
                step.result = e.message;
                finalResult += `[Step ${step.id} Failed]: ${e.message}\n`;
            }
            if (emitEvent)
                emitEvent('plan_step_update', step);
        }
        return finalResult;
    }
    async delegate(agentName, task) {
        const agent = this.getAgent(agentName);
        if (!agent) {
            throw new Error(`Agent '${agentName}' not found.`);
        }
        return await agent.execute(task);
    }
}
export const agentManager = new AgentManager();
