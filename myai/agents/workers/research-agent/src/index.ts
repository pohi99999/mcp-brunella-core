// CEAN Research Agent Worker
// Purpose: Daily research aggregation from GitHub, HackerNews, arXiv
// Phase 1A Implementation

import { Env, ResearchQuery, AnalyzedResult, EdgeTask } from './types';
import { fetchGitHubTrends } from './sources/github';
import { fetchHackerNews } from './sources/hackernews';
import { fetchArxivPapers } from './sources/arxiv';
import { analyzeWithLLM } from './llm/analyzer';
import { storeResults } from './storage/d1';

export default {
  /**
   * HTTP Request Handler
   * Endpoints:
   *   POST /query - Execute research query
   *   GET /health - Health check
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      // Health check endpoint
      if (url.pathname === '/health' && request.method === 'GET') {
        return new Response(JSON.stringify({
          status: 'healthy',
          worker: 'research-agent',
          version: '1.0.0',
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Research query endpoint
      if (url.pathname === '/query' && request.method === 'POST') {
        const startTime = Date.now();
        
        // Parse request payload
        const payload: ResearchQuery = await request.json();
        const { 
          query, 
          sources = ['github', 'hackernews', 'arxiv'], 
          limit = 50 
        } = payload;

        if (!query || query.trim().length === 0) {
          return new Response(JSON.stringify({
            error: 'Query parameter is required',
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Create task record in D1
        const taskId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await createTask(env.DB, taskId, payload);

        // Execute research
        const results = await executeResearch(query, sources, limit, env);

        // Analyze with LLM
        const analyzed = await analyzeWithLLM(results, query, env);

        // Store results in D1
        await storeResults(env.DB, taskId, analyzed);

        // Update task status
        await updateTaskStatus(env.DB, taskId, 'completed', {
          results_count: analyzed.length,
          duration_ms: Date.now() - startTime,
        });

        // Return top 10 results
        return new Response(JSON.stringify({
          task_id: taskId,
          query,
          results: analyzed.slice(0, 10),
          total_found: analyzed.length,
          sources_queried: sources,
          duration_ms: Date.now() - startTime,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 404 - Not Found
      return new Response(JSON.stringify({
        error: 'Not Found',
        available_endpoints: ['/health', '/query'],
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error: any) {
      console.error('Research Agent Error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },

  /**
   * Scheduled Handler (Cron Trigger)
   * Runs daily at 2 AM UTC
   */
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log('Research Agent - Daily Scheduled Run');
    
    try {
      // Default daily research queries
      const dailyQueries = [
        'LLM inference optimization',
        'Multi-agent systems',
        'Transformer architecture improvements',
        'AI safety and alignment',
        'Edge computing AI deployment',
      ];

      for (const query of dailyQueries) {
        const taskId = `scheduled-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        
        await createTask(env.DB, taskId, {
          query,
          sources: ['github', 'hackernews', 'arxiv'],
          limit: 50,
        });

        const results = await executeResearch(query, ['github', 'hackernews', 'arxiv'], 50, env);
        const analyzed = await analyzeWithLLM(results, query, env);
        await storeResults(env.DB, taskId, analyzed);
        await updateTaskStatus(env.DB, taskId, 'completed', {
          results_count: analyzed.length,
          scheduled: true,
        });

        console.log(`Completed research for: ${query} (${analyzed.length} results)`);
      }

      console.log('Daily research run completed successfully');
    } catch (error: any) {
      console.error('Scheduled run failed:', error);
      throw error;
    }
  },
};

/**
 * Execute research across multiple sources
 */
async function executeResearch(
  query: string,
  sources: string[],
  limit: number,
  env: Env
): Promise<any[]> {
  const results: any[] = [];

  // Parallel fetch from all sources
  const promises = [];

  if (sources.includes('github')) {
    promises.push(fetchGitHubTrends(query, limit, env.GITHUB_TOKEN));
  }

  if (sources.includes('hackernews')) {
    promises.push(fetchHackerNews(query, limit));
  }

  if (sources.includes('arxiv')) {
    promises.push(fetchArxivPapers(query, limit));
  }

  const allResults = await Promise.all(promises);
  
  // Flatten results
  for (const sourceResults of allResults) {
    results.push(...sourceResults);
  }

  return results;
}

/**
 * Create task record in D1
 */
async function createTask(db: D1Database, taskId: string, payload: any): Promise<void> {
  const now = new Date().toISOString();
  
  await db.prepare(`
    INSERT INTO edge_tasks (id, agent_type, status, payload, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    taskId,
    'research',
    'running',
    JSON.stringify(payload),
    now,
    now
  ).run();
}

/**
 * Update task status in D1
 */
async function updateTaskStatus(
  db: D1Database,
  taskId: string,
  status: string,
  resultData?: any
): Promise<void> {
  const now = new Date().toISOString();
  
  await db.prepare(`
    UPDATE edge_tasks
    SET status = ?, result_data = ?, updated_at = ?, completed_at = ?
    WHERE id = ?
  `).bind(
    status,
    resultData ? JSON.stringify(resultData) : null,
    now,
    status === 'completed' ? now : null,
    taskId
  ).run();
}
