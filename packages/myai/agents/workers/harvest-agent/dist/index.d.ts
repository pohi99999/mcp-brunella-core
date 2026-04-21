/**
 * CEAN Harvest Agent Worker
 * Responsible for harvesting and collecting data from various sources
 */
import type { D1Database, ExecutionContext, ScheduledEvent } from '@cloudflare/workers-types';
interface Env {
    DB: D1Database;
    ENVIRONMENT: string;
    LOG_LEVEL: string;
}
declare const _default: {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
    scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void>;
};
export default _default;
//# sourceMappingURL=index.d.ts.map