"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentManager = exports.AgentManager = void 0;
const logger_js_1 = require("../utils/logger.js");
const rag_js_1 = require("../utils/rag.js");
const llmPipeline_js_1 = require("../pipeline/llmPipeline.js");
const llm_js_1 = require("../utils/llm.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const logger = new logger_js_1.Logger('agent-manager.log');
class AgentManager {
    agents = {};
    definitions = {};
    constructor() {
        this.loadRegistry();
        this.registerBuiltInAgents();
    }
    loadRegistry() {
        const registryPath = path_1.default.join(process.cwd(), "src", "agents", "registry.json");
        try {
            const raw = fs_1.default.readFileSync(registryPath, "utf-8");
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
                const results = await (0, rag_js_1.searchRAG)(task, 5);
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
                const pipeline = new llmPipeline_js_1.SelfHealingPipeline();
                try {
                    const code = await pipeline.run(task);
                    return `Sikeres kódgenerálás:\n\n${code}`;
                }
                catch (e) {
                    return `Hiba a fejlesztés során: ${e.message}`;
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
        // 3. OPS ÜGYNÖK (Ops Agent)
        this.registerAgent({
            name: "ops",
            description: "Rendszer állapot és logok felügyelete.",
            capabilities: ["monitoring", "diagnostics"],
            execute: async (task) => {
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
            execute: async (task) => {
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
            execute: async (task) => {
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
        const response = await (0, llm_js_1.chatWithOllama)(userPrompt, systemPrompt);
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
exports.AgentManager = AgentManager;
exports.agentManager = new AgentManager();
