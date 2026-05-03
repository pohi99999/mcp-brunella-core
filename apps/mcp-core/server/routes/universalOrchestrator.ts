import { Router } from 'express';
import { getUniversalOrchestratorService, type UniversalChatMessage } from '@packages/core-logic/universalOrchestratorService.js';
import { logInfo, logError } from '@packages/utils/logger.js';
import type { OrchestratorAgent, OrchestratorState } from '@packages/agents/OrchestratorAgent.js';
import { agentManager } from '@packages/agents/AgentManager.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readConversationHistory(value: unknown): UniversalChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      role: entry.role === 'assistant' ? 'assistant' as const : entry.role === 'user' ? 'user' as const : null,
      content: readString(entry.content),
    }))
    .filter((entry): entry is UniversalChatMessage => entry.role !== null && entry.content !== null);
}

export function createUniversalOrchestratorRouter(): Router {
  const router = Router();

  /**
   * POST /api/orchestrator/universal
   *
   * Universal chat endpoint: bármely LLM provider segítségével
   * értelmezi az utasítást, és delegál a megfelelő agentnek.
   */
  router.post('/universal', async (req, res) => {
    const body = isRecord(req.body) ? req.body : {};
    const message = readString(body.message);
    const provider = readString(body.provider) ?? 'github';
    const model = readString(body.model) ?? undefined;
    const conversationHistory = readConversationHistory(body.conversationHistory);
    const sessionId = readString(body.sessionId) ?? undefined;
    const userId = readString(body.userId) ?? undefined;

    if (!message) {
      res.status(400).json({ error: 'Hiányzó vagy üres "message" mező.' });
      return;
    }

    const effectiveProvider = provider;
    logInfo('UniversalOrchestratorRoute', `POST /universal — provider: ${effectiveProvider}, msg: "${message.slice(0, 60)}..."`);

    try {
      const service = getUniversalOrchestratorService();
      const result = await service.process({
        message,
        provider: effectiveProvider,
        model,
        conversationHistory,
        sessionId,
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
        sessionId: sessionId ?? 'legacy-anonymous',
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
