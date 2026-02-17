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
    keywords: ["lint", "eslint", "format", "type error", "típushiba", "szintaktika", "formázás"],
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
      "weboldal",
      "robotkéz"
    ],
    agent: "robotkezv2",
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
      "állapot",
      "működik",
      "rendszerellenőrzés"
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
      "információ",
      "nézz utána"
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
      "fejleszt",
      "programozz",
      "alkalmazás",
      "funkció"
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
      "rendszerez",
      "takaríts"
    ],
    agent: "project_organizer",
  },
  {
    keywords: ["spec", "ötlet", "idea", "generate track", "requirement", "terv", "leírás", "dokumentáció"],
    agent: "SpecWriter",
  },
  {
    keywords: [
      "conductor",
      "projekt státusz",
      "project status",
      "track status",
      "hogy állunk",
      "mi újság",
      "haladás"
    ],
    agent: "ProjectConductor",
  },
  { keywords: ["voice", "hang", "audio", "hangutasítás", "beszélj"], agent: "voice" },
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
   * Kiterjesztve: Automatikus javítási ciklus (Self-healing loop)
   */
  private initPhoenixListeners(): void {
    phoenixEventBus.subscribe('phoenix:agent_failed', async (evt) => {
      this.failedDuringSession.add(evt.agentName.toLowerCase());
      this.logger.info(
        `Phoenix: Agent '${evt.agentName}' failed. Orchestrator attempting self-healing...`,
      );

      // Ha nem a Developer Agent bukott el, kérjük meg a Developert, hogy javítsa ki
      if (evt.agentName.toLowerCase() !== 'developer') {
        const fixTask = `HIBA JAVÍTÁSA: A(z) ${evt.agentName} ügynök hibát jelzett: "${evt.error}". Elemezd a hiba okát és javítsd ki a kódot vagy konfigurációt.`;
        try {
          const id = await agentManager.queueTask(fixTask, 'developer', {
            originalError: evt.error,
            failedAgent: evt.agentName,
            autoFix: true
          });
          this.logger.info(`Self-healing: Fix task queued for Developer (ID: ${id})`);
        } catch (e) {
          this.logger.error(`Self-healing: Failed to queue fix task: ${e}`);
        }
      }
    });

    phoenixEventBus.subscribe('phoenix:failover_result', (evt) => {
      if (evt.success) {
        // Clear from failed set — agent was rescued by failover
        this.failedDuringSession.delete(evt.originalAgent.toLowerCase());
        this.logger.info(`Phoenix: Agent '${evt.originalAgent}' successfully recovered via failover.`);
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
You are PROACTIVE, professional, and you speak fluent HUNGARIAN.

Available agents:
${agents}

Available specialized tools (via MCP):
- GitHub Copilot: Use for complex code generation, refactoring, and AI-assisted debugging.
- Web Search (Google/Brave): Use for finding real-time information, documentation, and troubleshooting.
- GitHub: Use for creating issues, pull requests, and managing repository state.
- n8n: Use for automated workflows and external service integrations.
- Knowledge Graph / Memory: Use for long-term project context and structured memory.

User Request: "${task}"

Instructions:
1. Analyze the request.
2. Select the best agent(s) for the job.
3. If the request is about checking health, tests, or system audit, use Evaluator.
4. If the request is about web search, RAG, or summarizing knowledge, use Researcher.
5. If the request is about code generation, fixing bugs, or self-healing, use Developer. 
   - Protip: If the task is complex, instruct Developer to use Copilot tools.
6. If the request is about browser automation, web interaction, or opening URLs, use robotkezv2.
7. If the request is about project structure, map updates, board organization or directory analysis, use project_organizer.
8. If the request is about linting or TypeScript micro-fixes, use lint_fixer.

IMPORTANT: If the user says "Delegate X to Agent Y" or "Have Agent Y do X", respect that explicit assignment.

Output a JSON array of tasks in this format:
[
  { "agent": "AgentName", "description": "precise task description in Hungarian", "context": { "key": "value" } }
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
