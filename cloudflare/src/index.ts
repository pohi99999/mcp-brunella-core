/**
 * BAS Cloudflare Worker - Edge Orchestrator
 * 
 * Felelősségek:
 * 1. API Gateway - Külső belépési pont
 * 2. Task Router - AI-alapú osztályozás
 * 3. KV Storage - Elosztott task queue
 * 4. Tunnel Proxy - Lokális rendszer elérés
 * 5. Workers AI - Fallback LLM
 */

import { Env, TaskPayload, TaskRecord } from './types.js';
export { EdgeCoordinator } from './edge-coordinator.js';

// Task típus osztályozás Workers AI-val
async function classifyTask(env: Env, instruction: string): Promise<string> {
  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct' as any, {
      messages: [
        {
          role: 'system',
          content: `You are a task classifier. Classify the following task into ONE of these categories:
- code: Programming, debugging, code review
- research: Information gathering, web search
- data: Data analysis, processing
- browser: Web automation, scraping
- general: Everything else

Respond with ONLY the category name, nothing else.`
        },
        {
          role: 'user',
          content: instruction
        }
      ],
      max_tokens: 10
    }) as { response: string };
    
    return response.response?.trim().toLowerCase() || 'general';
  } catch {
    return 'general';
  }
}

// Lokális BAS elérése tunnelen keresztül
async function forwardToLocal(env: Env, path: string, options: RequestInit = {}): Promise<Response> {
  if (!env.BAS_LOCAL_URL) {
    return new Response(JSON.stringify({ error: 'Local URL not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const url = `${env.BAS_LOCAL_URL}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'X-Forwarded-From': 'cloudflare-worker'
      }
    });
    
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Local system unreachable',
      details: String(error)
    }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-BAS-API-Key',
    };
    
    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Routing
    try {
      // WebSocket / Durable Object routing
      if (path === '/ws' || request.headers.get('Upgrade') === 'websocket') {
        const id = env.EDGE_COORDINATOR.idFromName("global");
        const stub = env.EDGE_COORDINATOR.get(id);
        return stub.fetch(request);
      }

      // Health check
      if (path === '/health' || path === '/') {
        const localHealth = await forwardToLocal(env, '/api/health').catch(() => null);
        const tunnelStatus = localHealth?.ok ? 'connected' : 'disconnected';
        
        return new Response(JSON.stringify({
          status: 'healthy',
          edge: 'cloudflare',
          tunnel: tunnelStatus,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Task submission
      if (path === '/task' && request.method === 'POST') {
        const payload: TaskPayload = await request.json();
        
        if (!payload.instruction) {
          return new Response(JSON.stringify({ error: 'instruction required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Task ID generálás
        const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        
        // Task osztályozás
        const taskType = await classifyTask(env, payload.instruction);
        
        // D1 INSERT
        try {
          await env.DB.prepare(
            `INSERT INTO tasks (id, instruction, status, created_at, updated_at, metadata) VALUES (?, ?, ?, ?, ?, ?)`
          ).bind(
            taskId, 
            payload.instruction, 
            'pending', 
            Date.now(), 
            Date.now(), 
            JSON.stringify({ type: taskType, ...payload })
          ).run();
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Database error', details: String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Notify local system via tunnel (optional, keeping original logic pattern)
        const task: TaskRecord = {
          taskId,
          type: taskType,
          status: 'pending',
          payload,
          createdAt: new Date().toISOString()
        };
        
        // Próbáljuk továbbítani a lokális rendszernek
        const localResponse = await forwardToLocal(env, '/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(task)
        });
        
        if (localResponse.ok) {
          // Update status to dispatched
          await env.DB.prepare(
            `UPDATE tasks SET status = ? WHERE id = ?`
          ).bind('dispatched', taskId).run();
          task.status = 'dispatched';
        }
        
        return new Response(JSON.stringify(task), {
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      // Task status
      if (path.startsWith('/status/')) {
        const taskId = path.split('/')[2];
        
        try {
          const result = await env.DB.prepare(
            `SELECT * FROM tasks WHERE id = ?`
          ).bind(taskId).first();
          
          if (!result) {
            return new Response(JSON.stringify({ error: 'Task not found' }), {
              status: 404,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
          
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Database error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // History endpoint (Phase 3)
      if (path === '/history' && request.method === 'GET') {
        const limit = parseInt(url.searchParams.get('limit') || '20');
        
        try {
          const { results } = await env.DB.prepare(
            `SELECT id, instruction, status, created_at, completed_at FROM tasks ORDER BY created_at DESC LIMIT ?`
          ).bind(limit).all();
          
          return new Response(JSON.stringify({ tasks: results }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: 'Database error', details: String(e) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      
      // API proxy (minden más /api/* útvonal)
      if (path.startsWith('/api/')) {
        return await forwardToLocal(env, path, {
          method: request.method,
          headers: Object.fromEntries(request.headers),
          body: request.method !== 'GET' ? await request.text() : undefined
        });
      }
      
      // Dashboard proxy
      if (path.startsWith('/dashboard')) {
        return await forwardToLocal(env, path.replace('/dashboard', ''), {
          method: request.method,
          headers: Object.fromEntries(request.headers)
        });
      }
      
      // 404
      return new Response(JSON.stringify({ 
        error: 'Not Found',
        availableEndpoints: [
          'GET /health',
          'POST /task',
          'GET /status/:taskId',
          'ANY /api/*',
          'ANY /dashboard/*'
        ]
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal Server Error',
        details: String(error)
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};
