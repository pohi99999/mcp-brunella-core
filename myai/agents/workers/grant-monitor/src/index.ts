/**
 * Grant Monitor Worker - Entry Point
 * Cloudflare Worker for monitoring funding opportunities
 *
 * Features:
 * - Scheduled grants.gov checks (daily)
 * - RESTful API for querying grants
 * - D1 database storage
 * - Real-time updates
 */

import { WorkerEnv } from './types.js';
import { Logger } from './utils/logger.js';
import { GrantD1Storage } from './storage/d1.js';
import { GrantsGovSource } from './sources/grants-gov.js';

const logger = new Logger('GrantMonitor');

// Handler for scheduled triggers (cron jobs)
async function handleScheduled(_request: Request, env: WorkerEnv, _ctx: unknown): Promise<Response> {
  try {
    logger.info('🔄 Scheduled grant check triggered');

    const db = new GrantD1Storage(env.DB);
    const grantsGovSource = new GrantsGovSource();

    // Initialize database on first run
    await db.initialize();

    // Fetch from Grants.gov
    const result = await grantsGovSource.fetchGrants();

    if (result.success) {
      // Store grants in D1
      const storeResult = await db.storeGrantsBatch(result.grants);

      // Record the check
      await db.recordGrantCheck('grants-gov', result.count);

      logger.info(`✅ Scheduled check complete: ${storeResult.data || 0} grants stored`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${result.count} grants from Grants.gov`,
          stored: storeResult.data,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      logger.error('Failed to fetch grants from Grants.gov');
      await db.recordGrantCheck('grants-gov', 0, 'Fetch failed');

      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch grants',
          timestamp: new Date().toISOString(),
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    logger.error('Scheduled handler error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Health check endpoint
async function handleHealth(env: WorkerEnv): Promise<Response> {
  try {
    const db = new GrantD1Storage(env.DB);
    const stats = await db.getStats();

    return new Response(
      JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: stats.success ? 'connected' : 'error',
        stats: stats.data,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Search endpoint
async function handleSearch(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const keyword = url.searchParams.get('keyword');
    const agency = url.searchParams.get('agency');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const db = new GrantD1Storage(env.DB);

    const result = await db.searchGrants({
      keyword: keyword || undefined,
      agency: agency || undefined,
      limit,
    });

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Search handler error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Upcoming grants endpoint
async function handleUpcoming(request: Request, env: WorkerEnv): Promise<Response> {
  try {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const db = new GrantD1Storage(env.DB);
    const result = await db.getUpcomingGrants(limit);

    return new Response(JSON.stringify(result), {
      status: result.success ? 200 : 400,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Upcoming handler error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Manual trigger endpoint
async function handleTrigger(_request: Request, env: WorkerEnv, _ctx: unknown): Promise<Response> {
  try {
    logger.info('📊 Manual grant check triggered via HTTP');

    const db = new GrantD1Storage(env.DB);
    const grantsGovSource = new GrantsGovSource();

    // Initialize database
    await db.initialize();

    // Fetch grants
    const result = await grantsGovSource.fetchGrants();

    if (result.success) {
      const storeResult = await db.storeGrantsBatch(result.grants);
      await db.recordGrantCheck('grants-gov', result.count);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Processed ${result.count} grants`,
          stored: storeResult.data,
          timestamp: new Date().toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Failed to fetch grants' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    logger.error('Trigger handler error', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Main request handler
export default {
  async fetch(request: Request, env: WorkerEnv, _ctx: unknown): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    logger.info(`📨 ${request.method} ${pathname}`);

    // Route handling
    if (pathname === '/health') {
      return handleHealth(env);
    }

    if (pathname === '/search') {
      return handleSearch(request, env);
    }

    if (pathname === '/upcoming') {
      return handleUpcoming(request, env);
    }

    if (pathname === '/trigger') {
      return handleTrigger(request, env, _ctx);
    }

    // Default 404
    return new Response(
      JSON.stringify({
        status: 'error',
        message: 'Not found',
        availableEndpoints: ['/health', '/search', '/upcoming', '/trigger'],
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  },

  async scheduled(_request: Request, env: WorkerEnv, _ctx: unknown): Promise<void> {
    await handleScheduled(_request, env, _ctx);
  },
};
