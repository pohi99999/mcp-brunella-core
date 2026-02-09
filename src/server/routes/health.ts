import { Router } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { mcpProcessManager } from '../McpProcessManager.js';
import {
    checkOllamaHealth,
    checkAnythingLLMHealth,
    buildHealthResponse,
} from '../../utils/health.js';

export function createHealthRoutes(): Router {
    const router = Router();

    /**
     * @swagger
     * /api/health:
     *   get:
     *     summary: System Health Check
     *     description: Checks the status of internal components, Ollama, and AnythingLLM.
     *     responses:
     *       200:
     *         description: Health status object
     */
    router.get('/', async (req, res) => {
        try {
            const [ollama, anythingllm] = await Promise.all([
                checkOllamaHealth(),
                checkAnythingLLMHealth(),
            ]);
            const agentsCount = agentManager.listAgents().length;
            const mcpCount = mcpProcessManager.getServersStatus().length;
            const payload = buildHealthResponse(
                ollama,
                anythingllm,
                agentsCount,
                mcpCount,
                (req as unknown as Record<string, unknown>).id as string
            );
            res.json(payload);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ status: 'error', message: msg });
        }
    });

    return router;
}
