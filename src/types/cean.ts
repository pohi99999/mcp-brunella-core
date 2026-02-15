/**
 * CEAN Type Definitions
 * Cloudflare Edge Agents Network - Type-safe interfaces
 * 
 * Aligned with D1 schema: d1_schema.sql
 */

// ============================================================================
// Agent Types & Enums
// ============================================================================

export type AgentType = 'research' | 'grant' | 'harvest' | 'extract' | 'builder';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type WorkerStatus = 'online' | 'offline' | 'degraded' | 'maintenance';
export type ExecutionStatus = 'running' | 'success' | 'failure' | 'timeout';
export type ResultType = 'research' | 'grant' | 'harvested' | 'extracted' | 'prediction';
export type EventType = 'task_created' | 'task_completed' | 'error' | 'config_change';

// ============================================================================
// Task Queue
// ============================================================================

export interface EdgeTask {
  id: string;
  agent_type: AgentType;
  status: TaskStatus;
  priority: number; // 1-10
  payload: Record<string, unknown>;
  assigned_worker_id?: string;
  started_at?: string;
  completed_at?: string;
  result_data?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
  updated_at: string;
  retry_count: number;
  max_retries: number;
  tags?: string;
  request_id?: string;
  estimated_cost?: number;
  actual_cost?: number;
  duration_seconds?: number;
}

export interface CreateTaskRequest {
  agent_type: AgentType;
  payload: Record<string, unknown>;
  priority?: number;
  max_retries?: number;
  tags?: string[];
  request_id?: string;
}

export interface UpdateTaskRequest {
  status?: TaskStatus;
  result_data?: Record<string, unknown>;
  error_message?: string;
  retry_count?: number;
  actual_cost?: number;
  duration_seconds?: number;
}

// ============================================================================
// Execution Logs
// ============================================================================

export interface EdgeExecution {
  id: string;
  task_id: string;
  worker_name: string;
  worker_version?: string;
  worker_region?: string;
  start_time: string;
  end_time?: string;
  duration_ms?: number;
  cpu_ms?: number;
  wall_clock_ms?: number;
  memory_mb?: number;
  data_transferred_mb?: number;
  status: ExecutionStatus;
  exit_code?: number;
  signal?: string;
  stdout_log?: string;
  stderr_log?: string;
  cost_usd?: number;
  created_at: string;
}

// ============================================================================
// Results & Findings
// ============================================================================

export interface EdgeResult {
  id: string;
  task_id: string;
  result_type: ResultType;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  relevance_score?: number; // 0-100
  confidence_score?: number; // 0-100
  embedding_id?: string;
  embedding_model?: string;
  category?: string;
  tags?: string;
  source_url?: string;
  source_name?: string;
  created_at: string;
  synced_to_r1_at?: string;
  expires_at?: string;
}

export interface CreateResultRequest {
  task_id: string;
  result_type: ResultType;
  title: string;
  description?: string;
  content: Record<string, unknown>;
  relevance_score?: number;
  confidence_score?: number;
  category?: string;
  tags?: string[];
  source_url?: string;
  source_name?: string;
}

// ============================================================================
// Metrics & Monitoring
// ============================================================================

export interface EdgeMetrics {
  id: string;
  bucket_date: string; // YYYY-MM-DD
  bucket_hour?: string; // YYYY-MM-DD HH:00
  agent_type: AgentType;
  tasks_total: number;
  tasks_completed: number;
  tasks_failed: number;
  tasks_skipped: number;
  avg_duration_ms?: number;
  max_duration_ms?: number;
  min_duration_ms?: number;
  results_found: number;
  total_cost_usd: number;
  avg_cost_per_task?: number;
  error_count: number;
  error_rate?: number;
  uptime_percent?: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Worker Status & Health
// ============================================================================

export interface EdgeWorkerStatus {
  id: string;
  worker_name: string;
  worker_version?: string;
  status: WorkerStatus;
  last_heartbeat?: string;
  uptime_24h: number;
  uptime_7d: number;
  uptime_30d: number;
  avg_latency_ms: number;
  error_rate_24h: number;
  monthly_cost_usd: number;
  config?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Audit Log
// ============================================================================

export interface EdgeAuditLog {
  id: string;
  event_type: EventType;
  entity_type?: string;
  entity_id?: string;
  actor?: string;
  action: string;
  details?: Record<string, unknown>;
  created_at: string;
}

// ============================================================================
// Worker Request/Response Types
// ============================================================================

/**
 * Payload sent TO a worker (via Durable Objects or Worker input)
 */
export interface WorkerRequest {
  taskId: string;
  agentType: AgentType;
  payload: Record<string, unknown>;
  requestId?: string;
  timestamp: string;
}

/**
 * Response FROM a worker
 */
export interface WorkerResponse {
  taskId: string;
  status: ExecutionStatus;
  duration_ms: number;
  result?: Record<string, unknown>;
  error?: string;
  metrics?: {
    cpuMs: number;
    memoryMb: number;
    dataTransferedMb: number;
  };
}

// ============================================================================
// Cost Model
// ============================================================================

export interface CostEstimate {
  agentType: AgentType;
  estimatedCPU_ms: number;
  estimatedRequests: number;
  estimatedDataTransfer_mb: number;
  estimatedCost_usd: number;
  currency: 'USD';
}

// ============================================================================
// R1 (Vector Store) Types
// ============================================================================

/**
 * Vector metadata for R1 semantic search
 * Generated from EdgeResult content
 */
export interface R1VectorMetadata {
  id: string; // Unique in R1
  taskId: string;
  resultId: string;
  type: ResultType;
  title: string;
  embedding: number[]; // Vector (1024 or 1536 dims)
  metadata: {
    source: string;
    relevance: number;
    created_at: string;
    tags: string[];
  };
}

// ============================================================================
// API Query/Filter Types
// ============================================================================

export interface TaskQueryFilter {
  agent_type?: AgentType;
  status?: TaskStatus;
  priority?: number;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
}

export interface ResultQueryFilter {
  result_type?: ResultType;
  task_id?: string;
  relevance_min?: number;
  created_after?: string;
  created_before?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Configuration
// ============================================================================

export interface CEANConfig {
  version: string;
  cloudflareAccountId: string;
  workers: {
    research: { version: string; enabled: boolean };
    grant: { version: string; enabled: boolean };
    harvest: { version: string; enabled: boolean };
    extract: { version: string; enabled: boolean };
    builder: { version: string; enabled: boolean };
  };
  database: {
    d1_id: string;
    d1_binding: string;
  };
  vector: {
    r1_id: string;
    r1_binding: string;
  };
  schedules: {
    research: string; // cron: "0 2 * * *" (nightly 2am)
    grant: string; // cron: "0 8 * * *" (daily 8am)
    harvest: string; // on-demand
    extract: string; // on-demand
    builder: string; // webhook-triggered
  };
}

// ============================================================================
// Enums for REST API
// ============================================================================

export enum HttpStatus {
  OK = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  InternalError = 500,
  ServiceUnavailable = 503,
}

export interface ApiResponse<T> {
  success: boolean;
  status: HttpStatus;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// ============================================================================
// Version Info
// ============================================================================

export const CEAN_TYPES_VERSION = '1.0.0';
export const CEAN_D1_SCHEMA_VERSION = '1.0.0';
export const CEAN_SUPPORTED_WORKERS = ['research', 'grant', 'harvest', 'extract', 'builder'] as const;
