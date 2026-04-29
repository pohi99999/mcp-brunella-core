/**
 * PAIOS Orchestrator API Routes — Magyar chat interfész
 */

import { Router } from 'express';
import { getUniversalOrchestratorService, type UniversalChatMessage } from '@packages/core-logic/universalOrchestratorService.js';
import { socketService } from '@packages/agents/SocketService.js';
import { logInfo, logError } from '@packages/utils/logger.js';

const router = Router();

/**
 * POST /api/paios/chat
 * Body: { message: string, model?: string }
 */
router.post('/chat', async (req, res) => {
  const { message, model, provider, conversationHistory } = req.body as {
    message: string;
    model?: string;
    provider?: string;
    conversationHistory?: UniversalChatMessage[];
    sessionId?: string;
  };

  if (!message?.trim()) {
    return res.status(400).json({
      success: false,
      error: 'message is required',
    });
  }

  try {
    const providerFromModel = model && ['gemini', 'github', 'ollama', 'anthropic', 'claude', 'cloudflare'].includes(model)
      ? model
      : undefined;
    const effectiveProvider = provider ?? providerFromModel ?? 'github';
    const effectiveModel = providerFromModel
      ? undefined
      : model ?? (effectiveProvider === 'github' ? 'gpt-4.1' : undefined);

    logInfo(
      'PAIOSOrchestrator',
      `Chat request (${effectiveProvider}${effectiveModel ? `/${effectiveModel}` : ''}): "${message.slice(0, 80)}..."`
    );

    socketService.broadcastDebug('PAIOS Chat Request', {
      message,
      provider: effectiveProvider,
      model: effectiveModel,
      sessionId: req.body?.sessionId,
    });

    const service = getUniversalOrchestratorService();
    const universalResult = await service.process({
      message,
      provider: effectiveProvider,
      model: effectiveModel,
      conversationHistory: conversationHistory ?? [],
      sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
    });

    socketService.broadcastDebug('PAIOS Orchestrator Result', universalResult);

    const taskIds = universalResult.actionsTriggered.map((action) => action.taskId);

    // Socket.IO broadcast (ha vannak taskok)
    if (taskIds.length > 0) {
      socketService.emit('paios:tasks_created', {
        summary: universalResult.reply,
        taskIds,
        plan: [],
        actionsTriggered: universalResult.actionsTriggered,
        timestamp: new Date().toISOString(),
      });
    }

    return res.json({
      success: true,
      summary: universalResult.reply,
      reply: universalResult.reply,
      plan: [],
      taskIds,
      actionsTriggered: universalResult.actionsTriggered,
      provider: universalResult.provider,
      model: universalResult.model,
      role: universalResult.role,
      thinkingMs: universalResult.thinkingMs,
      sessionId: universalResult.sessionId,
      suggestions: universalResult.suggestions,
      missionTimeline: universalResult.missionTimeline,
      approvalRequired: universalResult.approvalRequired,
      approvalId: universalResult.approvalId,
      riskLevel: universalResult.riskLevel,
      runbookHint: universalResult.runbookHint,
      fallbackUsed: universalResult.fallbackUsed,
      fallbackReason: universalResult.fallbackReason,
      phoenixTriggered: universalResult.phoenixTriggered,
    });
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
    const { agentManager } = await import('@packages/agents/AgentManager.js');
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
    const { loadPaiosConfig } = await import('@packages/utils/paiosConfig.js');
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
