/**
 * CopilotBridgeState — Shared state for Copilot CLI ↔ Dashboard communication
 * 
 * In-memory store that tracks Copilot CLI activity, dispatch results,
 * and provides a bridge for the CopilotCommanderPanel to display real-time data.
 * 
 * Also exposed via REST API for the CLI bridge (copilot-dashboard.js) to push updates.
 */

export interface CopilotCommand {
  id: string;
  timestamp: string;
  domain: string;
  action: string;
  params?: Record<string, unknown>;
  status: 'pending' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface AgentDispatchResult {
  id: string;
  timestamp: string;
  agentName: string;
  task: string;
  status: 'queued' | 'running' | 'success' | 'error';
  result?: unknown;
  error?: string;
  durationMs?: number;
}

export interface BridgeStats {
  totalCommands: number;
  successCount: number;
  errorCount: number;
  lastCommandAt: string | null;
  activeDispatches: number;
  uptimeSince: string;
}

class CopilotBridgeStateManager {
  private commands: CopilotCommand[] = [];
  private dispatches: AgentDispatchResult[] = [];
  private readonly maxHistory = 200;
  private readonly uptimeSince: string;

  constructor() {
    this.uptimeSince = new Date().toISOString();
  }

  addCommand(cmd: Omit<CopilotCommand, 'id' | 'timestamp'>): CopilotCommand {
    const entry: CopilotCommand = {
      ...cmd,
      id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    this.commands.unshift(entry);
    if (this.commands.length > this.maxHistory) {
      this.commands = this.commands.slice(0, this.maxHistory);
    }
    return entry;
  }

  updateCommand(id: string, update: Partial<CopilotCommand>): CopilotCommand | null {
    const cmd = this.commands.find(c => c.id === id);
    if (cmd) {
      Object.assign(cmd, update);
    }
    return cmd ?? null;
  }

  addDispatch(dispatch: Omit<AgentDispatchResult, 'id' | 'timestamp'>): AgentDispatchResult {
    const entry: AgentDispatchResult = {
      ...dispatch,
      id: `dsp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
    };
    this.dispatches.unshift(entry);
    if (this.dispatches.length > this.maxHistory) {
      this.dispatches = this.dispatches.slice(0, this.maxHistory);
    }
    return entry;
  }

  updateDispatch(id: string, update: Partial<AgentDispatchResult>): AgentDispatchResult | null {
    const d = this.dispatches.find(x => x.id === id);
    if (d) {
      Object.assign(d, update);
    }
    return d ?? null;
  }

  getRecentCommands(limit = 50): CopilotCommand[] {
    return this.commands.slice(0, limit);
  }

  getRecentDispatches(limit = 50): AgentDispatchResult[] {
    return this.dispatches.slice(0, limit);
  }

  getStats(): BridgeStats {
    const successCount = this.commands.filter(c => c.status === 'success').length;
    const errorCount = this.commands.filter(c => c.status === 'error').length;
    const activeDispatches = this.dispatches.filter(d => d.status === 'running' || d.status === 'queued').length;

    return {
      totalCommands: this.commands.length,
      successCount,
      errorCount,
      lastCommandAt: this.commands[0]?.timestamp ?? null,
      activeDispatches,
      uptimeSince: this.uptimeSince,
    };
  }

  clear(): void {
    this.commands = [];
    this.dispatches = [];
  }
}

// Singleton instance
export const copilotBridgeState = new CopilotBridgeStateManager();
