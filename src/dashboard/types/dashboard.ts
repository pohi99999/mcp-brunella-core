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

export interface MachineAlert {
  id: string;
  title: string;
  priceEur: number;
  estimatedValueEur: number;
  discountPct: number;
  score: number;
  source: string;
  url: string;
  timestamp: string;
  category: string;
  severity: 'critical' | 'warning';
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

export interface BusinessJob {
  id: string;
  type: string;
  status: string;
  query: string;
  results_json?: string | null;
  metadata?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SystemSignalState {
  isConnected: boolean;
  logs: LogEntry[];
  agents: Map<string, AgentRuntimeInfo>;
  tasks: TaskItem[];
  isLoading: boolean;
  error: string | null;
}
