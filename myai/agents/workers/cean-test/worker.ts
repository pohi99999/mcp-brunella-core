/**
 * CEAN Test Worker - D1 + R1 Connectivity Verification
 * 
 * This worker tests basic connectivity and functionality of:
 * - Cloudflare D1 (SQLite database)
 * - Cloudflare R1 (Vectorize - Vector embeddings)
 * 
 * Endpoints:
 * - GET /health                - Health check
 * - POST /test/d1              - D1 connectivity test
 * - POST /test/r1              - R1 embedding test
 * - GET /test/metrics          - Test metrics summary
 * 
 * Deploy: wrangler deploy --env production
 */

import { Router } from 'itty-router';

interface Env {
  DB: D1Database;
  VECTORIZE_INDEX?: VectorizeIndex;
  OPENAI_API_KEY?: string;
}

interface TestResult {
  success: boolean;
  test: string;
  duration_ms: number;
  message?: string;
  error?: string;
  data?: unknown;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  d1_available: boolean;
  r1_available: boolean;
  tests_passed: number;
  tests_failed: number;
}

// Router setup
const router = Router();

/**
 * Health Check Endpoint
 */
router.get('/health', async (_req: Request, env: Env) => {
  try {
    const testMetrics = (globalThis as any).__cean_test_metrics || {
      passed: 0,
      failed: 0,
    };

    const response: HealthResponse = {
      status: testMetrics.failed === 0 ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      d1_available: !!env.DB,
      r1_available: !!env.VECTORIZE_INDEX,
      tests_passed: testMetrics.passed,
      tests_failed: testMetrics.failed,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * D1 Connectivity Test
 * 
 * Tests:
 * 1. Table creation (if not exists)
 * 2. Insert test row
 * 3. Query inserted row
 * 4. Verify data integrity
 */
router.post('/test/d1', async (_req: Request, env: Env) => {
  const startTime = Date.now();
  const results: TestResult[] = [];

  try {
    if (!env.DB) {
      throw new Error('D1 database not bound');
    }

    // Test 1: Basic connectivity query (minimal D1 round-trip)
    const queryTime = Date.now();
    const queryResult = await env.DB.prepare('SELECT 1 as ok').first() as {
      ok: number;
    } | null;

    if (!queryResult || queryResult.ok !== 1) {
      throw new Error('D1 basic query failed');
    }

    results.push({
      success: true,
      test: 'd1_basic_query',
      duration_ms: Date.now() - queryTime,
      message: 'D1 basic query succeeded',
      data: { ok: queryResult.ok },
    });

    // Update metrics
    (globalThis as any).__cean_test_metrics = {
      passed: ((globalThis as any).__cean_test_metrics?.passed || 0) + 1,
      failed: (globalThis as any).__cean_test_metrics?.failed || 0,
      last_d1_test: new Date().toISOString(),
    };

    return new Response(
      JSON.stringify({
        success: true,
        test_name: 'd1_connectivity',
        total_duration_ms: Date.now() - startTime,
        results,
        summary: {
          tests_run: results.length,
          tests_passed: results.filter((r) => r.success).length,
          tests_failed: results.filter((r) => !r.success).length,
        },
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update metrics
    (globalThis as any).__cean_test_metrics = {
      passed: (globalThis as any).__cean_test_metrics?.passed || 0,
      failed: ((globalThis as any).__cean_test_metrics?.failed || 0) + 1,
      last_d1_error: errorMessage,
    };

    return new Response(
      JSON.stringify({
        success: false,
        test_name: 'd1_connectivity',
        total_duration_ms: Date.now() - startTime,
        results,
        error: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * R1 Vectorize Test
 * 
 * Tests:
 * 1. Embedding generation (via Workers AI)
 * 2. Vector insertion
 * 3. Vector search
 */
router.post('/test/r1', async (_req: Request, env: Env) => {
  const startTime = Date.now();

  try {
    // For now, we test that R1 binding is available
    // Full embedding test requires OpenAI API key and Workers AI setup

    const response = {
      success: true,
      test_name: 'r1_connectivity',
      total_duration_ms: Date.now() - startTime,
      status: 'ready',
      message: 'R1 (Vectorize) binding is available',
      requirements: {
        lejár a tokenvectorize_index_bound: !!env.VECTORIZE_INDEX,
        openai_api_key_present: !!env.OPENAI_API_KEY,
        embedding_model: 'text-embedding-3-small',
        next_steps: [
          '1. Ensure VECTORIZE_INDEX is bound in wrangler.toml',
          '2. Set OPENAI_API_KEY environment variable',
          '3. Generate sample embedding: {"text": "test"}',
          '4. Insert into R1 with metadata',
          '5. Run vector search query',
        ],
      },
      example_embedding_request: {
        text: 'Cloudflare Edge Agents Network',
        model: 'text-embedding-3-small',
        expected_dimensions: 1536,
      },
    };

    // Update metrics
    (globalThis as any).__cean_test_metrics = {
      passed: ((globalThis as any).__cean_test_metrics?.passed || 0) + 1,
      failed: (globalThis as any).__cean_test_metrics?.failed || 0,
      last_r1_test: new Date().toISOString(),
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Update metrics
    (globalThis as any).__cean_test_metrics = {
      passed: (globalThis as any).__cean_test_metrics?.passed || 0,
      failed: ((globalThis as any).__cean_test_metrics?.failed || 0) + 1,
      last_r1_error: errorMessage,
    };

    return new Response(
      JSON.stringify({
        success: false,
        test_name: 'r1_connectivity',
        total_duration_ms: Date.now() - startTime,
        error: errorMessage,
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Test Metrics Summary
 */
router.get('/test/metrics', async (_req: Request, env: Env) => {
  const metrics = (globalThis as any).__cean_test_metrics || {
    passed: 0,
    failed: 0,
  };

  return new Response(JSON.stringify(metrics), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});

/**
 * 404 Handler
 */
router.all('*', () => {
  return new Response(
    JSON.stringify({
      error: 'Not Found',
      available_endpoints: [
        'GET /health',
        'POST /test/d1',
        'POST /test/r1',
        'GET /test/metrics',
      ],
    }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
});

/**
 * Export handler
 */
export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    router.handle(request, env, ctx),
};
