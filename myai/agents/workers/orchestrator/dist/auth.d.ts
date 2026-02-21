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
export declare function validateApiKey(request: Request, env: Env): AuthResult;
/**
 * Return 401 Unauthorized response
 */
export declare function unauthorizedResponse(error: string): Response;
/**
 * Public endpoints whitelist (no auth required)
 */
export declare const PUBLIC_ENDPOINTS: string[];
/**
 * Check if endpoint requires authentication
 */
export declare function requiresAuth(pathname: string): boolean;
//# sourceMappingURL=auth.d.ts.map