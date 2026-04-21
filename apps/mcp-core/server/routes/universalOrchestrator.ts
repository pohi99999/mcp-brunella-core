import { Router } from 'express';
import { getUniversalOrchestratorService, type UniversalChatMessage } from '../../core/universalOrchestratorService.js';
import { logInfo, logError } from '../../utils/logger.js';
import type { OrchestratorAgent, OrchestratorState } from '../../agents/OrchestratorAgent.js';
import { agentManager } from '../../agents/AgentManager.js';

export function createUniversalOrchestratorRouter(): Router {
  const router = Router();

  /**
   * POST /api/orchestrator/universal
   *
   * Universal chat endpoint: bármely LLM provider segítségével
   * értelmezi az utasítást, és delegál a megfelelő agentnek.
   */
  router.post('/universal', async (req, res) => {
    const { message, provider, model, conversationHistory, userId } = req.body as {
      message?: string;
      provider?: string;
      model?: string;
      conversationHistory?: UniversalChatMessage[];
      sessionId?: string;
      userId?: string;
    };

    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'Hiányzó vagy üres "message" mező.' });
      return;
    }

    const effectiveProvider = provider ?? 'github';
    logInfo('UniversalOrchestratorRoute', `POST /universal — provider: ${effectiveProvider}, msg: "${message.slice(0, 60)}..."`);

    try {
      const service = getUniversalOrchestratorService();
      const result = await service.process({
        message: message.trim(),
        provider: effectiveProvider,
        model,
        conversationHistory: conversationHistory ?? [],
        sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
        userId,
      });

      res.json(result);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('UniversalOrchestratorRoute', `Hiba: ${error}`);
      res.status(500).json({
        reply: `Belső hiba történt: ${error}`,
        actionsTriggered: [],
        provider: effectiveProvider,
        thinkingMs: 0,
        sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : 'legacy-anonymous',
        missionTimeline: [{
          phase: 'error',
          status: 'blocked',
          detail: `Route hiba: ${error}`,
          timestamp: new Date().toISOString(),
        }],
      });
    }
  });

  router.get('/state', (_req, res) => {
    const agent = agentManager.getAgent?.('Orchestrator') as OrchestratorAgent | undefined;
    const state: OrchestratorState = agent?.getCurrentState?.() ?? 'IDLE';
    res.json({ state, timestamp: new Date().toISOString() });
  });

  return router;
}
