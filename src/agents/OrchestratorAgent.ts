import { IAgent, AgentResponse, ChainStep, ChainContext } from "./types.js";
import { Logger, logInfo, logError, logDebug, setAgentStatus } from "../utils/logger.js";
import { ensureError } from "../utils/ensureError.js";
import { agentManager } from "./AgentManager.js";
import { getBifrostGateway } from "../core/bifrost_gateway.js";
import { phoenixEventBus } from "../core/phoenixEventBus.js";
import { socketService } from "../server/SocketService.js";
import { AgentStateMachine, type StateNode, type Transition } from '../core/agentStateMachine.js';
import { clearCheckpoints } from '../core/checkpoint.js';
import { guardAgentResponseOutput } from '../core/outputGuard.js';
import { ReActExecutor, type ReActAction, type ReActObservation } from '../core/reactLoop.js';
import { classifyToolError, formatToolObservation } from '../core/toolErrorClassifier.js';

// Magyar gyors-válasz táblázat a keyword routing ághoz
const QUICK_REPLIES: Record<string, string> = {
  lint_fixer: "Rendben, átfésülöm a kódot és kijavítom a hibákat.",
  robotkez: "Elindítom a böngészőügynököt a feladathoz.",
  developer: "Rendben, elindítom a fejlesztési feladatot!",
  DeveloperAgent: "Rendben, elindítom a fejlesztési feladatot!",
  researcher: "Kutatást azonnal megkezdem, hamarosan ered­ménnyel jövök.",
  ResearcherAgent: "Kutatást azonnal megkezdem, hamarosan eredménnyel jövök.",
  evaluator: "Elindítom a kód kiértékelési folyamatot.",
  EvaluatorAgent: "Elindítom a kód kiértékelési folyamatot.",
  DataScientist: "Adatelemzési feladatot kezdek el.",
  HeadHunterAgent: "HR feladatot kap a HeadHunter ügynök.",
  SalesAgent: "Az értékesítési ügynököt aktiválom.",
  CopywriterAgent: "A szövegírói ügynököt indítom.",
  EmailTriageAgent: "E-mail rendezési feladatot delegálok.",
  LogisticsDispatcherAgent: "A logisztikai ügynököt küldöm.",
};

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

export type OrchestratorState =
  | 'IDLE' | 'ANALYZING' | 'ROUTING' | 'EXECUTING' | 'DONE' | 'ERROR' | 'FAILED';

const ORCH_STATES: StateNode<OrchestratorState>[] = [
  { name: 'IDLE' },
  { name: 'ANALYZING' },
  { name: 'ROUTING' },
  { name: 'EXECUTING' },
  { name: 'DONE' },
  { name: 'ERROR' },
  { name: 'FAILED' },
];

const ORCH_TRANSITIONS: Transition<OrchestratorState>[] = [
  { from: 'IDLE',      to: 'ANALYZING', event: 'taskReceived' },
  { from: 'ANALYZING', to: 'ROUTING',   event: 'analysisComplete' },
  { from: 'ROUTING',   to: 'EXECUTING', event: 'agentSelected' },
  { from: 'EXECUTING', to: 'DONE',      event: 'executionComplete' },
  { from: 'ANALYZING', to: 'ERROR',     event: 'errorOccurred' },
  { from: 'ROUTING',   to: 'ERROR',     event: 'errorOccurred' },
  { from: 'EXECUTING', to: 'ERROR',     event: 'errorOccurred' },
  { from: 'ERROR',     to: 'ANALYZING', event: 'retry',
    guard: (ctx) => ctx.retryCount < 3 },
  { from: 'ERROR',     to: 'FAILED',    event: 'giveUp',
    guard: (ctx) => ctx.retryCount >= 3 },
];

const ORCHESTRATOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "delegate_task",
      description: "Feladat kiosztása egy adott ügynöknek. A feladat a háttérben indul el.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Az ügynök neve (pl. 'robotkezv2', 'developer')." },
          instruction: { type: "string", description: "A feladat pontos leírása." }
        },
        required: ["agent_name", "instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_agent_status",
      description: "Egy adott ügynök státuszának lekérdezése.",
      parameters: {
        type: "object",
        properties: {
          agent_name: { type: "string", description: "Az ügynök neve." }
        },
        required: ["agent_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_message_to_user",
      description: "Közvetlen üzenet küldése a felhasználónak a Dashboard chaten.",
      parameters: {
        type: "object",
        properties: {
          message: { type: "string", description: "A felhasználónak szánt üzenet." }
        },
        required: ["message"]
      }
    }
  }
];

type OrchestratorToolCall = {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
};

type OrchestratorAssistantMessage = {
  role: 'assistant';
  content: string;
  tool_calls?: OrchestratorToolCall[];
};

type OrchestratorMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | OrchestratorAssistantMessage
  | { role: 'tool'; content: string; tool_call_id: string; name: string };

type OrchestratorRuntimeAction = ReActAction & { toolCallId: string };

export class OrchestratorAgent implements IAgent {
  name = "Orchestrator";
  role = "Planner & Dispatcher";
  description =
    "The central intelligence that plans and delegates tasks to other agents.";
  capabilities = ["plan", "delegate", "analyze_intent"];

  private logger: Logger;
  private failedDuringSession: Set<string> = new Set();
  private currentMachine: AgentStateMachine<OrchestratorState> | null = null;

  getCurrentState(): OrchestratorState {
    return this.currentMachine?.getState() ?? 'IDLE';
  }

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
        } catch (error: unknown) {
          const err = ensureError(error);
          this.logger.error(`Self-healing: Failed to queue fix task: ${err.message}`);
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
      } catch (error: unknown) {
        const err = ensureError(error);
        logError("OrchestratorAgent", `[Chain] Step ${i + 1} kivétel: ${err.message}`);
        setAgentStatus("OrchestratorAgent", "idle");
        return {
          status: "error",
          error: `Chain leállt a(z) ${i + 1}. lépésnél (${step.agentName}): ${err.message}`,
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

    const taskId = `orch-${Date.now()}`;
    const machine = new AgentStateMachine<OrchestratorState>(
      ORCH_STATES,
      ORCH_TRANSITIONS,
      'IDLE',
      taskId,
    );
    this.currentMachine = machine;
    machine.updateContext({ task, retryCount: 0 });
    setAgentStatus('OrchestratorAgent', 'working', task.slice(0, 50));

    try {
      await machine.transition('taskReceived');  // IDLE → ANALYZING

      // === STUDIO MODE ===
      if (context?.studioMode && context?.rootDir) {
        this.logger.info(`Studio mode detected — routing to developer agent (rootDir: ${context.rootDir})`);
        machine.updateContext({ agentName: 'developer' });
        await machine.transition('analysisComplete'); // ANALYZING → ROUTING
        await machine.transition('agentSelected');    // ROUTING → EXECUTING
        const studioTaskId = await agentManager.queueTask(task, 'developer', context);
        await machine.transition('executionComplete'); // EXECUTING → DONE
        return guardAgentResponseOutput({ status: 'success', message: 'Studio feladat kiosztva a Fejlesztő ügynöknek.', taskId: studioTaskId } as AgentResponse, this.name);
      }

      // === FAST PATH: keyword pre-routing (no LLM needed) ===
      const kwMatch = this.keywordRoute(task);
      const isCompound =
        /\b(?:and|then|after that|also|plus|meg |aztán|majd|valamint|utána)\b/i.test(task);

      await machine.transition('analysisComplete'); // ANALYZING → ROUTING

      if (kwMatch && (kwMatch.hits >= 99 || !isCompound)) {
        this.logger.info(`Keyword pre-route → ${kwMatch.agent} (hits: ${kwMatch.hits})`);
        machine.updateContext({ agentName: kwMatch.agent });
        await machine.transition('agentSelected');   // ROUTING → EXECUTING
        const id = await agentManager.queueTask(task, kwMatch.agent, context ?? undefined);
        const quickReply = QUICK_REPLIES[kwMatch.agent] || `Delegálom a feladatot a(z) ${kwMatch.agent} ügynöknek.`;
        socketService.broadcastChatter('Brunella', quickReply, 'user');
        await machine.transition('executionComplete'); // EXECUTING → DONE
        return guardAgentResponseOutput({
          success: true,
          status: 'success',
          message: quickReply,
          taskIds: [id],
          routing: 'keyword',
        } as AgentResponse, this.name);
      }

      // === REACT PATH: LLM-based Tool Calling Loop ===
      this.logger.info('Starting ReAct Execution Loop');
      machine.updateContext({ agentName: 'llm-react' });
      await machine.transition('agentSelected');   // ROUTING → EXECUTING

      const agents = agentManager
        .listAgentDefinitions()
        .filter((a) => a.name !== 'Orchestrator')
        .map((a) => `- ${a.name}: ${a.description} (Role: ${a.role})`)
        .join('\n');

      const systemPrompt = `
Te vagy Brunella, a Brunella Agent System (BAS) intelligens, proaktív központi "agya" és Orchestrator ügynöke. Te vagy a rendszer elsődleges kapcsolattartója a Mesterrel (a felhasználóval).

A feladatod kettős:
1. **Intelligens Társalgópartner:** Bármiről cseveghetsz a felhasználóval (időjárás, tech hírek, filozófia, stb.) teljesen természetes, emberi módon. Te egy okos, segítőkész és barátságos entitás vagy.
2. **Központi Diszpécser:** Ha a felhasználó egy technikai vagy végrehajtandó feladatot kér (pl. "keress rá erre a neten", "írj egy kódot", "nyisd meg a böngészőt"), a feladatod, hogy a megfelelő ügynökök mozgósításával ELVÉGEZD a feladatot a rendelkezésedre álló eszközök (tools) segítségével.

**Személyiség és Stílus:**
- Professzionális, udvarias, de határozott mérnöki vezető (Senior Systems Architect / Dispatcher).
- Csevegés esetén légy közvetlen és érdeklődő.
- Nem csak "tervezel", hanem azonnal **cselekedsz** is az eszközök meghívásával.
- Ha egy feladatot háttérbe küldesz, azonnal tájékoztasd a felhasználót a 'send_message_to_user' eszközzel, vagy a végső válaszodban (pl. "Értettem. Elindítottam a RobotkezV2-t a háttérben. Szólok, ha végzett.").
- **SOHA** ne adj vissza nyers JSON feladatlistát vagy markdown formázott JSON-t válaszként. Csak természetes nyelven kommunikálj!
- **SOHA** ne generálj Markdown execution planeket (pl. 'design', 'implementation', 'test' fázisokkal), ha a felhasználó egy azonnali, futtatható parancsot kér (pl. 'Nyisd meg a böngészőt').
- **Azonnali Cselekvés:** Ha a kérés egyértelmű (pl. "Nyisd meg a böngészőt"), AZONNAL hívd meg a 'delegate_task' eszközt a 'robotkezv2' ügynökkel, 'start_browser' vagy 'navigate' instrukcióval, felesleges feladatbontás nélkül.

**Elérhető Ügynökök (akiknek delegálhatsz a 'delegate_task' eszközzel ha kell):**
${agents}

**Specifikus Tudásbázis:**
- **Böngészés / Web Interakciók:** Ha a felhasználó böngészni akar vagy információt letölteni, mindig a 'robotkezv2' ügynöknek delegálj.
- **n8n / Langflow:** Canvas-alapú UI rendszerek. Az összetett feladatokat a 'robotkezv2' ügynöknek kell kiadnod. Bontsd le a kérést kis lépésekre a 'delegate_task' használatakor.

**ReAct Működés (Hogyan használd az eszközeidet):**
1. Kapod a kérést. Döntsd el, hogy ez egy egyszerű kérdés/csevegés, vagy egy feladat, amit delegálni kell.
2. Ha feladatot kell kiosztani, használd a 'delegate_task' eszközt. Ezt többször is megteheted különböző ügynökök felé.
3. Ha állapotra van szükséged a rendszerben futó ügynökökről, használd a 'get_agent_status' eszközt.
4. Ha üzenetet akarsz küldeni a Dashboardra folyamat közben, használd a 'send_message_to_user'-t.
5. Ha minden szükséges eszközt meghívtál, vagy ha a feladat csak egy kérdés volt, adj egy végső, emberi választ.
`;

      const messages: OrchestratorMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: task }
      ];

      const gateway = getBifrostGateway();
      const MAX_ITERATIONS = 5;
      let finalMessage = 'A feladatot feldolgoztam.';
      const taskIds: number[] = [];

      const reactExecutor = new ReActExecutor(MAX_ITERATIONS);
      const reactResult = await reactExecutor.execute({
        reason: async (_scratchpad, cycle) => {
          this.logger.info(`ReAct iteráció ${cycle}/${MAX_ITERATIONS}`);

          const response = await gateway.generate({
            prompt: task,
            taskType: 'general',
            model: 'gpt-4.1',
            tools: ORCHESTRATOR_TOOLS,
            messages,
            userId: context?.userId as string | undefined,
          });

          if (!response.success) {
            throw new Error(response.error ?? 'Hiba az LLM kommunikációban.');
          }

          const { content = '', toolCalls } = response;
          const assistantMessage: OrchestratorAssistantMessage = { role: 'assistant', content };
          if (toolCalls && toolCalls.length > 0) {
            assistantMessage.tool_calls = toolCalls;
          }
          messages.push(assistantMessage);

          if (!toolCalls || toolCalls.length === 0) {
            return {
              thought: content || 'Közvetlen válasz elkészült.',
              done: true,
              finalMessage: content,
            };
          }

          const actions: OrchestratorRuntimeAction[] = toolCalls.map((toolCall) => {
            let parsedArguments: Record<string, unknown> = {};
            try {
              const rawParsed: unknown = JSON.parse(toolCall.function.arguments);
              if (typeof rawParsed === 'object' && rawParsed !== null) {
                parsedArguments = rawParsed as Record<string, unknown>;
              }
            } catch (error: unknown) {
              const descriptor = classifyToolError({ status: 400, message: `Invalid tool arguments for ${toolCall.function.name}: ${error instanceof Error ? error.message : String(error)}` });
              return {
                name: toolCall.function.name,
                params: {
                  __parseError: descriptor.message,
                },
                toolCallId: toolCall.id,
              };
            }

            return {
              name: toolCall.function.name,
              params: parsedArguments,
              toolCallId: toolCall.id,
            };
          });

          return {
            thought: content || `Tool-hívások szükségesek (${actions.length})`,
            actions,
          };
        },
        act: async (action): Promise<ReActObservation> => {
          const runtimeAction = action as OrchestratorRuntimeAction;
          const params = runtimeAction.params ?? {};
          const name = runtimeAction.name;

          if (typeof params.__parseError === 'string') {
            const descriptor = classifyToolError({ status: 400, message: params.__parseError });
            const observation = formatToolObservation(descriptor);
            messages.push({
              role: 'tool',
              tool_call_id: runtimeAction.toolCallId,
              name,
              content: observation,
            });
            return {
              success: false,
              summary: observation,
              error: descriptor,
              planRevision: descriptor.planRevision,
            };
          }

          this.logger.info(`Tool meghívva: ${name} paraméterekkel: ${JSON.stringify(params)}`);

          try {
            let toolResult = '';

            if (name === 'delegate_task') {
              const id = await agentManager.queueTask(
                String(params.instruction ?? ''),
                String(params.agent_name ?? ''),
                context ?? undefined,
              );
              taskIds.push(id);
              toolResult = `Feladat sikeresen delegálva. Task ID: ${id}`;
            } else if (name === 'get_agent_status') {
              const statuses = agentManager.listAgentStatuses();
              const agentName = String(params.agent_name ?? '').toLowerCase();
              const status = statuses.find((item) => item.name.toLowerCase() === agentName);
              toolResult = status ? JSON.stringify(status) : `Ügynök nem található: ${params.agent_name}`;
            } else if (name === 'send_message_to_user') {
              socketService.broadcastChatter('Brunella', String(params.message ?? ''), 'user');
              toolResult = 'Üzenet sikeresen elküldve.';
            } else {
              const descriptor = classifyToolError({ status: 404, message: `Ismeretlen eszköz: ${name}` });
              const observation = formatToolObservation(descriptor);
              messages.push({
                role: 'tool',
                tool_call_id: runtimeAction.toolCallId,
                name,
                content: observation,
              });
              return {
                success: false,
                summary: observation,
                error: descriptor,
                planRevision: descriptor.planRevision,
              };
            }

            messages.push({
              role: 'tool',
              tool_call_id: runtimeAction.toolCallId,
              name,
              content: toolResult,
            });

            return {
              success: true,
              summary: toolResult,
              payload: { tool: name, params },
            };
          } catch (toolErr: unknown) {
            const descriptor = classifyToolError(toolErr);
            const observation = formatToolObservation(descriptor);
            this.logger.error(`Tool error (${name}): ${observation}`);

            messages.push({
              role: 'tool',
              tool_call_id: runtimeAction.toolCallId,
              name,
              content: observation,
            });

            return {
              success: false,
              summary: observation,
              error: descriptor,
              planRevision: descriptor.planRevision,
            };
          }
        },
      });

      if (!reactResult.success) {
        try {
          await machine.transition('errorOccurred');
        } catch (error: unknown) {
          const err = ensureError(error);
          logDebug('OrchestratorAgent', `Ignoring invalid transition after ReAct failure: ${err.message}`);
        }
        return guardAgentResponseOutput({
          status: 'error',
          error: reactResult.finalMessage ?? 'A ReAct végrehajtás nem tudta sikeresen lezárni a feladatot.',
          taskIds,
          steps: taskIds,
          data: {
            reactScratchpad: reactResult.scratchpad,
            terminatedReason: reactResult.terminatedReason,
            taskIds,
          },
        } as AgentResponse, this.name);
      }

      if (reactResult.finalMessage) {
        finalMessage = reactResult.finalMessage;
        socketService.broadcastChatter('Brunella', finalMessage, 'user');
      }

      await machine.transition('executionComplete'); // EXECUTING → DONE
      return guardAgentResponseOutput({
        success: true,
        status: 'success',
        message: finalMessage,
        taskIds,
        steps: taskIds,
        data: {
          reactScratchpad: reactResult.scratchpad,
          terminatedReason: reactResult.terminatedReason,
        },
      } as AgentResponse, this.name);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      logError('OrchestratorAgent', `State machine error: ${msg}`);
      // Attempt to move machine to ERROR state for observability
      try {
        await machine.transition('errorOccurred');
      } catch (error: unknown) {
        const err = ensureError(error);
        logDebug('OrchestratorAgent', `Ignoring invalid error transition: ${err.message}`);
      }
      return guardAgentResponseOutput({ status: 'error', error: msg } as AgentResponse, this.name);
    } finally {
      setAgentStatus('OrchestratorAgent', 'idle');
      this.currentMachine = null;
      clearCheckpoints(taskId).catch((error: unknown) => {
        const err = ensureError(error);
        logDebug('OrchestratorAgent', `Ignoring cleanup error: ${err.message}`);
      });
    }
  }
}

export default OrchestratorAgent;
