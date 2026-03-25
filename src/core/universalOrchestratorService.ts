import { getBifrostGateway, type ProviderType } from './bifrost_gateway.js';
import { getToolRegistry } from './toolRegistry.js';
import { agentManager } from '../agents/AgentManager.js';
import { logInfo, logError, logWarn } from '../utils/logger.js';
import { GraphRagEngine } from './graphRagEngine.js';
import { ReflectionEngine } from './reflectionEngine.js';
import { PredictiveIntelligence } from './predictiveIntelligence.js';

export interface ActionTriggered {
  agent: string;
  task: string;
  taskId: number;
  status: 'started' | 'completed' | 'error';
}

export interface UniversalChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface UniversalRequest {
  message: string;
  provider: string;
  model?: string;
  conversationHistory: UniversalChatMessage[];
  sessionId?: string;
  userId?: string;
}

export interface UniversalResponse {
  reply: string;
  actionsTriggered: ActionTriggered[];
  provider: string;
  model?: string;
  role: 'orchestrator';
  thinkingMs: number;
  sessionId: string;
  suggestions?: string[];
  missionTimeline?: MissionTimelineEntry[];
  approvalRequired?: boolean;
  approvalId?: string;
  riskLevel?: 'low' | 'high';
  runbookHint?: string;
  fallbackUsed?: boolean;
  fallbackReason?: string;
  phoenixTriggered?: boolean;
}

export interface MissionTimelineEntry {
  phase: string;
  status: 'info' | 'started' | 'completed' | 'blocked';
  detail: string;
  timestamp: string;
  agent?: string;
  taskId?: number;
}

type ClarificationIntent = 'system_check';

interface PendingApproval {
  id: string;
  sessionId: string;
  originalMessage: string;
  createdAt: number;
  riskLevel: 'high';
}

interface RunbookMemoryEntry {
  workflow: string;
  executions: number;
  lastUsedAt: number;
  successfulSignals: number;
  agentComboStats: Record<string, number>;
  lastSummary?: string;
}

interface PendingClarification {
  intent: ClarificationIntent;
  originalMessage: string;
  askedAt: number;
}

interface SessionMemory {
  sessionId: string;
  createdAt: number;
  updatedAt: number;
  recentMessages: UniversalChatMessage[];
  recentIntents: string[];
  delegatedTaskIds: number[];
  pendingClarification?: PendingClarification;
  pendingApprovalId?: string;
  lastSystemCheckMode?: 'quick' | 'deep';
  lastSystemCheckAt?: number;
}

// Provider name mapping: UI name → Bifrost ProviderType
const PROVIDER_MAP: Record<string, ProviderType> = {
  gemini: 'gemini',
  github: 'github',
  claude: 'anthropic',
  anthropic: 'anthropic',
  cloudflare: 'cloudflare',
  ollama: 'ollama',
};

const MAGYAR_SYSTEM_PROMPT = (toolList: string, agentCapabilities: string): string => `\
Te vagy **Brunella**, a BAS (Brunella Agent System) mesterséges intelligencia asszisztense és orkesztrátora.

SZEMÉLYISÉG:
- Folyékonyan, természetesen és professzionálisan kommunikálsz magyarul.
- Intelligens, proaktív és segítőkész vagy — mint egy tapasztalt fejlesztő kolléga.
- Képes vagy gondolkodni, elemezni, magyarázni, tanácsot adni, ÉS feladatokat delegálni.
- Válaszaid informatívak, strukturáltak és közvetlenek — nem robotikusak.

KÉPESSÉGEID:
1) **Beszélgetés**: Válaszolhatsz kérdésekre, elmagyarázhatsz koncepciókat, tanácsot adhatsz.
2) **Rendszer felügyelet**: Lekérdezheted a rendszer állapotát, futó feladatokat, agent státuszokat.
3) **Feladat delegálás**: Ügynököknek delegálhatsz feladatokat a rendelkezésre álló eszközökkel.
4) **Probléma megoldás**: Diagnosztizálhatsz hibákat, javasolhatsz megoldásokat, elindíthatsz javításokat.
5) **Tervezés**: Segíthetsz feladatok megtervezésében, lebontásában és priorizálásában.

MŰKÖDÉS:
- Ha a felhasználó kérdést tesz fel → válaszolj közvetlenül és értelmesen.
- Ha a felhasználó feladatot ad → elemezd, szükség esetén delegáld a megfelelő ügynöknek.
- Ha rendszerinformációra van szükség → használd az eszközöket (get_system_status, list_active_tasks, stb.).
- Ha bizonytalan vagy → kérdezz vissza, ne találj ki dolgokat.
- Komplex feladatoknál bontsd le lépésekre és delegáld a megfelelő ügynököknek.

RENDELKEZÉSRE ÁLLÓ ESZKÖZÖK:
${toolList}

ÜGYNÖK KÉPESSÉGEK (delegáláshoz):
${agentCapabilities}

SZABÁLYOK:
- Mindig magyarul válaszolj.
- Ne szimulálj végrehajtást — ha delegálsz, az valódi feladat indítás.
- High-risk műveleteknél (deploy, törlés, config módosítás) kérj megerősítést.
- Ha egy ügynök nem elérhető, ajánlj alternatívát vagy kézi megoldást.
`;

function buildRuntimeContext(): string {
  const agentStatuses = agentManager.listAgentStatuses();
  const tasks = agentManager.getAllTasks();

  const activeAgents = agentStatuses.filter((agent) => agent.status !== 'idle');
  const errorAgents = agentStatuses.filter((agent) => agent.status === 'error');
  const runningTasks = tasks.filter((task) => task.status === 'running');
  const pendingTasks = tasks.filter((task) => task.status === 'pending');
  const errorTasks = tasks.filter((task) => task.status === 'error');

  const activeAgentSummary = activeAgents.length > 0
    ? activeAgents
        .slice(0, 8)
        .map((agent) => `${agent.name}[${agent.status}]${agent.lastTask ? `: ${agent.lastTask}` : ''}`)
        .join('; ')
    : 'nincs aktív agent';

  const errorAgentSummary = errorAgents.length > 0
    ? errorAgents
        .slice(0, 5)
        .map((agent) => `${agent.name} (hibák: ${agent.errorCount})`)
        .join('; ')
    : 'nincs hibás agent';

  const runningTaskSummary = runningTasks.length > 0
    ? runningTasks
        .slice(0, 5)
        .map((task) => `#${task.id} ${task.agentName}: ${task.description}`)
        .join('; ')
    : 'nincs futó task';

  return [
    'Aktuális belső rendszerkép:',
    `- Agent összesen: ${agentStatuses.length}`,
    `- Aktív agentek: ${activeAgents.length} → ${activeAgentSummary}`,
    `- Hibás agentek: ${errorAgents.length} → ${errorAgentSummary}`,
    `- Futó taskok: ${runningTasks.length} → ${runningTaskSummary}`,
    `- Függő taskok: ${pendingTasks.length}`,
    `- Hibás taskok: ${errorTasks.length}`,
  ].join('\n');
}

/**
 * Build agent capabilities summary for the system prompt.
 * Groups agents by role to help the LLM make smart delegation decisions.
 */
function buildAgentCapabilities(): string {
  try {
    const agents = agentManager.listAgentStatuses();
    if (agents.length === 0) return 'Nincs betöltött agent.';

    const capabilityMap: Record<string, string[]> = {
      'Fejlesztés': [],
      'Kutatás & Tudás': [],
      'Tesztelés & Minőség': [],
      'DevOps & Infrastruktúra': [],
      'Üzlet & Értékesítés': [],
      'Kommunikáció': [],
      'Automatizálás': [],
      'Egyéb': [],
    };

    for (const agent of agents) {
      const name = agent.name.toLowerCase();
      if (/develop|architect|lint|code|ux/.test(name)) {
        capabilityMap['Fejlesztés'].push(agent.name);
      } else if (/research|knowledge|data|market_intel/.test(name)) {
        capabilityMap['Kutatás & Tudás'].push(agent.name);
      } else if (/qa|evaluat|test/.test(name)) {
        capabilityMap['Tesztelés & Minőség'].push(agent.name);
      } else if (/devops|ops|deploy|cloudflare|edge/.test(name)) {
        capabilityMap['DevOps & Infrastruktúra'].push(agent.name);
      } else if (/sales|marketing|pricing|campaign|nurture|grant|finance|procurement/.test(name)) {
        capabilityMap['Üzlet & Értékesítés'].push(agent.name);
      } else if (/email|voice|copywrite|document/.test(name)) {
        capabilityMap['Kommunikáció'].push(agent.name);
      } else if (/robot|chrome|apify|scraping/.test(name)) {
        capabilityMap['Automatizálás'].push(agent.name);
      } else {
        capabilityMap['Egyéb'].push(agent.name);
      }
    }

    const lines: string[] = [];
    for (const [category, agentNames] of Object.entries(capabilityMap)) {
      if (agentNames.length > 0) {
        lines.push(`**${category}**: ${agentNames.join(', ')}`);
      }
    }
    return lines.join('\n');
  } catch {
    return 'Agent képességek nem elérhetőek.';
  }
}

export class UniversalOrchestratorService {
  private sessionMemories = new Map<string, SessionMemory>();
  private pendingApprovals = new Map<string, PendingApproval>();
  private runbookMemory = new Map<string, RunbookMemoryEntry>();
  private readonly MAX_SESSIONS = 150;

  async process(request: UniversalRequest): Promise<UniversalResponse> {
    const startTime = Date.now();
    const actionsTriggered: ActionTriggered[] = [];
    const missionTimeline: MissionTimelineEntry[] = [];
    const role: 'orchestrator' = 'orchestrator';
    const session = this.getOrCreateSession(request.sessionId);
    const lastUserMsg = request.message.trim();

    this.pushTimeline(missionTimeline, {
      phase: 'intake',
      status: 'started',
      detail: `Kérés fogadva: "${lastUserMsg.slice(0, 120)}"`,
    });

    this.rememberUserMessage(session, lastUserMsg);

    const approvalResult = await this.tryHandleApprovalResponse(lastUserMsg, session, missionTimeline);
    if (approvalResult) {
      this.rememberAssistantMessage(session, approvalResult.reply);
      this.rememberActions(session, approvalResult.actionsTriggered);
      this.updateRunbook(
        approvalResult.runbookWorkflow,
        approvalResult.actionsTriggered,
        approvalResult.reply,
      );

      return {
        reply: approvalResult.reply,
        actionsTriggered: approvalResult.actionsTriggered,
        provider: PROVIDER_MAP[request.provider] ?? 'github',
        model: request.model ?? this.resolveDefaultModel(PROVIDER_MAP[request.provider] ?? 'github'),
        role,
        thinkingMs: Date.now() - startTime,
        sessionId: session.sessionId,
        suggestions: approvalResult.suggestions,
        missionTimeline,
        runbookHint: this.getRunbookHint(approvalResult.runbookWorkflow),
      };
    }

    if (this.isHighRiskIntent(lastUserMsg)) {
      const approval = this.createPendingApproval(session.sessionId, lastUserMsg);
      this.rememberIntent(session, 'approval_required');
      this.pushTimeline(missionTimeline, {
        phase: 'approval_checkpoint',
        status: 'blocked',
        detail: `High-risk kérés detektálva. Jóváhagyás szükséges (#${approval.id}).`,
      });

      const reply = `Ez high-risk műveletnek tűnik (pl. deploy/config/törlés). Biztonsági checkpoint miatt megerősítés kell.\n\nHa jóváhagyod, írd: **jóváhagyom ${approval.id}**`;
      this.rememberAssistantMessage(session, reply);

      return {
        reply,
        actionsTriggered: [],
        provider: PROVIDER_MAP[request.provider] ?? 'github',
        model: request.model ?? this.resolveDefaultModel(PROVIDER_MAP[request.provider] ?? 'github'),
        role,
        thinkingMs: Date.now() - startTime,
        sessionId: session.sessionId,
        suggestions: [`jóváhagyom ${approval.id}`, 'elutasítom'],
        missionTimeline,
        approvalRequired: true,
        approvalId: approval.id,
        riskLevel: 'high',
        runbookHint: this.getRunbookHint('high_risk_operation'),
      };
    }

    const bifrost = getBifrostGateway();
    const registry = await getToolRegistry();
    const tools = registry.getToolDefinitions();

    const providerType: ProviderType = PROVIDER_MAP[request.provider] ?? 'github';

    // Build tool list description for system prompt
    const toolList = tools
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    const runtimeContext = buildRuntimeContext();
    const agentCapabilities = buildAgentCapabilities();

    // Enrich context with advanced intelligence modules
    const graphContext = this.getGraphRagContext(lastUserMsg);
    const reflectionContext = this.getReflectionContext();
    const predictiveContext = this.getPredictiveContext();
    const advancedContext = [graphContext, reflectionContext, predictiveContext].filter(Boolean).join('\n');

    const systemPrompt = `${MAGYAR_SYSTEM_PROMPT(toolList, agentCapabilities)}\n\n${runtimeContext}\n\n${this.buildSessionContext(session)}${advancedContext ? `\n\n${advancedContext}` : ''}`;

    // Build conversation messages — window to last 20 messages to avoid context overflow
    const recentHistory = request.conversationHistory.slice(-20);
    const messages = [
      ...recentHistory,
      { role: 'user' as const, content: request.message }
    ];

    const routedResult = await this.tryHandleIntentRouting(lastUserMsg, session, missionTimeline);
    if (routedResult) {
      this.rememberAssistantMessage(session, routedResult.reply);
      this.rememberActions(session, routedResult.actionsTriggered);
      this.updateRunbook(routedResult.runbookWorkflow, routedResult.actionsTriggered, routedResult.reply);
      return {
        reply: routedResult.reply,
        actionsTriggered: routedResult.actionsTriggered,
        provider: providerType,
        model: request.model ?? this.resolveDefaultModel(providerType),
        role,
        thinkingMs: Date.now() - startTime,
        sessionId: session.sessionId,
        suggestions: routedResult.suggestions,
        missionTimeline,
        runbookHint: this.getRunbookHint(routedResult.runbookWorkflow),
      };
    }

    this.pushTimeline(missionTimeline, {
      phase: 'llm_reasoning',
      status: 'started',
      detail: `LLM döntés-előkészítés (${providerType})`,
    });

    logInfo('UniversalOrchestratorService', `Processing via ${providerType}: "${lastUserMsg.slice(0, 60)}..."`);

    let reply = '';
    let toolCallsToProcess: Array<{ name: string; args: Record<string, unknown> }> = [];
    let resolvedProvider: ProviderType = providerType;
    let resolvedModel: string = request.model ?? this.resolveDefaultModel(providerType);
    let fallbackUsed = false;
    let fallbackReason: string | undefined;
    let phoenixTriggered = false;

    try {
      const response = await bifrost.generate({
        prompt: lastUserMsg,
        provider: providerType,
        model: request.model,
        systemPrompt,
        tools,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(0, -1), // history without last user msg
          { role: 'user', content: lastUserMsg }
        ],
        taskType: 'general',
        temperature: 0.5,
        maxTokens: 4096,
        userId: request.userId,
      });

      if (!response.success) {
        logError('UniversalOrchestratorService', `LLM hiba: ${response.error}`);
        this.pushTimeline(missionTimeline, {
          phase: 'llm_reasoning',
          status: 'blocked',
          detail: `LLM hiba: ${response.error ?? 'ismeretlen hiba'}`,
        });
        return {
          reply: `Sajnos hiba történt a feldolgozás során: ${response.error ?? 'ismeretlen hiba'}`,
          actionsTriggered: [],
          provider: response.provider,
          model: response.model,
          role,
          thinkingMs: Date.now() - startTime,
          sessionId: session.sessionId,
          missionTimeline,
          fallbackUsed: response.fallback_used,
          fallbackReason: response.fallback_reason,
          phoenixTriggered: response.phoenix_triggered,
        };
      }

      resolvedProvider = response.provider;
      resolvedModel = response.model;
      fallbackUsed = response.fallback_used === true;
      fallbackReason = response.fallback_reason;
      phoenixTriggered = response.phoenix_triggered === true;

      if (fallbackUsed) {
        this.pushTimeline(missionTimeline, {
          phase: 'phoenix_fallback',
          status: 'info',
          detail: `Fallback: ${response.fallback_from ?? providerType} -> ${response.provider}${fallbackReason ? ` (${fallbackReason})` : ''}`,
        });
      }

      this.pushTimeline(missionTimeline, {
        phase: 'llm_reasoning',
        status: 'completed',
        detail: 'LLM elemzés elkészült.',
      });

      reply = response.content || '';

      // Extract tool calls from response
      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          let args: Record<string, unknown> = {};
          try {
            args = typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : (tc.function.arguments as Record<string, unknown>);
          } catch {
            args = {};
          }
          toolCallsToProcess.push({ name: tc.function.name, args });
        }
      }

      // Also check for Qwen-style [DELEGÁLÁS: AgentNév | feladat] syntax in text
      if (toolCallsToProcess.length === 0 && reply) {
        const delegateRegex = /\[DELEGÁLÁS:\s*([^\|]+)\|\s*([^\]]+)\]/gi;
        let match;
        while ((match = delegateRegex.exec(reply)) !== null) {
          toolCallsToProcess.push({
            name: `delegate_${match[1].trim()}`,
            args: { task: match[2].trim() }
          });
        }
        // Clean syntax from reply text
        if (toolCallsToProcess.length > 0) {
          reply = reply.replace(delegateRegex, '').trim();
        }
      }

      // Execute tool calls
      const toolResultsForLLM: Array<{ tool_call_id: string; name: string; content: string }> = [];
      for (const tc of toolCallsToProcess) {
        this.pushTimeline(missionTimeline, {
          phase: 'tool_execution',
          status: 'started',
          detail: `Tool futtatás: ${tc.name}`,
        });
        const toolResult = await this.executeTool(tc.name, tc.args);
        actionsTriggered.push(...toolResult.actions);
        toolResultsForLLM.push({
          tool_call_id: tc.name,
          name: tc.name,
          content: toolResult.resultText || 'Végrehajtva.',
        });
        this.pushTimeline(missionTimeline, {
          phase: 'tool_execution',
          status: 'completed',
          detail: `Tool kész: ${tc.name}`,
        });
      }

      // Multi-turn synthesis: send tool results back to LLM for natural response
      if (toolResultsForLLM.length > 0 && response.toolCalls && response.toolCalls.length > 0) {
        this.pushTimeline(missionTimeline, {
          phase: 'llm_synthesis',
          status: 'started',
          detail: 'Tool eredmények szintetizálása...',
        });

        try {
          const toolResultSummary = toolResultsForLLM
            .map(tr => `[${tr.name}]: ${tr.content}`)
            .join('\n');

          const synthesisMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.slice(0, -1),
            { role: 'user', content: lastUserMsg },
            { role: 'assistant', content: reply || '(Tool hívások végrehajtása...)' },
            { role: 'user', content: `Az eszközök eredménye:\n${toolResultSummary}\n\nKérlek, foglald össze az eredményeket természetes magyarul a felhasználónak.` }
          ];

          const synthesisResponse = await bifrost.generate({
            prompt: lastUserMsg,
            provider: resolvedProvider,
            model: resolvedModel,
            systemPrompt,
            messages: synthesisMessages,
            taskType: 'general',
            temperature: 0.5,
            maxTokens: 4096,
            userId: request.userId,
          });

          if (synthesisResponse.success && synthesisResponse.content) {
            reply = synthesisResponse.content;
          }

          this.pushTimeline(missionTimeline, {
            phase: 'llm_synthesis',
            status: 'completed',
            detail: 'Szintézis kész.',
          });
        } catch (synthError: unknown) {
          logWarn('UniversalOrchestratorService', `Szintézis hiba, nyers eredmények használata: ${synthError instanceof Error ? synthError.message : String(synthError)}`);
          // Fall back to raw tool results appended to reply
          const rawResults = toolResultsForLLM.map(tr => tr.content).join('\n\n');
          reply = reply ? `${reply}\n\n${rawResults}` : rawResults;
        }
      }

      // If no text reply was produced, generate a summary follow-up
      if (!reply && actionsTriggered.length > 0) {
        const agentNames = actionsTriggered.map(a => a.agent).join(', ');
        reply = `Rendben! Delegáltam a következő ügynök(ök)nek: **${agentNames}**. A feladat elindult a háttérben — a Raj sávon követheted az előrehaladást.`;
      } else if (!reply) {
        reply = 'Megkaptam az utasítást, de nem tudtam feldolgozni. Kérlek, fogalmazd meg pontosabban!';
      }

      this.rememberActions(session, actionsTriggered);
      this.rememberAssistantMessage(session, reply);
      this.updateRunbook('general_orchestration', actionsTriggered, reply);

      // ─── Post-response intelligence hooks (async, non-blocking) ───
      this.postResponseHooks(session.sessionId, lastUserMsg, reply, actionsTriggered, Date.now() - startTime);

      this.pushTimeline(missionTimeline, {
        phase: 'response',
        status: 'completed',
        detail: 'Válasz összeállítva és visszaadva.',
      });

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('UniversalOrchestratorService', `Feldolgozási hiba: ${error}`);
      reply = `Hiba történt: ${error}`;
      this.rememberAssistantMessage(session, reply);
      this.pushTimeline(missionTimeline, {
        phase: 'response',
        status: 'blocked',
        detail: `Feldolgozási hiba: ${error}`,
      });
    }

    return {
      reply,
      actionsTriggered,
      provider: resolvedProvider,
      model: resolvedModel,
      role,
      thinkingMs: Date.now() - startTime,
      sessionId: session.sessionId,
      missionTimeline,
      runbookHint: this.getRunbookHint('general_orchestration'),
      fallbackUsed,
      fallbackReason,
      phoenixTriggered,
    };
  }

  private resolveDefaultModel(provider: ProviderType): string {
    switch (provider) {
      case 'github':
        return process.env.GITHUB_MODELS_DEFAULT_MODEL || process.env.GITHUB_MODEL || 'gpt-4.1';
      case 'gemini':
        return process.env.GEMINI_MODEL || 'gemini-2.5-flash';
      case 'anthropic':
        return process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
      case 'cloudflare':
        return process.env.CF_AI_SMART_MODEL || '@cf/meta/llama-3.3-70b-instruct';
      case 'ollama':
      default:
        return process.env.OLLAMA_DEFAULT_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5-coder:7b';
    }
  }

  private pushTimeline(
    timeline: MissionTimelineEntry[],
    entry: Omit<MissionTimelineEntry, 'timestamp'>,
  ): void {
    timeline.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  }

  private isHighRiskIntent(message: string): boolean {
    return /(tör(ö|o)l|delete|drop\s+table|deploy|éles(í|i)t|production|config|\.env|secret|kulcs|migr(á|a)ci(ó|o)|reset|truncate)/i
      .test(message);
  }

  private createPendingApproval(sessionId: string, originalMessage: string): PendingApproval {
    const id = `apr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const pending: PendingApproval = {
      id,
      sessionId,
      originalMessage,
      createdAt: Date.now(),
      riskLevel: 'high',
    };

    this.pendingApprovals.set(id, pending);
    const session = this.getOrCreateSession(sessionId);
    session.pendingApprovalId = id;
    return pending;
  }

  private getApprovalFromMessage(message: string, session: SessionMemory): PendingApproval | null {
    const idMatch = message.match(/(?:jóváhagyom|approve|engedélyezem)\s+([a-z0-9-]+)/i);
    const explicitId = idMatch?.[1];

    if (explicitId && this.pendingApprovals.has(explicitId)) {
      return this.pendingApprovals.get(explicitId) ?? null;
    }

    if (session.pendingApprovalId) {
      return this.pendingApprovals.get(session.pendingApprovalId) ?? null;
    }

    return null;
  }

  private isApprovalRejection(message: string): boolean {
    return /(elutas(í|i)tom|cancel|stop|m(é|e)gse|ne futtasd|nem hagyom jóv(á|a))/i.test(message);
  }

  private isApprovalAcceptance(message: string): boolean {
    return /(jóváhagyom|approve|engedélyezem)/i.test(message);
  }

  private async tryHandleApprovalResponse(
    message: string,
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{
    reply: string;
    actionsTriggered: ActionTriggered[];
    suggestions?: string[];
    runbookWorkflow: string;
  } | null> {
    const hasPending = Boolean(session.pendingApprovalId);
    if (!hasPending && !this.isApprovalAcceptance(message) && !this.isApprovalRejection(message)) {
      return null;
    }

    if (this.isApprovalRejection(message)) {
      if (session.pendingApprovalId) {
        this.pendingApprovals.delete(session.pendingApprovalId);
        session.pendingApprovalId = undefined;
      }
      this.rememberIntent(session, 'approval_rejected');
      this.pushTimeline(timeline, {
        phase: 'approval_checkpoint',
        status: 'blocked',
        detail: 'A felhasználó elutasította a high-risk műveletet.',
      });
      return {
        reply: 'Rendben, a high-risk műveletet leállítottam. Nem indítottam el végrehajtást.',
        actionsTriggered: [],
        suggestions: ['Adj biztonságosabb alternatívát', 'Mutasd a rendszer állapotát'],
        runbookWorkflow: 'approval_rejected',
      };
    }

    if (!this.isApprovalAcceptance(message)) {
      return null;
    }

    const approval = this.getApprovalFromMessage(message, session);
    if (!approval) {
      this.pushTimeline(timeline, {
        phase: 'approval_checkpoint',
        status: 'blocked',
        detail: 'Jóváhagyás érkezett, de nem található érvényes approval azonosító.',
      });
      return {
        reply: 'Nem találtam érvényes jóváhagyási azonosítót. Kérlek, add meg a kapott approval ID-t.',
        actionsTriggered: [],
        suggestions: ['Mutasd az utolsó jóváhagyási kérést'],
        runbookWorkflow: 'approval_missing',
      };
    }

    return this.executeApprovedHighRiskPlan(approval, session, timeline);
  }

  private async executeApprovedHighRiskPlan(
    approval: PendingApproval,
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{
    reply: string;
    actionsTriggered: ActionTriggered[];
    suggestions?: string[];
    runbookWorkflow: string;
  }> {
    const actionsTriggered: ActionTriggered[] = [];
    this.pendingApprovals.delete(approval.id);
    session.pendingApprovalId = undefined;
    this.rememberIntent(session, 'approval_accepted_high_risk');

    this.pushTimeline(timeline, {
      phase: 'approval_checkpoint',
      status: 'completed',
      detail: `High-risk jóváhagyás elfogadva (#${approval.id}).`,
    });

    const conductorAgent = this.selectLoadedAgent(['ProjectConductor', 'Conductor']);
    const devAgent = this.selectLoadedAgent(['Developer', 'developer']);
    const qaAgent = this.selectLoadedAgent(['qa', 'QA', 'QualityAssurance']);

    const approvalPlan: Array<{ phase: string; agent: string | null; task: string }> = [
      {
        phase: 'safety_plan',
        agent: conductorAgent,
        task: `Készíts biztonsági végrehajtási tervet a jóváhagyott high-risk kérésre: ${approval.originalMessage}`,
      },
      {
        phase: 'execution',
        agent: devAgent,
        task: `Hajtsd végre óvatosan a jóváhagyott módosítást: ${approval.originalMessage}. Készíts rollback pontokat.`,
      },
      {
        phase: 'verification',
        agent: qaAgent,
        task: 'Futtass utóellenőrzést és regressziós validációt az előző high-risk végrehajtás után.',
      },
    ];

    for (const step of approvalPlan) {
      if (!step.agent) {
        continue;
      }
      const taskId = await agentManager.queueTask(step.task, step.agent, {
        source: 'orchestrator_approved_high_risk',
        sessionId: session.sessionId,
        approvalId: approval.id,
        phase: step.phase,
      });
      actionsTriggered.push({ agent: step.agent, task: step.task, taskId, status: 'started' });
      this.pushTimeline(timeline, {
        phase: step.phase,
        status: 'started',
        detail: `Delegálva: ${step.agent}`,
        agent: step.agent,
        taskId,
      });
    }

    return {
      reply: actionsTriggered.length > 0
        ? `Jóváhagyás rendben (#${approval.id}). Elindítottam a biztonságos végrehajtási láncot: ${actionsTriggered.map((action) => `#${action.taskId} ${action.agent}`).join(', ')}`
        : `Jóváhagyás rendben (#${approval.id}), de nem találtam megfelelő végrehajtó ügynököket.`,
      actionsTriggered,
      suggestions: ['Mutasd a high-risk végrehajtás progresszét', 'Kérek állapotjelentést'],
      runbookWorkflow: 'approved_high_risk_execution',
    };
  }

  private getOrCreateSession(sessionId?: string): SessionMemory {
    const normalized = (sessionId || 'legacy-anonymous').trim();
    const existing = this.sessionMemories.get(normalized);
    if (existing) {
      existing.updatedAt = Date.now();
      return existing;
    }

    const created: SessionMemory = {
      sessionId: normalized,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      recentMessages: [],
      recentIntents: [],
      delegatedTaskIds: [],
    };

    this.sessionMemories.set(normalized, created);
    this.compactSessions();
    return created;
  }

  private compactSessions(): void {
    if (this.sessionMemories.size <= this.MAX_SESSIONS) {
      return;
    }

    const ordered = Array.from(this.sessionMemories.values()).sort((a, b) => a.updatedAt - b.updatedAt);
    const toDelete = ordered.slice(0, this.sessionMemories.size - this.MAX_SESSIONS);
    for (const session of toDelete) {
      this.sessionMemories.delete(session.sessionId);
    }
  }

  private rememberUserMessage(session: SessionMemory, message: string): void {
    session.recentMessages.push({ role: 'user', content: message.slice(0, 800) });
    if (session.recentMessages.length > 20) {
      session.recentMessages = session.recentMessages.slice(-20);
    }
    session.updatedAt = Date.now();
  }

  private rememberAssistantMessage(session: SessionMemory, message: string): void {
    session.recentMessages.push({ role: 'assistant', content: message.slice(0, 1000) });
    if (session.recentMessages.length > 20) {
      session.recentMessages = session.recentMessages.slice(-20);
    }
    session.updatedAt = Date.now();
  }

  private rememberIntent(session: SessionMemory, intent: string): void {
    session.recentIntents.push(intent);
    if (session.recentIntents.length > 12) {
      session.recentIntents = session.recentIntents.slice(-12);
    }
    session.updatedAt = Date.now();
  }

  private rememberActions(session: SessionMemory, actions: ActionTriggered[]): void {
    if (actions.length === 0) {
      return;
    }

    const merged = new Set(session.delegatedTaskIds);
    for (const action of actions) {
      merged.add(action.taskId);
    }

    session.delegatedTaskIds = Array.from(merged).slice(-40);
    session.updatedAt = Date.now();
  }

  private updateRunbook(workflow: string, actions: ActionTriggered[], summary: string): void {
    const existing = this.runbookMemory.get(workflow);
    const entry: RunbookMemoryEntry = existing ?? {
      workflow,
      executions: 0,
      lastUsedAt: Date.now(),
      successfulSignals: 0,
      agentComboStats: {},
    };

    entry.executions += 1;
    entry.lastUsedAt = Date.now();
    if (actions.length > 0 || !/hiba|error/i.test(summary)) {
      entry.successfulSignals += 1;
    }

    if (actions.length > 0) {
      const combo = actions.map((action) => action.agent).sort().join(' + ');
      entry.agentComboStats[combo] = (entry.agentComboStats[combo] ?? 0) + 1;
    }

    entry.lastSummary = summary.slice(0, 240);
    this.runbookMemory.set(workflow, entry);
  }

  private getRunbookHint(workflow: string): string | undefined {
    const entry = this.runbookMemory.get(workflow);
    if (!entry) {
      return undefined;
    }

    const bestCombo = Object.entries(entry.agentComboStats)
      .sort((a, b) => b[1] - a[1])[0]?.[0];

    return bestCombo
      ? `Runbook: ${entry.executions} futás, bevált agent-kombó: ${bestCombo}`
      : `Runbook: ${entry.executions} futás, sikerjelzés: ${entry.successfulSignals}`;
  }

  private buildSessionContext(session: SessionMemory): string {
    const recentIntents = session.recentIntents.length > 0
      ? session.recentIntents.slice(-5).join(', ')
      : 'nincs még';

    const recentTaskIds = session.delegatedTaskIds.length > 0
      ? session.delegatedTaskIds.slice(-8).map((id) => `#${id}`).join(', ')
      : 'nincs';

    const pendingClarification = session.pendingClarification
      ? `igen (${session.pendingClarification.intent})`
      : 'nem';

    return [
      'Session operátori memória:',
      `- SessionId: ${session.sessionId}`,
      `- Közelmúlt intentek: ${recentIntents}`,
      `- Session task referenciák: ${recentTaskIds}`,
      `- Függő tisztázó kérdés: ${pendingClarification}`,
    ].join('\n');
  }

  private detectProgressIntent(message: string): boolean {
    return /(hol tart|státusz|statusz|progress|mi fut|állapot|feladatok állapota|mi a helyzet)/i.test(message);
  }

  private detectSystemCheckIntent(message: string): boolean {
    return /(rendszerellenőrz|rendszer ellenőrz|system check|health check|diagnosztik|ellenőrizd a rendszert)/i.test(message);
  }

  private detectErrorRecoveryIntent(message: string): boolean {
    return /(hiba|error|nem működik|elromlott).*(jav|fix|helyre|oldd meg)|javítsd.*(hib|error)/i.test(message);
  }

  private detectStabilizationIntent(message: string): boolean {
    return /(stabiliz(á|a)ld|stabiliz(á|a)ci(ó|o)|stabilize the system|stabil rendszer)/i.test(message);
  }

  private detectMonitorIntent(message: string): boolean {
    return /(auto-?heal|öngyógy|monitor|figyeld|stall|timeout|beragadt|elakadt task)/i.test(message);
  }

  private detectIncidentIntent(message: string): boolean {
    return /(incident|kritikus hiba|outage|le(á|a)ll(t|ás)|v(é|e)szhelyzet|production hiba)/i.test(message);
  }

  private parseSystemCheckMode(message: string): 'quick' | 'deep' | undefined {
    if (/(teljes|mély|részletes|deep|full|komplett)/i.test(message)) {
      return 'deep';
    }
    if (/(gyors|quick|rövid|light)/i.test(message)) {
      return 'quick';
    }
    return undefined;
  }

  private resolveClarificationAnswer(message: string): 'quick' | 'deep' | undefined {
    const explicit = this.parseSystemCheckMode(message);
    if (explicit) {
      return explicit;
    }

    if (/^igen\b|^mehet\b|^ok\b|^oke\b/i.test(message.trim())) {
      return 'quick';
    }

    return undefined;
  }

  private summarizeTaskProgress(taskIds: number[]): string {
    const allTasks = agentManager.getAllTasks();
    type QueueTaskItem = ReturnType<typeof agentManager.getAllTasks>[number];
    const scopedTasks = taskIds
      .map((taskId) => allTasks.find((task) => task.id === taskId))
      .filter((task): task is QueueTaskItem => Boolean(task));

    const sourceTasks = scopedTasks.length > 0
      ? scopedTasks
      : allTasks.filter((task) => task.status === 'running' || task.status === 'pending').slice(0, 8);

    if (sourceTasks.length === 0) {
      return 'Jelenleg nincs aktív vagy sessionhöz köthető feladat.';
    }

    const running = sourceTasks.filter((task) => task.status === 'running').length;
    const pending = sourceTasks.filter((task) => task.status === 'pending').length;
    const done = sourceTasks.filter((task) => task.status === 'done').length;
    const errors = sourceTasks.filter((task) => task.status === 'error').length;

    const lines = sourceTasks
      .slice(-8)
      .map((task) => `- #${task.id} ${task.agentName}: ${task.description} [${task.status}]`);

    return [
      `Összegzés: ${running} futó, ${pending} függő, ${done} kész, ${errors} hibás.`,
      ...lines,
    ].join('\n');
  }

  private selectLoadedAgent(preferredNames: string[]): string | null {
    const loaded = agentManager.listAgents().map((agent) => agent.name);
    for (const preferred of preferredNames) {
      const found = loaded.find((name) => name.toLowerCase() === preferred.toLowerCase());
      if (found) {
        return found;
      }
    }
    return null;
  }

  private async runSystemCheckWorkflow(
    mode: 'quick' | 'deep',
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{ reply: string; actionsTriggered: ActionTriggered[]; suggestions?: string[]; runbookWorkflow: string }> {
    const actionsTriggered: ActionTriggered[] = [];
    this.pushTimeline(timeline, {
      phase: 'system_check',
      status: 'started',
      detail: `${mode === 'deep' ? 'Teljes' : 'Gyors'} rendszerellenőrzés indítása.`,
    });
    const statusResult = await this.executeTool('get_system_status', {});
    const taskResult = await this.executeTool('list_active_tasks', {});

    this.rememberIntent(session, mode === 'deep' ? 'system_check_deep' : 'system_check_quick');
    session.lastSystemCheckMode = mode;
    session.lastSystemCheckAt = Date.now();
    session.pendingClarification = undefined;

    if (mode === 'deep') {
      const qaAgent = this.selectLoadedAgent(['qa', 'QA', 'QualityAssurance']);
      const devAgent = this.selectLoadedAgent(['Developer', 'developer']);
      const conductorAgent = this.selectLoadedAgent(['ProjectConductor', 'Conductor']);

      const deepDelegations: Array<{ agent: string; task: string }> = [];
      if (qaAgent) {
        deepDelegations.push({
          agent: qaAgent,
          task: 'Futtass részletes rendszer-ellenőrzési QA auditot és listázd a kockázatokat.',
        });
      }
      if (devAgent) {
        deepDelegations.push({
          agent: devAgent,
          task: 'Készíts diagnosztikai összefoglalót a legutóbbi hibákról és javasolj javítási tervet.',
        });
      }
      if (conductorAgent) {
        deepDelegations.push({
          agent: conductorAgent,
          task: 'Szervezd sorrendbe a rendszerellenőrzés utáni teendőket és készíts akciótervet.',
        });
      }

      for (const delegation of deepDelegations) {
        const taskId = await agentManager.queueTask(delegation.task, delegation.agent, {
          source: 'orchestrator_system_check',
          sessionId: session.sessionId,
          mode,
        });
        actionsTriggered.push({
          agent: delegation.agent,
          task: delegation.task,
          taskId,
          status: 'started',
        });
        this.pushTimeline(timeline, {
          phase: 'system_check_delegation',
          status: 'started',
          detail: `Delegálás: ${delegation.agent}`,
          agent: delegation.agent,
          taskId,
        });
      }
    }

    const baseReply = [
      mode === 'deep'
        ? 'Rendben, elindítottam a **teljes rendszerellenőrzést** és háttérdelegálást.'
        : 'Rendben, lefuttattam egy **gyors rendszerellenőrzést**.',
      '',
      statusResult.resultText,
      '',
      taskResult.resultText,
    ].join('\n');

    const followUp = actionsTriggered.length > 0
      ? `\n\n🔧 Elindított háttérfeladatok: ${actionsTriggered.map((action) => `#${action.taskId} ${action.agent}`).join(', ')}`
      : '';

    return {
      reply: `${baseReply}${followUp}`,
      actionsTriggered,
      suggestions: mode === 'deep'
        ? ['Mutasd a rendszerellenőrzés progresszét', 'Sorold a hibás taskokat', 'Adj javítási prioritási listát']
        : ['Indíts teljes rendszerellenőrzést', 'Mutasd az aktív feladatokat'],
      runbookWorkflow: mode === 'deep' ? 'system_check_deep' : 'system_check_quick',
    };
  }

  private async runAutoHealCycle(
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{ report: string; actionsTriggered: ActionTriggered[] }> {
    const actionsTriggered: ActionTriggered[] = [];
    const tasks = agentManager.getAllTasks();
    const now = Date.now();

    const staleRunning = tasks.filter((task) =>
      task.status === 'running' && task.startedAt && now - new Date(task.startedAt).getTime() > 15 * 60 * 1000,
    );

    const stalePending = tasks.filter((task) =>
      task.status === 'pending' && now - new Date(task.createdAt).getTime() > 30 * 60 * 1000,
    );

    const recentTasks = [...tasks]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
    const errorSpike = recentTasks.filter((task) => task.status === 'error').length >= 4;

    const devAgent = this.selectLoadedAgent(['Developer', 'developer']);
    const conductorAgent = this.selectLoadedAgent(['ProjectConductor', 'Conductor']);

    if ((staleRunning.length > 0 || stalePending.length > 0 || errorSpike) && devAgent) {
      const taskId = await agentManager.queueTask(
        `Auto-heal: elemezd a beragadt/hibás queue állapotot. Stale running: ${staleRunning.length}, stale pending: ${stalePending.length}, error spike: ${errorSpike}`,
        devAgent,
        { source: 'orchestrator_auto_heal', sessionId: session.sessionId },
      );
      actionsTriggered.push({
        agent: devAgent,
        task: 'Auto-heal diagnózis és javítási csomag',
        taskId,
        status: 'started',
      });
      this.pushTimeline(timeline, {
        phase: 'auto_heal',
        status: 'started',
        detail: `Auto-heal diagnózis delegálva: ${devAgent}`,
        agent: devAgent,
        taskId,
      });
    }

    if ((staleRunning.length > 0 || errorSpike) && conductorAgent) {
      const taskId = await agentManager.queueTask(
        'Auto-heal: készíts fallback/escalation tervet a beragadt hibás feladatokra.',
        conductorAgent,
        { source: 'orchestrator_auto_heal', sessionId: session.sessionId },
      );
      actionsTriggered.push({
        agent: conductorAgent,
        task: 'Auto-heal escalation és fallback terv',
        taskId,
        status: 'started',
      });
      this.pushTimeline(timeline, {
        phase: 'auto_heal',
        status: 'started',
        detail: `Escalation terv delegálva: ${conductorAgent}`,
        agent: conductorAgent,
        taskId,
      });
    }

    const report = [
      `Auto-heal detekció: ${staleRunning.length} beragadt futó, ${stalePending.length} beragadt függő, error spike: ${errorSpike ? 'igen' : 'nem'}.`,
      actionsTriggered.length > 0
        ? `Elindított javító taskok: ${actionsTriggered.map((action) => `#${action.taskId} ${action.agent}`).join(', ')}`
        : 'Nincs szükség azonnali auto-heal beavatkozásra.',
    ].join('\n');

    return { report, actionsTriggered };
  }

  private async runStabilizationAutopilotWorkflow(
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{ reply: string; actionsTriggered: ActionTriggered[]; suggestions?: string[]; runbookWorkflow: string }> {
    const actionsTriggered: ActionTriggered[] = [];
    this.rememberIntent(session, 'autopilot_stabilization');
    this.pushTimeline(timeline, {
      phase: 'autopilot_plan',
      status: 'started',
      detail: 'Safe Autopilot stabilizációs lánc összeállítása.',
    });

    const qaAgent = this.selectLoadedAgent(['qa', 'QA', 'QualityAssurance']);
    const devAgent = this.selectLoadedAgent(['Developer', 'developer']);
    const conductorAgent = this.selectLoadedAgent(['ProjectConductor', 'Conductor']);

    const plan: Array<{ phase: string; agent: string | null; task: string }> = [
      {
        phase: 'diagnosis',
        agent: qaAgent,
        task: 'Végezz stabilitási auditot és listázd a top 5 kockázatot.',
      },
      {
        phase: 'fix',
        agent: devAgent,
        task: 'Javasolj és készíts kritikus stabilizációs javítási csomagot.',
      },
      {
        phase: 'verification',
        agent: qaAgent,
        task: 'Ellenőrizd a javítások után a regressziós kockázatot és stabilitást.',
      },
      {
        phase: 'coordination',
        agent: conductorAgent,
        task: 'Készíts operátori státuszjelentést (ETA, blocker, next step).',
      },
    ];

    for (const step of plan) {
      if (!step.agent) {
        continue;
      }
      const taskId = await agentManager.queueTask(step.task, step.agent, {
        source: 'orchestrator_autopilot_stabilization',
        sessionId: session.sessionId,
        phase: step.phase,
      });
      actionsTriggered.push({ agent: step.agent, task: step.task, taskId, status: 'started' });
      this.pushTimeline(timeline, {
        phase: step.phase,
        status: 'started',
        detail: `Delegálás: ${step.agent}`,
        agent: step.agent,
        taskId,
      });
    }

    const heal = await this.runAutoHealCycle(session, timeline);
    actionsTriggered.push(...heal.actionsTriggered);

    const reply = [
      'Elindítottam a **Safe Autopilot stabilizációs láncot** (diagnózis → fix → verifikáció → koordináció).',
      actionsTriggered.length > 0
        ? `Taskok: ${actionsTriggered.map((action) => `#${action.taskId} ${action.agent}`).join(', ')}`
        : 'Nem találtam elérhető ügynököt az automatikus lánchoz.',
      heal.report,
    ].join('\n\n');

    return {
      reply,
      actionsTriggered,
      suggestions: ['Mutasd a stabilizáció progresszét', 'Adj incident státuszjelentést', 'Mutasd a blocker listát'],
      runbookWorkflow: 'autopilot_stabilization',
    };
  }

  private async runErrorRecoveryWorkflow(
    session: SessionMemory,
    originalMessage: string,
    timeline: MissionTimelineEntry[],
  ): Promise<{ reply: string; actionsTriggered: ActionTriggered[]; suggestions?: string[]; runbookWorkflow: string }> {
    const actionsTriggered: ActionTriggered[] = [];
    this.pushTimeline(timeline, {
      phase: 'incident_diagnosis',
      status: 'started',
      detail: 'Hibahelyreállítási lánc indítása.',
    });
    const tasks = agentManager.getAllTasks();
    const errorTasks = tasks.filter((task) => task.status === 'error').slice(-5);

    const qaAgent = this.selectLoadedAgent(['qa', 'QA', 'QualityAssurance']);
    const devAgent = this.selectLoadedAgent(['Developer', 'developer']);
    const conductorAgent = this.selectLoadedAgent(['ProjectConductor', 'Conductor']);

    const chains: Array<{ agent: string | null; task: string }> = [
      {
        agent: qaAgent,
        task: `Elemezd a hibás feladatokat és készíts gyökérok-listát. Felhasználói jelzés: ${originalMessage}`,
      },
      {
        agent: devAgent,
        task: 'Készíts javítási javaslatot és priorizált lépéssort a kritikus hibákra.',
      },
      {
        agent: conductorAgent,
        task: 'Koordináld a javítási láncot, és készíts rövid végrehajtási tervet a következő 3 lépésre.',
      },
    ];

    for (const chain of chains) {
      if (!chain.agent) {
        continue;
      }

      const taskId = await agentManager.queueTask(chain.task, chain.agent, {
        source: 'orchestrator_error_recovery',
        sessionId: session.sessionId,
      });
      actionsTriggered.push({ agent: chain.agent, task: chain.task, taskId, status: 'started' });
      this.pushTimeline(timeline, {
        phase: 'incident_recovery',
        status: 'started',
        detail: `Recovery delegálás: ${chain.agent}`,
        agent: chain.agent,
        taskId,
      });
    }

    this.rememberIntent(session, 'error_recovery_chain');

    const errorSummary = errorTasks.length > 0
      ? errorTasks.map((task) => `#${task.id} ${task.agentName}: ${task.description}`).join('; ')
      : 'Nincs friss hibás task a queue-ban, de a felhasználói jelzés alapján megelőző audit indul.';

    return {
      reply: [
        'Elindítottam az **automatikus hibahelyreállítási láncot** (diagnózis → javítási terv → koordináció).',
        `Észlelt hibák: ${errorSummary}`,
        actionsTriggered.length > 0
          ? `Delegált taskok: ${actionsTriggered.map((action) => `#${action.taskId} ${action.agent}`).join(', ')}`
          : 'Nem találtam elérhető QA/Developer/Conductor ügynököt delegáláshoz.',
      ].join('\n\n'),
      actionsTriggered,
      suggestions: ['Mutasd a hibahelyreállítás progresszét', 'Sorold a kritikus hibákat', 'Adj rövid helyzetjelentést'],
      runbookWorkflow: 'error_recovery_chain',
    };
  }

  private async runIncidentCommanderWorkflow(
    session: SessionMemory,
    message: string,
    timeline: MissionTimelineEntry[],
  ): Promise<{ reply: string; actionsTriggered: ActionTriggered[]; suggestions?: string[]; runbookWorkflow: string }> {
    const statusResult = await this.executeTool('get_system_status', {});
    const taskResult = await this.executeTool('list_active_tasks', {});
    const recovery = await this.runErrorRecoveryWorkflow(session, message, timeline);

    this.rememberIntent(session, 'incident_commander_mode');
    this.pushTimeline(timeline, {
      phase: 'incident_report',
      status: 'completed',
      detail: 'Incident Commander státuszjelentés elkészült.',
    });

    const reply = [
      '🚨 **Incident Commander mód aktiválva.**',
      statusResult.resultText,
      taskResult.resultText,
      recovery.reply,
      'Státuszjelentés: ETA 15-30 perc az első stabilizációs visszajelzésig. Blocker: kritikus hibák és beragadt taskok. Next step: folyamatos progressz monitorozás.',
    ].join('\n\n');

    return {
      reply,
      actionsTriggered: recovery.actionsTriggered,
      suggestions: ['/progress', 'Mutasd a blocker listát', 'Adj új ETA-t'],
      runbookWorkflow: 'incident_commander',
    };
  }

  private async runMonitorWorkflow(
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{ reply: string; actionsTriggered: ActionTriggered[]; suggestions?: string[]; runbookWorkflow: string }> {
    this.rememberIntent(session, 'monitor_auto_heal');
    this.pushTimeline(timeline, {
      phase: 'monitor',
      status: 'started',
      detail: 'Monitor + auto-heal ciklus futtatása.',
    });

    const heal = await this.runAutoHealCycle(session, timeline);
    return {
      reply: `Monitor ciklus kész.\n\n${heal.report}`,
      actionsTriggered: heal.actionsTriggered,
      suggestions: ['Mutasd a monitor progresszét', 'Indíts incident commander módot'],
      runbookWorkflow: 'monitor_auto_heal',
    };
  }

  private async tryHandleIntentRouting(
    message: string,
    session: SessionMemory,
    timeline: MissionTimelineEntry[],
  ): Promise<{ reply: string; actionsTriggered: ActionTriggered[]; suggestions?: string[]; runbookWorkflow: string } | null> {
    if (session.pendingClarification?.intent === 'system_check') {
      const mode = this.resolveClarificationAnswer(message);
      if (mode) {
        return this.runSystemCheckWorkflow(mode, session, timeline);
      }
    }

    if (this.detectProgressIntent(message)) {
      this.rememberIntent(session, 'progress_query');
      const progress = this.summarizeTaskProgress(session.delegatedTaskIds);
      return {
        reply: `Rendben, itt a legfrissebb progressz riport:\n\n${progress}`,
        actionsTriggered: [],
        suggestions: ['Indíts gyors rendszerellenőrzést', 'Indíts automatikus hibahelyreállítást'],
        runbookWorkflow: 'progress_query',
      };
    }

    if (this.detectStabilizationIntent(message)) {
      return this.runStabilizationAutopilotWorkflow(session, timeline);
    }

    if (this.detectIncidentIntent(message)) {
      return this.runIncidentCommanderWorkflow(session, message, timeline);
    }

    if (this.detectMonitorIntent(message)) {
      return this.runMonitorWorkflow(session, timeline);
    }

    if (this.detectSystemCheckIntent(message)) {
      const mode = this.parseSystemCheckMode(message);
      if (!mode) {
        session.pendingClarification = {
          intent: 'system_check',
          originalMessage: message,
          askedAt: Date.now(),
        };
        this.rememberIntent(session, 'system_check_clarification');
        return {
          reply: 'Szuper, indítom a rendszerellenőrzést. Röviden kéred (**gyors**) vagy teljes diagnosztikával (**teljes**) kérted?',
          actionsTriggered: [],
          suggestions: ['Gyors rendszerellenőrzés', 'Teljes rendszerellenőrzés'],
          runbookWorkflow: 'system_check_clarification',
        };
      }

      return this.runSystemCheckWorkflow(mode, session, timeline);
    }

    if (this.detectErrorRecoveryIntent(message)) {
      return this.runErrorRecoveryWorkflow(session, message, timeline);
    }

    return null;
  }

  private async executeTool(
    toolName: string,
    args: Record<string, unknown>
  ): Promise<{ actions: ActionTriggered[]; resultText: string }> {
    const actions: ActionTriggered[] = [];
    let resultText = '';

    try {
      // System tools
      if (toolName === 'get_system_status') {
        const agentStatuses = agentManager.listAgentStatuses();
        const tasks = agentManager.getAllTasks();
        const runningTasks = tasks.filter((task) => task.status === 'running');
        const pendingTasks = tasks.filter((task) => task.status === 'pending');
        const errorTasks = tasks.filter((task) => task.status === 'error');
        const activeAgents = agentStatuses.filter((agent) => agent.status !== 'idle');

        resultText = [
          '**Rendszer állapot:**',
          `- Agentek: ${agentStatuses.length} összesen, ${activeAgents.length} aktív`,
          `- Taskok: ${runningTasks.length} futó, ${pendingTasks.length} függő, ${errorTasks.length} hibás`,
          activeAgents.length > 0
            ? `- Aktív agentek: ${activeAgents.slice(0, 8).map((agent) => `${agent.name}[${agent.status}]`).join(', ')}`
            : '- Aktív agentek: nincs',
        ].join('\n');
        return { actions, resultText };
      }

      if (toolName === 'list_active_tasks') {
        const tasks = agentManager.getAllTasks().filter((task) => task.status === 'running' || task.status === 'pending');
        if (tasks.length === 0) {
          resultText = 'Jelenleg nincs aktív feladat.';
        } else {
          resultText = `**Aktív feladatok (${tasks.length} db):**\n${tasks
            .slice(0, 10)
            .map((task, index) => `${index + 1}. ${task.agentName}: ${task.description} [${task.status}]`)
            .join('\n')}`;
        }
        return { actions, resultText };
      }

      if (toolName === 'get_agent_logs') {
        const agentName = String(args.agentName ?? '');
        const lines = Number(args.lines ?? 20);
        resultText = `Logok lekérve: ${agentName} (${lines} sor). A log megjelenítés a CLI-ban érhető el: \`brunella agents logs ${agentName}\``;
        return { actions, resultText };
      }

      if (toolName === 'run_full_test_suite') {
        resultText = 'Tesztcsomag futtatás elindítva. Ez néhány percet vesz igénybe. Kövesd: `npm test`';
        return { actions, resultText };
      }

      // Agent delegation: delegate_<AgentName>
      if (toolName.startsWith('delegate_')) {
        const rawAgentName = toolName.replace('delegate_', '');
        const task = String(args.task ?? '');

        if (!task) {
          resultText = `Hiányzó feladat leírás a ${rawAgentName} számára.`;
          return { actions, resultText };
        }

        // CloudflareWorker tools
        if (rawAgentName.startsWith('CloudflareWorker_')) {
          const workerName = rawAgentName.replace('CloudflareWorker_', '');
          logInfo('UniversalOrchestratorService', `CF Worker delegálás: ${workerName} — "${task.slice(0, 50)}"`);
          const taskId = await agentManager.queueTask(task, `CF_${workerName}`, { worker: workerName });
          actions.push({ agent: `CloudflareWorker_${workerName}`, task, taskId, status: 'started' });
          return { actions, resultText };
        }

        // Regular agent delegation
        logInfo('UniversalOrchestratorService', `Agent delegálás: ${rawAgentName} — "${task.slice(0, 50)}"`);
        const taskId = await agentManager.queueTask(task, rawAgentName, {});
        actions.push({ agent: rawAgentName, task, taskId, status: 'started' });
        return { actions, resultText };
      }

      logInfo('UniversalOrchestratorService', `Ismeretlen tool: ${toolName}`);
      resultText = `Ismeretlen eszköz: ${toolName}`;

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('UniversalOrchestratorService', `Tool végrehajtási hiba (${toolName}): ${error}`);
      resultText = `Hiba a(z) ${toolName} végrehajtásakor: ${error}`;
    }

    return { actions, resultText };
  }

  // ─── Advanced Intelligence Helpers ─────────────────────────────────────────

  /** Get GraphRAG context for system prompt enrichment (safe, never throws) */
  private getGraphRagContext(userMessage: string): string {
    try {
      const graphRag = GraphRagEngine.getInstance();
      const result = graphRag.queryContext(userMessage, 3);
      return result.summary || '';
    } catch {
      return '';
    }
  }

  /** Get reflection engine context (safe, never throws) */
  private getReflectionContext(): string {
    try {
      const reflection = ReflectionEngine.getInstance();
      return reflection.getReflectionContext();
    } catch {
      return '';
    }
  }

  /** Get predictive intelligence context (safe, never throws) */
  private getPredictiveContext(): string {
    try {
      const pi = PredictiveIntelligence.getInstance();
      return pi.getPredictiveContext();
    } catch {
      return '';
    }
  }

  /** Post-response intelligence hooks — runs async, non-blocking */
  private postResponseHooks(
    sessionId: string,
    userMessage: string,
    reply: string,
    actionsTriggered: ActionTriggered[],
    durationMs: number,
  ): void {
    // Fire-and-forget — errors logged but never block the response
    (async () => {
      try {
        // 1. GraphRAG: ingest the conversation pair
        const graphRag = GraphRagEngine.getInstance();
        await graphRag.init();
        await graphRag.ingestConversation(sessionId, userMessage, reply);

        // 2. Reflection: reflect on task outcomes
        const reflection = ReflectionEngine.getInstance();
        for (const action of actionsTriggered) {
          await reflection.reflect({
            taskId: `${sessionId}-${action.taskId}`,
            agent: action.agent,
            task: action.task,
            result: action.status === 'completed' ? 'success' : action.status === 'error' ? 'failure' : 'partial',
            output: reply.slice(0, 200),
            durationMs,
            errorMessage: action.status === 'error' ? `Task ${action.task} failed` : undefined,
          });
        }

        // 3. Predictive: record signals
        const pi = PredictiveIntelligence.getInstance();
        await pi.init();
        await pi.recordSignal({
          source: 'orchestrator',
          action: actionsTriggered.length > 0 ? 'task_completed' : 'interaction',
          value: durationMs,
          tags: actionsTriggered.map(a => a.agent),
        });

        // Run analysis periodically (every 20th interaction)
        const stats = pi.getStats();
        if (stats.signals % 20 === 0) {
          await pi.analyze();
        }
      } catch (err) {
        logWarn('UniversalOrchestratorService', `Post-response hooks error: ${err instanceof Error ? err.message : String(err)}`);
      }
    })();
  }
}

// Singleton
let _service: UniversalOrchestratorService | null = null;
export function getUniversalOrchestratorService(): UniversalOrchestratorService {
  if (!_service) {
    _service = new UniversalOrchestratorService();
  }
  return _service;
}
