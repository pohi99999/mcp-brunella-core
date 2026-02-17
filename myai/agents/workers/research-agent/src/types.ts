// CEAN Research Agent - Type Definitions
// Phase 1A: Research Agent Worker

export interface Env {
  // D1 Database binding
  DB: D1Database;
  
  // Vectorize binding (CREATED: 2026-02-17)
  VECTORIZE?: VectorizeIndex;
  
  // Environment variables
  ENVIRONMENT: string;
  LOG_LEVEL: string;
  
  // API Keys (set via wrangler secrets)
  GITHUB_TOKEN?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}

export interface ResearchQuery {
  query: string;
  sources?: ('github' | 'hackernews' | 'arxiv')[];
  limit?: number;
  dateRange?: {
    from: string; // ISO-8601
    to: string;
  };
}

export interface ResearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
  source: 'github' | 'hackernews' | 'arxiv';
  relevance_score: number;
  published_at: string;
  metadata: Record<string, any>;
}

export interface AnalyzedResult extends ResearchResult {
  confidence_score: number;
  category: string;
  tags: string[];
  summary: string;
}

export interface TaskPayload {
  query: string;
  sources: string[];
  limit: number;
}

export interface EdgeTask {
  id: string;
  agent_type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload: TaskPayload;
  result_data?: any;
  created_at: string;
  updated_at: string;
}
