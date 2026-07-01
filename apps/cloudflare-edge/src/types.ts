// Cloudflare Worker Environment Types

export interface Env {
  // KV Namespaces
  BAS_TASKS: KVNamespace;

  // D1 Database
  DB: D1Database;

  // R2 Buckets
  R2_ARTIFACTS: R2Bucket;

  // Durable Objects
  EDGE_COORDINATOR: DurableObjectNamespace;

  // Workers AI
  AI: Ai;

  // Vectorize
  VECTORIZE_MEMORY: VectorizeIndex;

  // Queues
  TASK_QUEUE: Queue<TaskPayload>;
  RESULT_QUEUE: Queue<TaskResult>;

  // Analytics Engine
  BAS_ANALYTICS: AnalyticsEngineDataset;

  // Workers AI model config
  DEFAULT_CODE_MODEL: string;
  FALLBACK_CODE_MODEL: string;
  REASONING_MODEL: string;
  FAST_MODEL: string;
  R2_PREFIX: string;

  // Workflows
  HEALTH_CHECK_WORKFLOW: Workflow;
  TASK_PIPELINE_WORKFLOW: Workflow;

  // Configuration
  BAS_LOCAL_URL?: string;
  BAS_API_KEY?: string;
  DISCORD_WEBHOOK_URL?: string;
}

export interface TaskResult {
  taskId: string;
  status: "completed" | "failed";
  result?: unknown;
  error?: string;
  agentId?: string;
  durationMs?: number;
  tokensUsed?: number;
}

export interface TaskPayload {
  instruction: string;
  context?: Record<string, unknown>;
  source?: string;
  timestamp?: string;
}

export interface TaskRecord {
  taskId: string;
  type: string;
  status: "pending" | "dispatched" | "completed" | "failed";
  payload: TaskPayload;
  result?: unknown;
  createdAt: string;
  completedAt?: string;
}
