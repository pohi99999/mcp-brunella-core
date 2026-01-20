"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentManager = exports.AgentManager = void 0;
const logger_js_1 = require("../utils/logger.js");
const rag_js_1 = require("../utils/rag.js");
const llmPipeline_js_1 = require("../pipeline/llmPipeline.js");
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
}
exports.AgentManager = AgentManager;
exports.agentManager = new AgentManager();
