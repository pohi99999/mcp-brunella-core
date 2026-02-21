/**
 * CEAN Orchestrator Worker
 *
 * Purpose: Coordinate all edge agents (Research, Grant, Harvester)
 * - Task queue management via D1
 * - Agent scheduling
 * - Result aggregation
 * - Error handling + retry logic
 *
 * Routes:
 *   POST /schedule/{agent_type}  - Queue new task
 *   GET  /task/{task_id}         - Get task status
 *   GET  /health                 - Health check
 *   GET  /stats                  - Usage stats
 */
import { Env } from './types.js';
declare const _default: {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
    /**
     * Scheduled Handler: D1 Backup to KV (Phase 6.2)
     * Runs every 15 minutes via Cron Trigger
     */
    scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map