import { IAgent } from './types.js';
import { Logger } from '../utils/logger.js';
import { agentManager } from './AgentManager.js';
import { chat } from '../core/llm_client.js';

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

Standard Workflow Patterns:
1. Idea Stage: Use 'orchestrator' or 'project_conductor' for initial planning.
2. Architecture: Use 'agent_architect' to design the solution and prompts.
3. Implementation: Use 'developer' or 'coder' to write the code.
4. Automation/Web: Use 'robotkez' for browser-based tasks. 
5. External Flows: Use 'n8n_trigger_workflow' for complex external automations.
6. Verification: Use 'evaluator' or 'qa' to check the results.

Available agents:
${agents}

User Request: "${task}"

Instructions:
1. Analyze the request and determine the best workflow pattern.
2. Select the most suitable agents. 
3. If it involves a browser, ALWAYS include 'robotkez'.
4. If it involves new agents or prompts, include 'agent_architect'.
5. Output a JSON array of tasks in this format:
[
  { "agent": "AgentName", "description": "precise task description", "context": { "key": "value" } }
]

Respond ONLY with the JSON array. Do not add markdown blocks.

Language Rule:
- Always respond in HUNGARIAN (magyarul) unless the user specifically asks in another language.
- The 'description' fields in the JSON tasks should also be in Hungarian.
`;

            const model = context?.model;
            const provider = context?.provider;

            const responseText = await chat(prompt, undefined, model, provider);
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