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
            const prompt = `
You are the Orchestrator of the Brunella Agent System. 
Your goal is to break down the user request into a list of tasks for specialized agents.

Available agents:
- Researcher: Finds information on the web (Harvester).
- DataScientist: Cleans and structures data (Refiner).

User Request: "${task}"

Output a JSON array of tasks in this format:
[
  { "agent": "Researcher", "description": "task description", "context": {} },
  { "agent": "DataScientist", "description": "refine: ...", "context": { "source": "..." } }
]

Respond ONLY with the JSON array.
`;

            const responseText = await chatWithOllama(prompt, undefined, 'gemma3:12b');
            this.logger.info(`Raw Plan: ${responseText}`);

            // 2. Parse and Queue tasks
            try {
                const tasks = JSON.parse(responseText.match(/\[.*\]/s)?.[0] || '[]');
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
                return { status: "error", error: "Failed to parse LLM plan." };
            }

        } catch (e: any) {
            return { status: "error", error: e.message };
        }
    }
}
