import { Router } from 'express';
import { swarmManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';

const swarmRouter = Router();

// GET /api/v1/swarm/status
// Returns: { colonies: ColonySummary[], total: number }
swarmRouter.get('/status', (_req, res) => {
  const colonies = swarmManager.listColonies().map(c => ({
    colonyId: c.swarmId,
    name: c.name,
    status: c.status,
    agentCount: c.agents.size,
    leaderId: c.leaderId,
    metrics: c.metrics,
  }));
  res.json({ colonies, total: colonies.length });
});

// POST /api/v1/swarm/dispatch
// Body: { task: string, colonyId?: string }
// Returns: { success: true, result } or { success: false, error: string }
swarmRouter.post('/dispatch', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const task = typeof body.task === 'string' ? body.task.trim() : '';
  const colonyId = typeof body.colonyId === 'string' ? body.colonyId : 'triad-default';
  if (!task) {
    return res.status(400).json({ success: false, error: 'task is required' });
  }
  const colony = swarmManager.getColony(colonyId);
  if (!colony) {
    return res.status(404).json({ success: false, error: `Colony not found: ${colonyId}` });
  }
  if (colony.status === 'paused') {
    return res.status(503).json({ success: false, error: `Colony ${colonyId} is paused (Phoenix failover active)` });
  }
  try {
    const swarmTask = {
      taskId: swarmManager.nextTaskId(),
      task,
      requiredCapabilities: [],
      priority: 1,
    };
    const result = await swarmManager.submitTask(colonyId, swarmTask);
    if (!result) {
      return res.status(503).json({ success: false, error: 'No bids received' });
    }
    logInfo('SwarmRoute', `Task dispatched to colony ${colonyId}`);
    return res.json({ success: true, result });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('SwarmRoute', error);
    return res.status(500).json({ success: false, error });
  }
});

export { swarmRouter };
