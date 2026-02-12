// Cloudflare Worker Environment Types

export interface Env {
  // KV Namespaces
  BAS_TASKS: KVNamespace;

  // D1 Database
  DB: D1Database;

  // Durable Objects
  EDGE_COORDINATOR: DurableObjectNamespace;

  // Workers AI
  AI: Ai;

  // Configuration
  BAS_LOCAL_URL?: string;
  BAS_API_KEY?: string;
}

export interface TaskPayload {
  instruction: string;
  context?: Record<string, any>;
  source?: string;
  timestamp?: string;
}

export interface TaskRecord {
  taskId: string;
  type: string;
  status: "pending" | "dispatched" | "completed" | "failed";
  payload: TaskPayload;
  result?: any;
  createdAt: string;
  completedAt?: string;
}
