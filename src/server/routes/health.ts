import { Router } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { mcpProcessManager } from '../McpProcessManager.js';
import {
    checkOllamaHealth,
    checkAnythingLLMHealth,
    buildHealthResponse,
} from '../../utils/health.js';
import { AppError } from '../../utils/AppError.js';
import { asyncHandler } from '../middleware/errorHandler.js';

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
    router.get('/', asyncHandler(async (req, res) => {
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
    }));

    return router;
}
