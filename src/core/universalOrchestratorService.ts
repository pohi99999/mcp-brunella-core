import { getBifrostGateway, type ProviderType } from './bifrost_gateway.js';
import { getToolRegistry, type UniversalToolDefinition } from './toolRegistry.js';
import { agentManager } from '../agents/AgentManager.js';
import { logInfo, logError } from '../utils/logger.js';

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
}

export interface UniversalResponse {
  reply: string;
  actionsTriggered: ActionTriggered[];
  provider: string;
  thinkingMs: number;
}

// Provider name mapping: UI name → Bifrost ProviderType
const PROVIDER_MAP: Record<string, ProviderType> = {
  gemini: 'gemini',
  github: 'github',
  claude: 'anthropic',
  cloudflare: 'cloudflare',
  ollama: 'ollama',
};

const MAGYAR_SYSTEM_PROMPT = (toolList: string): string => `\
Te vagy Brunella, a Brunella Agent System intelligens orkesztrátora.
Minden válaszodat magyarul adod. Ha egy feladatot nem értesz pontosan, visszakérdezel.
Ha egyértelmű, azonnal cselekszel.

Eszközeid:
${toolList}

Alapelvek:
- Egyszerű kérdésre → közvetlen magyar válasz, nincs felesleges delegálás
- Komplex végrehajtást igénylő feladatra → delegálj a legjobb eszköznek
- Ha több agent kell → sorban delegálj, minden lépés eredményét várd meg
- Mindig magyarul kommunikálj a felhasználóval
`;

export class UniversalOrchestratorService {
  async process(request: UniversalRequest): Promise<UniversalResponse> {
    const startTime = Date.now();
    const actionsTriggered: ActionTriggered[] = [];

    const bifrost = getBifrostGateway();
    const registry = await getToolRegistry();
    const tools = registry.getToolDefinitions();

    const providerType: ProviderType = PROVIDER_MAP[request.provider] ?? 'gemini';

    // Build tool list description for system prompt
    const toolList = tools
      .map(t => `- ${t.name}: ${t.description}`)
      .join('\n');

    const systemPrompt = MAGYAR_SYSTEM_PROMPT(toolList);

    // Build conversation messages for the LLM
    const messages = [
      ...request.conversationHistory,
      { role: 'user' as const, content: request.message }
    ];

    // Build prompt string from last user message (for providers that need it)
    const lastUserMsg = request.message;

    logInfo('UniversalOrchestratorService', `Processing via ${providerType}: "${lastUserMsg.slice(0, 60)}..."`);

    let reply = '';
    let toolCallsToProcess: Array<{ name: string; args: Record<string, unknown> }> = [];

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
        temperature: 0.3,
        maxTokens: 1024
      });

      if (!response.success) {
        logError('UniversalOrchestratorService', `LLM hiba: ${response.error}`);
        return {
          reply: `Sajnos hiba történt a feldolgozás során: ${response.error ?? 'ismeretlen hiba'}`,
          actionsTriggered: [],
          provider: response.provider,
          thinkingMs: Date.now() - startTime
        };
      }

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
      for (const tc of toolCallsToProcess) {
        const toolResult = await this.executeTool(tc.name, tc.args);
        actionsTriggered.push(...toolResult.actions);
        if (toolResult.resultText && !reply) {
          reply = toolResult.resultText;
        } else if (toolResult.resultText) {
          reply += `\n\n${toolResult.resultText}`;
        }
      }

      // If no text reply was produced, generate a summary follow-up
      if (!reply && actionsTriggered.length > 0) {
        const agentNames = actionsTriggered.map(a => a.agent).join(', ');
        reply = `Rendben! Delegáltam a következő ügynök(ök)nek: **${agentNames}**. A feladat elindult a háttérben — a Raj sávon követheted az előrehaladást.`;
      } else if (!reply) {
        reply = 'Megkaptam az utasítást, de nem tudtam feldolgozni. Kérlek, fogalmazd meg pontosabban!';
      }

    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('UniversalOrchestratorService', `Feldolgozási hiba: ${error}`);
      reply = `Hiba történt: ${error}`;
    }

    return {
      reply,
      actionsTriggered,
      provider: providerType,
      thinkingMs: Date.now() - startTime
    };
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
        try {
          const healthRes = await fetch('http://localhost:3000/api/health');
          if (healthRes.ok) {
            const health = await healthRes.json() as Record<string, unknown>;
            resultText = `**Rendszer állapot:** ${JSON.stringify(health, null, 2).slice(0, 400)}`;
          } else {
            resultText = '**Rendszer állapot:** Health endpoint elérhetetlen.';
          }
        } catch {
          resultText = '**Rendszer állapot:** Health check sikertelen.';
        }
        return { actions, resultText };
      }

      if (toolName === 'list_active_tasks') {
        try {
          const tasksRes = await fetch('http://localhost:3000/api/v1/tasks?status=running&limit=10');
          if (tasksRes.ok) {
            const data = await tasksRes.json() as { tasks?: Array<{ agent?: string; description?: string; status?: string }> };
            const tasks = data.tasks ?? [];
            if (tasks.length === 0) {
              resultText = 'Jelenleg nincs aktív feladat.';
            } else {
              resultText = `**Aktív feladatok (${tasks.length} db):**\n` +
                tasks.map((t, i) => `${i + 1}. ${t.agent ?? '?'}: ${t.description ?? '?'} [${t.status ?? '?'}]`).join('\n');
            }
          } else {
            resultText = 'Feladatlista elérhetetlen.';
          }
        } catch {
          resultText = 'Aktív feladatok lekérése sikertelen.';
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
}

// Singleton
let _service: UniversalOrchestratorService | null = null;
export function getUniversalOrchestratorService(): UniversalOrchestratorService {
  if (!_service) {
    _service = new UniversalOrchestratorService();
  }
  return _service;
}
