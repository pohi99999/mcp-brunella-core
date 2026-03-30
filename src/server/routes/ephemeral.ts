/**
 * Ephemeral Agent HTTP Route
 *
 * POST   /api/v1/ephemeral/spawn     — új ephemeral agent indítása
 * GET    /api/v1/ephemeral           — lista
 * GET    /api/v1/ephemeral/:id       — egyedi rekord
 * DELETE /api/v1/ephemeral/:id       — manuális terminálás
 */
import { Router } from 'express';
import { ephemeralAgentManager } from '../../core/ephemeralAgentManager.js';
import type { EphemeralAgentSpec } from '../../core/ephemeralAgentManager.js';
import { logInfo } from '../../utils/logger.js';

export function createEphemeralRouter(): Router {
  const router = Router();

  /** Ephemeral agent indítása */
  router.post('/spawn', async (req, res): Promise<void> => {
    try {
      const spec = req.body as EphemeralAgentSpec;
      if (!spec.parentAgentName || !spec.purpose || !Array.isArray(spec.allowedTools)) {
        res.status(400).json({ error: 'parentAgentName, purpose és allowedTools kötelező' });
        return;
      }
      logInfo('EphemeralRoute', `Spawn kérés: ${spec.purpose} (parent: ${spec.parentAgentName})`);
      const record = await ephemeralAgentManager.spawn(spec);
      res.status(201).json({ success: true, agent: record });
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** Futó / összes agent listája */
  router.get('/', (_req, res): void => {
    const stateFilter = _req.query['state'] as string | undefined;
    const agents = stateFilter
      ? ephemeralAgentManager.listAgents(stateFilter as 'pending' | 'running' | 'terminated' | 'expired' | 'failed')
      : ephemeralAgentManager.listAgents();
    res.json({ agents, total: agents.length });
  });

  /** Egyedi agent rekord */
  router.get('/:id', (req, res): void => {
    const record = ephemeralAgentManager.getAgent(req.params['id']!);
    if (!record) {
      res.status(404).json({ error: 'Ephemeral agent nem található' });
      return;
    }
    res.json({ agent: record });
  });

  /** Manuális terminálás */
  router.delete('/:id', (req, res): void => {
    const reason = (req.body as { reason?: string })?.reason ?? 'manual_api';
    const record = ephemeralAgentManager.terminate(req.params['id']!, reason);
    if (!record) {
      res.status(404).json({ error: 'Ephemeral agent nem található vagy már terminálva' });
      return;
    }
    logInfo('EphemeralRoute', `Manuális terminálás: ${req.params['id']} (${reason})`);
    res.json({ success: true, agent: record });
  });

  return router;
}
