/**
 * PAIOS Orchestrator API Routes — Magyar chat interfész
 */

import { Router } from 'express';
import { processChat } from '../../orchestrator/orchestratorCore.js';
import { socketService } from '../SocketService.js';
import { logInfo, logError } from '../../utils/logger.js';

const router = Router();

/**
 * POST /api/paios/chat
 * Body: { message: string, model?: string }
 */
router.post('/chat', async (req, res) => {
  const { message, model } = req.body as { message: string; model?: string };

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required',
    });
  }

  try {
    logInfo('PAIOSOrchestrator', `Chat request: "${message.slice(0, 80)}..."`);

    const result = await processChat(message, model);

    // Socket.IO broadcast (ha vannak taskek)
    if (result.taskIds && result.taskIds.length > 0) {
      socketService.emit('paios:tasks_created', {
        summary: result.summary,
        taskIds: result.taskIds,
        plan: result.plan,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json(result);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('PAIOSOrchestrator', `Chat endpoint error: ${error}`);
    return res.status(500).json({
      success: false,
      error: error,
      summary: 'Hiba történt a kérés feldolgozása során.',
      plan: [],
      taskIds: [],
    });
  }
});

/**
 * GET /api/paios/status
 * System health + agent registry info
 */
router.get('/status', async (_req, res) => {
  try {
    const { agentManager } = await import('../../agents/AgentManager.js');
    const agents = agentManager.listAgents();

    return res.json({
      success: true,
      agents,
      totalAgents: agents.length,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('PAIOSOrchestrator', `Status endpoint error: ${error}`);
    return res.status(500).json({
      success: false,
      error,
    });
  }
});

/**
 * GET /api/paios/config
 * Return current PAIOS unified configuration
 */
router.get('/config', async (_req, res) => {
  try {
    const { loadPaiosConfig } = await import('../../config/paiosConfig.js');
    const config = loadPaiosConfig();

    return res.json(config);
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    logError('PAIOSOrchestrator', `Config endpoint error: ${error}`);
    return res.status(500).json({
      success: false,
      error,
    });
  }
});

export default router;
