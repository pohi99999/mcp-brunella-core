/**
 * Dashboard Unified Types - A Dashboard V3 típusbiztonsági rétege
 */

export type AgentStatusType = "idle" | "working" | "error" | "loaded";

export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success' | 'warning';
  timestamp: number;
  source?: string;
}

export interface AgentRuntimeInfo {
  name: string;
  role?: string;
  description: string;
  status: AgentStatusType;
  lastTaskAt?: string;
  lastTask?: string;
  successCount: number;
  errorCount: number;
}

export interface TaskItem {
  id: number;
  agent: string;
  task: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'cancelled' | 'paused';
  created_at: string;
  completed_at?: string | null;
  context?: any;
  result?: any;
}

export interface SystemSignalState {
  isConnected: boolean;
  logs: LogEntry[];
  agents: Map<string, AgentRuntimeInfo>;
  tasks: TaskItem[];
  isLoading: boolean;
  error: string | null;
}
