import { IAgent, AgentResponse, ChainStep, ChainContext } from "./types.js";
import { Logger, logInfo, logError, setAgentStatus } from "../utils/logger.js";
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

  /**
   * Szekvenciális chain pipeline: minden lépés outputja a következő lépés kontextusa.
   * Ha bármely lépés status: 'error' → a chain leáll, hibaüzenettel tér vissza.
   */
  async executeChain(
    steps: ChainStep[],
    metadata: Record<string, unknown> = {},
  ): Promise<AgentResponse> {
    this.logger.info(`[Chain] Indítás: ${steps.length} lépés`);
    const accumulated: AgentResponse[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      const chainContext: ChainContext = {
        steps,
        currentStep: i,
        accumulated: [...accumulated], // snapshot — nem mutálható referencia
        metadata,
      };

      setAgentStatus(
        "OrchestratorAgent",
        "working",
        `Chain ${i + 1}/${steps.length}: ${step.agentName}`,
      );
      this.logger.info(
        `[Chain] Step ${i + 1}/${steps.length}: ${step.agentName} → "${step.task.slice(0, 60)}"`,
      );

      let result: unknown;
      try {
        result = await agentManager.delegate(step.agentName, step.task, {
          chainContext: chainContext as unknown as Record<string, unknown>,
          ...metadata,
        });
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("OrchestratorAgent", `[Chain] Step ${i + 1} kivétel: ${msg}`);
        setAgentStatus("OrchestratorAgent", "idle");
        return {
          status: "error",
          error: `Chain leállt a(z) ${i + 1}. lépésnél (${step.agentName}): ${msg}`,
          data: { accumulated, failedStep: i },
        };
      }

      // AgentResponse-ként kezeljük az eredményt
      const response = (
        result && typeof result === "object" && "status" in result
          ? result
          : { status: "success", data: result }
      ) as AgentResponse;

      accumulated.push(response);

      if (response.status === "error") {
        this.logger.error(
          `[Chain] Step ${i + 1} hiba (${step.agentName}): ${response.error}`,
        );
        setAgentStatus("OrchestratorAgent", "idle");
        return {
          status: "error",
          error: `Chain leállt a(z) ${i + 1}. lépésnél (${step.agentName}): ${response.error}`,
          data: { accumulated, failedStep: i },
        };
      }

      this.logger.info(`[Chain] Step ${i + 1} kész ✓`);
    }

    setAgentStatus("OrchestratorAgent", "idle");
    this.logger.info(`[Chain] Kész: ${steps.length} lépés sikeresen végrehajtva`);

    return {
      status: "success",
      message: `Chain kész: ${steps.length} lépés sikeresen végrehajtva.`,
      data: {
        stepsCount: steps.length,
        results: accumulated,
        finalOutput: accumulated[accumulated.length - 1],
      },
    };
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
You are Brunella, the intelligent Project Manager of the Brunella Agent System.
Your goal is to understand the user's intent (written in Hungarian) and orchestrate the right agents to fulfill it.

**Persona:**
- Name: Brunella
- Language: Hungarian (Magyar)
- Tone: Professional, helpful, concise, and proactive.
- Role: You are the bridge between the human creative director and the specialized AI agents.

**Available Agents:**
${agents}

**Specialized Tools (via MCP):**
- GitHub Copilot, Web Search, n8n, Knowledge Graph.

**User Request:** "${task}"

**Instructions:**
1. Analyze the request.
2. Select the best agent(s).
3. Generate a plan.

**Output Format:**
You must provide a JSON object with two fields:
1. "reply": A short, friendly Hungarian message to the user confirming what you are about to do (e.g., "Rendben, elindítom a kutatást...").
2. "tasks": The JSON array of tasks for the agents.

Example JSON:
{
  "reply": "Értettem, ráállítom a Fejlesztőt a hiba javítására.",
  "tasks": [
    { "agent": "developer", "description": "Fix the bug in app.ts", "context": { "file": "app.ts" } }
  ]
}

Respond ONLY with the valid JSON object. No markdown blocks.
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
        
        let tasks = [];
        let reply = "";

        try {
            const parsed = JSON.parse(cleanJson);
            if (Array.isArray(parsed)) {
                tasks = parsed;
                reply = `Feldolgozva: ${tasks.length} feladat generálva.`;
            } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
                tasks = parsed.tasks;
                reply = parsed.reply || "A feladatokat kiosztottam.";
            }
        } catch (e) {
            // Fallback: try to find array in string
            const match = cleanJson.match(/\[.*\]/s);
            tasks = JSON.parse(match ? match[0] : "[]");
            reply = "A terv elkészült.";
        }

        // Log the human-friendly reply (which should ideally be sent to UI via socket)
        this.logger.info(`[Brunella]: ${reply}`);

        // === COMPOUND TASK: szekvenciális chain pipeline ===
        if (isCompound && tasks.length > 1) {
          this.logger.info(
            `[Chain] Compound feladat → chain pipeline (${tasks.length} lépés)`,
          );
          const chainSteps: ChainStep[] = tasks.map(
            (t: { agent: string; description: string }) => ({
              agentName: t.agent,
              task: t.description,
            }),
          );
          return await this.executeChain(chainSteps, context ?? {});
        }

        // === SIMPLE TASKS: párhuzamos queue (nem-compound) ===
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
