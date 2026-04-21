/**
 * CEAN Operations Center Type Definitions
 * Fully aligned with D1 schema & Orchestrator Agent
 */

export type WorkerStatus = 'RUNNING' | 'IDLE' | 'ERROR';
export type TaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ChatRole = 'user' | 'bot';

/**
 * Worker Entity (matches D1 edge_workers_status table)
 */
export interface CEANWorker {
  id: string;
  name: string;
  status: WorkerStatus;
  cpu?: number; // percentage 0-100
  memory?: number; // percentage 0-100
  tasks?: number; // queued count
  uptime?: number; // % uptime (0-100)
  lastRun?: Date;
  nextRun?: Date;
  totalRuns?: number;
  totalErrors?: number;
  config?: Record<string, unknown>;
  schedule?: string; // cron format
  enabled: boolean;
}

/**
 * Task Entity (matches D1 edge_tasks table)
 */
export interface CEANTask {
  id: string;
  workerId: string;
  workerName: string;
  status: TaskStatus;
  priority: 'LOW' | 'NORMAL' | 'HIGH';
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  duration?: number; // milliseconds
  cost?: number; // USD
  enqueued: Date;
  started?: Date;
  completed?: Date;
  error?: string;
  embedding_id?: string; // R1 vector reference
}

/**
 * Chat Message
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: Date;
  metadata?: ChatMessageMetadata;
}

export interface ChatMessageMetadata {
  taskId?: string;
  taskStatus?: TaskStatus;
  workerName?: string;
  cost?: number;
  duration?: number;
}

/**
 * Metrics (aggregated, updated every 30s)
 */
export interface CEANMetrics {
  requestsPerHour: number[];
  costAccumulated: number;
  costPerHour: number;
  workerUptime: Record<string, number>;
  avgResponseTime: number; // ms
  errorRate: number; // percentage
  activeWorkers: number;
  tasksInQueue: number;
  tasksCompleted24h: number;
  timestamp: Date;
}

/**
 * D1 Table Schema (Preview)
 */
export interface D1Table {
  name: string;
  rowCount: number;
  sizeKB: number;
  columns: D1Column[];
}

export interface D1Column {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
}

/**
 * R1 Index Info
 */
export interface R1Index {
  name: string;
  dimension: number;
  count: number;
  lastIndexed: Date;
}

/**
 * Vector Search Result
 */
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

/**
 * API Response Wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

/**
 * Task Execution Details (for detail panel)
 */
export interface TaskExecution {
  taskId: string;
  workerId: string;
  workerName: string;
  status: TaskStatus;
  payload: Record<string, unknown>;
  executionLog: ExecutionLogEntry[];
  result?: Record<string, unknown>;
  metrics: {
    duration: number;
    cpuPercent: number;
    memoryMB: number;
    cost: number;
  };
  error?: {
    code: string;
    message: string;
    stack?: string;
  };
}

export interface ExecutionLogEntry {
  timestamp: Date;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
}

/**
 * Orchestrator Prompt Request/Response
 */
export interface OrchestratorPromptRequest {
  message: string;
  userId?: string;
  sessionId?: string;
}

export interface OrchestratorPromptResponse {
  id: string;
  message: string;
  taskId?: string;
  taskStatus?: TaskStatus;
  metadata?: {
    decomposedTasks?: string[];
    delegatedWorkers?: string[];
    estimatedDuration?: number;
    estimatedCost?: number;
  };
}

/**
 * Worker Config (YAML-like structure)
 */
export interface WorkerConfig {
  name: string;
  description: string;
  enabled: boolean;
  schedule: string; // cron
  timeout: number; // seconds
  maxRetries: number;
  env: Record<string, string>;
  params?: Record<string, unknown>;
}

/**
 * Tab Type
 */
export type CEANTabId = 'dashboard' | 'workers' | 'tasks' | 'data' | 'settings';

/**
 * User Settings
 */
export interface CEANSettings {
  language: 'hu' | 'en';
  darkMode: boolean;
  notificationsEnabled: boolean;
  metricsRefreshInterval: number; // seconds
  chatMessageLimit: number;
  defaultRowsPerPage: number;
}
