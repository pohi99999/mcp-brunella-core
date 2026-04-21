import type { D1Database } from '@cloudflare/workers-types';
interface Env {
    DB: D1Database;
    ENVIRONMENT: string;
    LOG_LEVEL: string;
}
declare const _default: {
    fetch(request: Request, env: Env): Promise<Response>;
};
export default _default;
