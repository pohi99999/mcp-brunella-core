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
declare const _default: {
    fetch(request: Request, env: WorkerEnv, _ctx: unknown): Promise<Response>;
    scheduled(_request: Request, env: WorkerEnv, _ctx: unknown): Promise<void>;
};
export default _default;
