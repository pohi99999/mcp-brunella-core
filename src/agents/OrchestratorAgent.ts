import { IAgent } from './types.js';
import { Logger } from '../utils/logger.js';
import { agentManager } from './AgentManager.js';
import { chatWithOllama } from '../core/llm_client.js';

export class OrchestratorAgent implements IAgent {
    name = "Orchestrator";
    role = "Planner & Dispatcher";
    description = "The central intelligence that plans and delegates tasks to other agents.";
    capabilities = ["plan", "delegate", "analyze_intent"];
    
    private logger: Logger;

    constructor() {
        this.logger = new Logger('orchestrator.log');
    }

    async execute(task: string, context?: any): Promise<any> {
        this.logger.info(`Orchestrating task: ${task}`);

        try {
            // Dynamically list available agents
            const agents = agentManager.listAgentDefinitions()
                .filter(a => a.name !== 'Orchestrator') // Don't delegate to self recursively
                .map(a => `- ${a.name}: ${a.description} (Role: ${a.role})`)
                .join('\n');

            const prompt = `
You are the Orchestrator of the Brunella Agent System. 
Your goal is to break down the user request into a list of tasks for specialized agents.

Available agents:
${agents}

User Request: "${task}"

Instructions:
1. Analyze the request.
2. Select the best agent(s) for the job.
3. If the request is about checking health or tests, use Evaluator.
4. If the request is about web search, use Researcher.
5. If the request is about data cleaning, use DataScientist.
6. If the request is about writing or running python code, use Developer.

Output a JSON array of tasks in this format:
[
  { "agent": "AgentName", "description": "precise task description", "context": { "key": "value" } }
]

Respond ONLY with the JSON array. Do not add markdown blocks.
`;

            const responseText = await chatWithOllama(prompt, process.env.OLLAMA_MODEL || 'gemma2:9b');
            this.logger.info(`Raw Plan: ${responseText}`);

            // 2. Parse and Queue tasks
            try {
                // Remove markdown blocks if present
                const cleanJson = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
                const tasks = JSON.parse(cleanJson.match(/.*\[.*\]/s)?.[0] || '[]');
                
                const taskIds: number[] = [];

                for (const t of tasks) {
                    const id = agentManager.queueTask(t.description, t.agent, t.context);
                    taskIds.push(id);
                }

                return {
                    status: "success",
                    message: `Plan created with ${taskIds.length} tasks.`, 
                    taskIds
                };
            } catch (parseErr) {
                this.logger.error(`Plan parsing failed. Raw: ${responseText}`);
                return { status: "error", error: "Failed to parse LLM plan." };
            }

        } catch (e: any) {
            return { status: "error", error: e.message };
        }
    }
}