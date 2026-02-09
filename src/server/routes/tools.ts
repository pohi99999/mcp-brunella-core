import { Router } from 'express';
import { toolManager } from '../ToolManager.js';
import { socketService } from '../SocketService.js';

export function createToolRoutes(): Router {
    const router = Router();

    router.get('/', (req, res) => {
        try {
            const tools = toolManager.getToolDefinitions();
            res.json({ tools });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, tools: [] });
        }
    });

    router.post('/:toolName/execute', async (req, res) => {
        try {
            const { toolName } = req.params;
            const args = req.body;

            const result = await toolManager.executeTool(toolName, args);
            res.json({ result });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createDebugRoutes(): Router {
    const router = Router();

    router.post('/broadcast-log', (req, res) => {
        try {
            const { message, type = 'info', source } = req.body;
            if (!message) {
                res.status(400).json({ error: 'message is required' });
                return;
            }
            socketService.broadcastLog(message, type, source);
            res.json({ ok: true, message: 'Log broadcast sent' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/agent-status', (req, res) => {
        try {
            const { agentName, status, taskDescription } = req.body;
            if (!agentName || !status) {
                res.status(400).json({ error: 'agentName and status are required' });
                return;
            }
            socketService.updateAgentStatus(agentName, status, taskDescription);
            res.json({ ok: true, message: 'Agent status update sent' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
