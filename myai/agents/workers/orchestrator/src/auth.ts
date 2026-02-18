import { Env } from './types';

/**
 * API Key Authentication (Phase 6.3 Security Fix)
 * 
 * Purpose: Validate API key for all non-health endpoints
 * - Header: X-CEAN-API-Key
 * - Env var: CEAN_API_KEY (Cloudflare dashboard)
 * - Status: CRITICAL (Go-Live blocker)
 */

export interface AuthResult {
  authorized: boolean;
  error?: string;
}

/**
 * Validate API key from request header
 */
export function validateApiKey(request: Request, env: Env): AuthResult {
  // Extract API key from header
  const providedKey = request.headers.get('X-CEAN-API-Key');

 if (!providedKey) {
    return {
      authorized: false,
      error: 'Missing X-CEAN-API-Key header'
    };
  }

  // Compare with environment variable
  const validKey = env.CEAN_API_KEY;

  if (!validKey) {
    // API key not configured in environment
   

 return {
      authorized: false,
      error: 'API key validation not configured (CEAN_API_KEY missing)'
    };
  }

  if (providedKey !== validKey) {
    return {
      authorized: false,
      error: 'Invalid API key'
    };
  }

  return { authorized: true };
}

/**
 * Return 401 Unauthorized response
 */
export function unauthorizedResponse(error: string): Response {
  return new Response(
    JSON.stringify({
      status: 'error',
      error: 'Unauthorized',
      message: error,
      hint: 'Include X-CEAN-API-Key header with your request'
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * Public endpoints whitelist (no auth required)
 */
export const PUBLIC_ENDPOINTS = [
  '/health',
  '/metrics', // Prometheus scraping (optional: can require separate auth)
];

/**
 * Check if endpoint requires authentication
 */
export function requiresAuth(pathname: string): boolean {
  return !PUBLIC_ENDPOINTS.some(endpoint => pathname.startsWith(endpoint));
}
