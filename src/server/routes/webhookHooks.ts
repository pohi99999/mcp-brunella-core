// src/server/routes/webhookHooks.ts
// n8n workflow callback hook — automatikus track-státusz frissítés
import { Router } from 'express';
import { fireHook } from '../../core/agentHookEngine.js';
import { logInfo, logError } from '../../utils/logger.js';

export const webhookHooksRouter = Router();

/**
 * @swagger
 * /api/v1/webhook/n8n-hook:
 *   post:
 *     summary: Callback endpoint for n8n workflows
 *     tags: [Hooks]
 */
webhookHooksRouter.post('/n8n-hook', async (req, res) => {
  const { workflowId, status, data } = req.body;
  
  logInfo('WebhookHook', `n8n workflow callback received: ${workflowId} (${status})`);

  try {
    await fireHook(`n8n:workflow:${status || 'completed'}`, {
      agentName: 'n8nBridge',
      task: workflowId || 'unknown',
      result: data,
      timestamp: Date.now()
    });
    
    res.json({ success: true, message: 'Hook processed' });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError('WebhookHook', `Failed to fire n8n hook: ${msg}`);
    res.status(500).json({ success: false, error: msg });
  }
});
