import { RobotkezV2Agent } from '../agents/RobotkezV2Agent.js';
import { type AgentResponse } from '../agents/types.js';
import { socketService } from '../server/SocketService.js';
import { type ExecutionPlan, generateExecutionPlan } from '../utils/llmPlanner.js';
import { resolveBrowserCopilotEndpoint } from '../utils/browserEndpoint.js';
import { logError, logInfo, logWarn } from '../utils/logger.js';

export type BrowserCopilotMode = 'observe' | 'guide' | 'auto';
export type BrowserCopilotEnginePreference = 'auto' | 'chrome-acp' | 'robotkez';
export type BrowserCopilotStatus =
  | 'idle'
  | 'planning'
  | 'waiting-confirmation'
  | 'executing'
  | 'paused'
  | 'completed'
  | 'error';

export interface BrowserCopilotMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: number;
}

export interface BrowserCopilotSessionState {
  sessionId: string;
  status: BrowserCopilotStatus;
  mode: BrowserCopilotMode;
  enginePreference: BrowserCopilotEnginePreference;
  browserEndpoint: string;
  viewportEngine: 'chrome-acp' | 'robotkez';
  actionEngine: 'robotkez';
  chromeAcpReachable: boolean;
  overlayEnabled: boolean;
  paused: boolean;
  currentInstruction?: string;
  pendingInstruction?: string;
  plan?: ExecutionPlan;
  lastTaskId?: string;
  lastScreenshotUrl?: string;
  lastUpdatedAt: number;
  messages: BrowserCopilotMessage[];
}

interface ExecuteParams {
  instruction: string;
  history: BrowserCopilotMessage[];
}

export interface BrowserCopilotDependencies {
  executeInstruction: (params: ExecuteParams) => Promise<AgentResponse>;
  generatePlan: (instruction: string, history: BrowserCopilotMessage[]) => Promise<ExecutionPlan>;
  probeChromeAcp: () => Promise<boolean>;
  now: () => number;
  /**
   * Optional: when provided, fusion context is fetched before each planning call
   * and threaded into the LLM prompt via `generateExecutionPlan({ fusionContext })`.
   * When set, this overrides any custom `generatePlan` dep for plan generation.
   */
  getFusionContext?: () => Promise<string>;
}

async function defaultExecuteInstruction({ instruction, history }: ExecuteParams): Promise<AgentResponse> {
  const agent = new RobotkezV2Agent();
  return agent.execute(instruction, {
    backgroundEligible: true,
    swarm: {
      sessionId: 'browser-copilot-session',
      history: history.map((entry) => ({ role: entry.role, content: entry.content })),
      artifacts: {
        source: 'browser-copilot',
      },
    },
  });
}

async function defaultGeneratePlan(instruction: string, history: BrowserCopilotMessage[]): Promise<ExecutionPlan> {
  return generateExecutionPlan(instruction, {
    history: history.map((entry) => ({ role: entry.role, content: entry.content })),
  });
}

async function defaultProbeChromeAcp(): Promise<boolean> {
  try {
    const response = await fetch(resolveBrowserCopilotEndpoint(), { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}

function createId(prefix: string, now: number): string {
  return `${prefix}-${now}-${Math.random().toString(36).slice(2, 8)}`;
}

function summarizePlan(plan: ExecutionPlan): string {
  const steps = plan.plan.slice(0, 3).map((step, index) => `${index + 1}. ${step.description}`).join(' | ');
  return `${plan.plan.length} lépéses terv készült. ${steps}${plan.plan.length > 3 ? ' | …' : ''}`;
}

export class BrowserCopilotSessionService {
  private readonly deps: BrowserCopilotDependencies;

  private state: BrowserCopilotSessionState;

  constructor(deps?: Partial<BrowserCopilotDependencies>) {
    // When getFusionContext is provided, build a fusion-aware plan generator
    // that enriches every plan with the current subsystem context snapshot.
    const getFusionCtx = deps?.getFusionContext;
    const resolvedGeneratePlan: BrowserCopilotDependencies['generatePlan'] = getFusionCtx
      ? async (instruction, history) => {
          const fusionContext = await getFusionCtx().catch(() => '');
          return generateExecutionPlan(instruction, {
            history: history.map((entry) => ({ role: entry.role, content: entry.content })),
            fusionContext,
          });
        }
      : (deps?.generatePlan ?? defaultGeneratePlan);

    this.deps = {
      executeInstruction: deps?.executeInstruction ?? defaultExecuteInstruction,
      generatePlan: resolvedGeneratePlan,
      probeChromeAcp: deps?.probeChromeAcp ?? defaultProbeChromeAcp,
      now: deps?.now ?? (() => Date.now()),
      getFusionContext: getFusionCtx,
    };

    const now = this.deps.now();
    this.state = {
      sessionId: `browser-copilot-${now}`,
      status: 'idle',
      mode: 'auto',
      enginePreference: 'auto',
      browserEndpoint: resolveBrowserCopilotEndpoint(),
      viewportEngine: 'robotkez',
      actionEngine: 'robotkez',
      chromeAcpReachable: false,
      overlayEnabled: true,
      paused: false,
      lastUpdatedAt: now,
      messages: [
        {
          id: createId('system', now),
          role: 'system',
          content: 'Browser Copilot session készen áll. Magyarul adhatsz megfigyelési, guide vagy teljesen automatikus utasításokat.',
          createdAt: now,
        },
      ],
    };
  }

  getState(): BrowserCopilotSessionState {
    return structuredClone(this.state);
  }

  reset(): BrowserCopilotSessionState {
    const now = this.deps.now();
    this.state = {
      sessionId: `browser-copilot-${now}`,
      status: 'idle',
      mode: this.state.mode,
      enginePreference: this.state.enginePreference,
      browserEndpoint: resolveBrowserCopilotEndpoint(),
      viewportEngine: this.state.viewportEngine,
      actionEngine: 'robotkez',
      chromeAcpReachable: this.state.chromeAcpReachable,
      overlayEnabled: this.state.overlayEnabled,
      paused: false,
      lastUpdatedAt: now,
      messages: [
        {
          id: createId('system', now),
          role: 'system',
          content: 'Új Browser Copilot session indult.',
          createdAt: now,
        },
      ],
    };
    this.emitUpdate();
    return this.getState();
  }

  async configure(config: Partial<Pick<BrowserCopilotSessionState, 'mode' | 'enginePreference' | 'overlayEnabled'>>): Promise<BrowserCopilotSessionState> {
    this.state.mode = config.mode ?? this.state.mode;
    this.state.enginePreference = config.enginePreference ?? this.state.enginePreference;
    this.state.overlayEnabled = config.overlayEnabled ?? this.state.overlayEnabled;
    await this.refreshViewport();
    this.touch('idle');
    this.appendMessage('system', `Beállítás frissítve: mód=${this.state.mode}, nézet=${this.state.viewportEngine}, overlay=${this.state.overlayEnabled ? 'on' : 'off'}.`);
    this.emitUpdate();
    return this.getState();
  }

  async pause(): Promise<BrowserCopilotSessionState> {
    this.state.paused = true;
    this.touch('paused');
    this.appendMessage('system', 'A Browser Copilot session szüneteltetve.');
    this.emitUpdate();
    return this.getState();
  }

  async resume(): Promise<BrowserCopilotSessionState> {
    this.state.paused = false;
    this.touch(this.state.pendingInstruction ? 'waiting-confirmation' : 'idle');
    this.appendMessage('system', 'A Browser Copilot session folytatva.');
    this.emitUpdate();
    return this.getState();
  }

  async sendMessage(instruction: string): Promise<BrowserCopilotSessionState> {
    const trimmed = instruction.trim();
    if (!trimmed) {
      throw new Error('Az instruction nem lehet üres.');
    }

    await this.refreshViewport();
    this.state.currentInstruction = trimmed;
    this.appendMessage('user', trimmed);

    if (this.state.paused) {
      this.touch('paused');
      this.appendMessage('assistant', 'A session éppen szünetel. Folytatáshoz nyomd meg a Resume gombot vagy használd a CLI resume parancsot.');
      this.emitUpdate();
      return this.getState();
    }

    this.touch('planning');
    this.emitUpdate();

    try {
      if (this.state.mode === 'observe') {
        const plan = await this.deps.generatePlan(trimmed, this.state.messages);
        this.state.plan = plan;
        this.state.pendingInstruction = undefined;
        this.touch('completed');
        this.appendMessage('assistant', `👀 Observe mód: ${summarizePlan(plan)}`);
        this.emitUpdate();
        return this.getState();
      }

      if (this.state.mode === 'guide') {
        const plan = await this.deps.generatePlan(trimmed, this.state.messages);
        this.state.plan = plan;
        this.state.pendingInstruction = trimmed;
        this.touch('waiting-confirmation');
        this.appendMessage('assistant', `🧭 Guide mód: ${summarizePlan(plan)} Ha mehet, kattints a Megerősítés gombra.`);
        this.emitUpdate();
        return this.getState();
      }

      await this.executeInstruction(trimmed);
      return this.getState();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logError('BrowserCopilotSession', `sendMessage error: ${message}`);
      this.touch('error');
      this.appendMessage('assistant', `❌ Browser Copilot hiba: ${message}`);
      this.emitUpdate();
      return this.getState();
    }
  }

  async confirmPending(): Promise<BrowserCopilotSessionState> {
    if (!this.state.pendingInstruction) {
      this.appendMessage('system', 'Nincs megerősítésre váró guide feladat.');
      this.emitUpdate();
      return this.getState();
    }

    if (this.state.paused) {
      this.appendMessage('assistant', 'A guide végrehajtás szünetel. Előbb folytasd a sessiont.');
      this.emitUpdate();
      return this.getState();
    }

    const { pendingInstruction } = this.state;
    this.state.pendingInstruction = undefined;
    await this.executeInstruction(pendingInstruction);
    return this.getState();
  }

  private async executeInstruction(instruction: string): Promise<void> {
    this.touch('executing');
    this.emitUpdate();

    const response = await this.deps.executeInstruction({
      instruction,
      history: this.state.messages,
    });

    this.state.lastScreenshotUrl = `/api/v1/robotkez/screenshot?t=${this.deps.now()}`;

    if (response.status === 'success') {
      const responseRecord = typeof response.data === 'object' && response.data !== null
        ? response.data as Record<string, unknown>
        : undefined;
      const taskId = typeof responseRecord?.taskId === 'string' ? responseRecord.taskId : undefined;
      this.state.lastTaskId = taskId;
      this.touch(taskId ? 'executing' : 'completed');
      this.appendMessage('assistant', response.message ?? 'A Robotkéz végrehajtotta a feladatot.');
      return;
    }

    const errorMessage = response.error ?? response.message ?? 'Ismeretlen végrehajtási hiba.';
    logWarn('BrowserCopilotSession', `Robotkez execution returned ${response.status}: ${errorMessage}`);
    this.touch('error');
    this.appendMessage('assistant', `❌ A végrehajtás nem sikerült: ${errorMessage}`);
  }

  private async refreshViewport(): Promise<void> {
    this.state.browserEndpoint = resolveBrowserCopilotEndpoint();
    const chromeAcpReachable = await this.deps.probeChromeAcp();
    this.state.chromeAcpReachable = chromeAcpReachable;

    if (this.state.enginePreference === 'robotkez') {
      this.state.viewportEngine = 'robotkez';
      return;
    }

    if (this.state.enginePreference === 'chrome-acp') {
      this.state.viewportEngine = chromeAcpReachable ? 'chrome-acp' : 'robotkez';
      return;
    }

    this.state.viewportEngine = chromeAcpReachable ? 'chrome-acp' : 'robotkez';
  }

  private appendMessage(role: BrowserCopilotMessage['role'], content: string): void {
    const now = this.deps.now();
    this.state.messages = [
      ...this.state.messages,
      {
        id: createId(role, now),
        role,
        content,
        createdAt: now,
      },
    ].slice(-30);
    this.state.lastUpdatedAt = now;
  }

  private touch(status: BrowserCopilotStatus): void {
    this.state.status = status;
    this.state.lastUpdatedAt = this.deps.now();
  }

  private emitUpdate(): void {
    socketService.emit('browser-copilot:update', this.getState());
  }
}

export const browserCopilotSessionService = new BrowserCopilotSessionService();
