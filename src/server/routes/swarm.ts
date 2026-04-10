import { Router } from 'express';
import { swarmManager } from '../../agents/AgentManager.js';
import { logInfo, logError } from '../../utils/logger.js';
import { listCheckpoints, getCheckpointStats } from '../../core/swarm/colonyPersistence.js';
import { globalSwarmChatManager } from "../../core/SwarmChatManager.js";

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

// --- Raj Chat Endpoints (ClawSwarm) ---

/**
 * GET /api/v1/swarm/sessions
 * Kilistázza az összes raj chat munkamenetet.
 */
swarmRouter.get("/sessions", (_req, res) => {
  const sessions = globalSwarmChatManager.listSessions();
  res.json({
    success: true,
    sessions
  });
});

/**
 * POST /api/v1/swarm/create
 * Új raj munkamenet létrehozása.
 */
swarmRouter.post("/create", (req, res) => {
  const { objective, participants } = req.body;
  if (!objective || !participants) {
    return res.status(400).json({ error: "objective and participants required" });
  }

  const session = globalSwarmChatManager.createSession(objective, participants);
  res.json({ success: true, session });
});

// --- Additional Routes: Checkpoint endpoints (Track #5) ---

// GET /api/v1/swarm/checkpoints/stats
swarmRouter.get('/checkpoints/stats', async (_req, res) => {
  try {
    const stats = await getCheckpointStats();
    return res.json(stats);
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('SwarmRoute', `checkpoint stats error: ${error}`);
    return res.status(500).json({ error });
  }
});

// GET /api/v1/swarm/checkpoints?swarmId=xxx
swarmRouter.get('/checkpoints', async (req, res) => {
  try {
    const swarmId = req.query.swarmId as string | undefined;
    if (!swarmId) {
      return res.status(400).json({ error: 'swarmId query parameter required' });
    }
    const checkpoints = await listCheckpoints(swarmId);
    return res.json({ swarmId, checkpoints, total: checkpoints.length });
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : String(e);
    logError('SwarmRoute', `checkpoint list error: ${error}`);
    return res.status(500).json({ error });
  }
});

export { swarmRouter };
