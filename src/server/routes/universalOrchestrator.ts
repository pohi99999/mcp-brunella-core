import { Router } from 'express';
import { getUniversalOrchestratorService, type UniversalChatMessage } from '../../core/universalOrchestratorService.js';
import { logInfo, logError } from '../../utils/logger.js';

export function createUniversalOrchestratorRouter(): Router {
  const router = Router();

  /**
   * POST /api/orchestrator/universal
   *
   * Universal chat endpoint: bármely LLM provider segítségével
   * értelmezi az utasítást, és delegál a megfelelő agentnek.
   */
  router.post('/universal', async (req, res) => {
    const { message, provider, model, conversationHistory } = req.body as {
      message?: string;
      provider?: string;
      model?: string;
      conversationHistory?: UniversalChatMessage[];
    };

    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'Hiányzó vagy üres "message" mező.' });
      return;
    }

    const effectiveProvider = provider ?? 'gemini';
    logInfo('UniversalOrchestratorRoute', `POST /universal — provider: ${effectiveProvider}, msg: "${message.slice(0, 60)}..."`);

    try {
      const service = getUniversalOrchestratorService();
      const result = await service.process({
        message: message.trim(),
        provider: effectiveProvider,
        model,
        conversationHistory: conversationHistory ?? []
      });

      res.json(result);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      logError('UniversalOrchestratorRoute', `Hiba: ${error}`);
      res.status(500).json({
        reply: `Belső hiba történt: ${error}`,
        actionsTriggered: [],
        provider: effectiveProvider,
        thinkingMs: 0
      });
    }
  });

  return router;
}
