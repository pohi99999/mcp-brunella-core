import { IAgent } from "./types.js";
import { Logger } from "../utils/logger.js";
import { agentManager } from "./AgentManager.js";
import { chatWithOllama } from "../core/llm_client.js";

export class OrchestratorAgent implements IAgent {
  name = "Orchestrator";
  role = "Planner & Dispatcher";
  description =
    "The central intelligence that plans and delegates tasks to other agents.";
  capabilities = ["plan", "delegate", "analyze_intent"];

  private logger: Logger;

  constructor() {
    this.logger = new Logger("orchestrator.log");
  }

  async execute(task: string, context?: any): Promise<any> {
    this.logger.info(`Orchestrating task: ${task}`);

    try {
      // Dynamically list available agents
      const agents = agentManager
        .listAgentDefinitions()
        .filter((a) => a.name !== "Orchestrator") // Don't delegate to self recursively
        .map((a) => `- ${a.name}: ${a.description} (Role: ${a.role})`)
        .join("\n");

      const prompt = `
You are the Orchestrator of the Brunella Agent System. 
Your goal is to break down the user request into a list of tasks for specialized agents.

Available agents:
${agents}

User Request: "${task}"

Instructions:
1. Analyze the request.
2. Select the best agent(s) for the job.
3. If the request is about checking health, tests, or system audit, use Evaluator.
4. If the request is about web search, RAG, or summarizing knowledge, use Researcher.
5. If the request is about code generation, fixing bugs, or self-healing, use Developer.
6. If the request is about browser automation, web interaction, or opening URLs, use Robotkez.
7. If the request is about project structure, map updates, board organization or directory analysis, use project_organizer.
8. If the request is about linting or TypeScript micro-fixes, use lint_fixer.

IMPORTANT: If the user says "Delegate X to Agent Y" or "Have Agent Y do X", respect that explicit assignment.

Output a JSON array of tasks in this format:
[
  { "agent": "AgentName", "description": "precise task description", "context": { "key": "value" } }
]

Respond ONLY with the JSON array. Do not add markdown blocks.
`;

      const responseText = await chatWithOllama(
        prompt,
        process.env.OLLAMA_MODEL || "gemma2:9b",
      );
      this.logger.info(`Raw Plan: ${responseText}`);

      // 2. Parse and Queue tasks
      try {
        // Remove markdown blocks if present
        const cleanJson = responseText
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
        const tasks = JSON.parse(cleanJson.match(/.*\[.*\]/s)?.[0] || "[]");

        const taskIds: number[] = [];

        for (const t of tasks) {
          const id = await agentManager.queueTask(
            t.description,
            t.agent,
            t.context,
          );
          taskIds.push(id);
        }

        return {
          success: true,
          status: "success",
          message: `Plan created with ${taskIds.length} tasks.`,
          taskIds,
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

export default OrchestratorAgent;
