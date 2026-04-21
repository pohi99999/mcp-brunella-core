import { Router } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { heartbeatMonitor } from '../../utils/heartbeatMonitor.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { Logger } from '../../utils/logger.js';

const logger = new Logger("dashboard_api.log");

export function createDashboardRoutes(): Router {
    const router = Router();

    router.get('/status', async (req, res) => {
        try {
            const health = await heartbeatMonitor.getAggregatedHealth();
            const agentStatuses = agentManager.listAgentStatuses();
            const mcpServers = await (async () => {
                // Dynamic import to avoid circular dependency in some cases
                const { mcpProcessManager } = await import('../McpProcessManager.js');
                return mcpProcessManager.getServersStatus();
            })();
            const db = getGlobalDb();
            const dbStatus = db.open ? 'connected' : 'disconnected';

            // Simplified component render check (for CLI, this is mostly conceptual)
            const uiRenderCheck = true; // Assume UI components render correctly on server-side request context

            // Simplified socket responsiveness check (for CLI, check server's socket.io instance state)
            const socketResponsive = agentManager.socketService.connectedClientsCount > 0 ? true : false; // Check if any clients are connected

            const overallStatus = 
                health.status === 'healthy' && dbStatus === 'connected' && socketResponsive 
                    ? 'HEALTHY' 
                    : 'DEGRADED';

            res.json({
                status: overallStatus,
                components: {
                    backendHealth: health,
                    agents: agentStatuses,
                    mcp: mcpServers,
                    database: { status: dbStatus },
                    uiRender: { status: uiRenderCheck ? 'ok' : 'error', message: uiRenderCheck ? 'N/A (kliens oldali check)' : 'error'},
                    socket: { status: socketResponsive ? 'ok' : 'disconnected', message: socketResponsive ? 'Legalább egy kliens csatlakozva.' : 'Nincs kliens csatlakozva.'}
                },
                timestamp: new Date().toISOString()
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            logger.error(`Dashboard status API error: ${msg}`);
            res.status(500).json({ status: 'ERROR', error: msg, timestamp: new Date().toISOString() });
        }
    });

    return router;
}
