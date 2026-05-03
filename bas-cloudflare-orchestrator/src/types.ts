export interface WorkerAI {
  run?: (model: string, input: { prompt?: string; messages?: unknown[] }) => Promise<unknown>;
}

export interface WorkerEnv {
  AI?: WorkerAI;
  D1_METADATA?: {
    prepare: (sql: string) => {
      bind: (...params: unknown[]) => {
        first: <T = Record<string, unknown>>() => Promise<T | null> | T | null;
        all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> | { results: T[] };
        run: () => Promise<{ success?: boolean; meta?: unknown; changes?: number }> | { success?: boolean; meta?: unknown; changes?: number };
      };
      first: <T = Record<string, unknown>>() => Promise<T | null> | T | null;
      all: <T = Record<string, unknown>>() => Promise<{ results: T[] }> | { results: T[] };
      run: () => Promise<{ success?: boolean; meta?: unknown; changes?: number }> | { success?: boolean; meta?: unknown; changes?: number };
    };
  };
  TASK_QUEUE?: { send: (task: unknown, options?: { contentType?: string }) => Promise<unknown> };
  BAS_TASKS?: { get: (key: string) => Promise<string | null> | string | null; put: (key: string, value: string) => Promise<void> | void };
  BAS_ANALYTICS?: { writeDataPoint?: (...args: unknown[]) => unknown };
  SWARM_COORDINATOR?: DurableObjectNamespace;
  FAST_MODEL?: string;
  DEFAULT_CODE_MODEL?: string;
  FALLBACK_CODE_MODEL?: string;
  REASONING_MODEL?: string;
  CLOUDFLARE_API_TOKEN?: string;
  BAS_API_KEY?: string;
  CEAN_API_KEY?: string;
  EDGE_ALLOWED_ORIGINS?: string;
  CORS_ORIGINS?: string;
  R2_PREFIX?: string;
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
  R2_KNOWLEDGE?: R2Bucket;
  RESULT_QUEUE?: { send: (task: unknown, options?: { contentType?: string }) => Promise<unknown> };
  DLQ?: { send: (task: unknown, options?: { contentType?: string }) => Promise<unknown> };
  VECTORIZE_MEMORY?: { query: (vector: number[], options: { topK: number }) => Promise<unknown> };
  VECTORIZE_CEAN?: { query: (vector: number[], options: { topK: number }) => Promise<unknown> };
}

export type RouteAccess = "public" | "protected";

export interface AuthResult {
  ok: true;
}

export interface AuthFailure {
  ok: false;
  status: number;
  error: string;
}

export type WorkerAuthResult = AuthResult | AuthFailure;
