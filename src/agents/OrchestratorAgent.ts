import { IAgent } from "./types.js";
import { Logger } from "../utils/logger.js";
import { agentManager } from "./AgentManager.js";
import { chatWithOllama } from "../core/llm_client.js";
import { phoenixEventBus } from "../core/phoenixEventBus.js";

// ---------------------------------------------------------------------------
// Keyword pre-routing table (order: more specific → less specific)
// ---------------------------------------------------------------------------
const KEYWORD_ROUTES: ReadonlyArray<{
  keywords: readonly string[];
  agent: string;
}> = [
  {
    keywords: ["lint", "eslint", "format", "type error", "típushiba"],
    agent: "lint_fixer",
  },
  {
    keywords: [
      "böngésző",
      "browser",
      "kattints",
      "click",
      "navigate",
      "scrape",
      "screenshot",
      "nyisd meg",
      "tölts ki",
      "open url",
      "open page",
      "keress rá",
      "írj be",
      "keresd meg",
      "állítsd be",
      "nyomd meg",
      "válaszd ki",
      "görgess",
      "keresés a weben",
    ],
    agent: "robotkez",
  },
  {
    keywords: [
      "health",
      "test",
      "teszt",
      "audit",
      "check system",
      "diagnos",
      "ellenőriz",
      "smoke",
    ],
    agent: "evaluator",
  },
  {
    keywords: [
      "search",
      "rag",
      "keres",
      "kutat",
      "összefoglal",
      "summarize",
      "knowledge",
      "tudás",
      "web search",
    ],
    agent: "researcher",
  },
  {
    keywords: [
      "code",
      "kód",
      "bug",
      "fix",
      "javít",
      "implement",
      "refactor",
      "self-healing",
      "pipeline",
    ],
    agent: "developer",
  },
  {
    keywords: [
      "project structure",
      "directory",
      "mappa",
      "szervez",
      "organize",
      "könyvtár",
      "map update",
      "tartalomjegyzék",
    ],
    agent: "project_organizer",
  },
  {
    keywords: ["spec", "ötlet", "idea", "generate track", "requirement"],
    agent: "SpecWriter",
  },
  {
    keywords: [
      "conductor",
      "projekt státusz",
      "project status",
      "track status",
    ],
    agent: "ProjectConductor",
  },
  { keywords: ["voice", "hang", "audio", "hangutasítás"], agent: "voice" },
];

export class OrchestratorAgent implements IAgent {
  name = "Orchestrator";
  role = "Planner & Dispatcher";
  description =
    "The central intelligence that plans and delegates tasks to other agents.";
  capabilities = ["plan", "delegate", "analyze_intent"];

  private logger: Logger;
  private failedDuringSession: Set<string> = new Set();

  constructor() {
    this.logger = new Logger("orchestrator.log");
    this.initPhoenixListeners();
  }

  /**
   * Phoenix Protocol: Listen for agent failures and log them
   * so future routing can avoid recently-failed agents.
   */
  private initPhoenixListeners(): void {
    phoenixEventBus.subscribe('phoenix:agent_failed', (evt) => {
      this.failedDuringSession.add(evt.agentName.toLowerCase());
      this.logger.info(
        `Phoenix: Agent '${evt.agentName}' failed (tracked for re-routing avoidance)`,
      );
    });

    phoenixEventBus.subscribe('phoenix:failover_result', (evt) => {
      if (evt.success) {
        // Clear from failed set — agent was rescued by failover
        this.failedDuringSession.delete(evt.originalAgent.toLowerCase());
      }
    });
  }

  // -------------------------------------------------------------------------
  // FAST PATH: keyword pre-routing without LLM
  // -------------------------------------------------------------------------
  private keywordRoute(task: string): { agent: string; hits: number } | null {
    const lower = task.toLowerCase();

    // 1. Explicit delegation: "Delegate X to AgentY"
    const delegateMatch =
      lower.match(/delegat\w*\s+.*?\bto\s+(\w+)/i) ??
      lower.match(/have\s+(\w+)\s+(?:agent\s+)?do/i);
    if (delegateMatch) {
      const targetName = delegateMatch[1];
      const agents = agentManager.listAgentDefinitions();
      const found = agents.find(
        (a) => a.name.toLowerCase() === targetName.toLowerCase(),
      );
      if (found) return { agent: found.name, hits: 99 };
    }

    // 2. Keyword table scan — pick route with most keyword hits
    let best: { agent: string; hits: number } | null = null;
    for (const route of KEYWORD_ROUTES) {
      const hits = route.keywords.filter((kw) => lower.includes(kw)).length;
      if (hits > 0 && (!best || hits > best.hits)) {
        best = { agent: route.agent, hits };
      }
    }
    return best;
  }

  async execute(
    task: string,
    context?: Record<string, unknown>,
  ): Promise<unknown> {
    this.logger.info(`Orchestrating task: ${task}`);

    try {
      // === FAST PATH: keyword pre-routing (no LLM needed) ===
      // Skip for compound tasks that likely need multi-agent planning
      const kwMatch = this.keywordRoute(task);
      const isCompound =
        /\b(?:and|then|after that|also|plus|meg |aztán|majd|valamint|utána)\b/i.test(
          task,
        );
      if (kwMatch && (kwMatch.hits >= 99 || !isCompound)) {
        this.logger.info(
          `Keyword pre-route → ${kwMatch.agent} (hits: ${kwMatch.hits})`,
        );
        const id = await agentManager.queueTask(
          task,
          kwMatch.agent,
          context ?? undefined,
        );
        return {
          success: true,
          status: "success",
          message: `Direct route to ${kwMatch.agent} (keyword match, hits=${kwMatch.hits}).`,
          taskIds: [id],
          routing: "keyword",
        };
      }

      // === SLOW PATH: LLM-based planning for complex/ambiguous tasks ===
      this.logger.info("No keyword match — falling back to LLM planning");

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
      } catch (parseErr: unknown) {
        const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
        this.logger.error(`Plan parsing failed: ${msg}. Raw: ${responseText}`);
        return { status: "error", error: "Failed to parse LLM plan." };
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return { status: "error", error: msg };
    }
  }
}

export default OrchestratorAgent;
