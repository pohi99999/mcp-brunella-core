/**
 * Gold Protocol G7.2: Phoenix Protocol API Routes
 *
 * Checkpoint, health monitoring, and recovery log API
 *
 * Endpoints:
 *   GET /api/phoenix/checkpoints - List active checkpoints
 *   GET /api/phoenix/checkpoints/:taskId - Get all checkpoints for a task
 *   DELETE /api/phoenix/checkpoints/:taskId - Clear checkpoints for completed task
 *   GET /api/phoenix/stats - Checkpoint database stats
 *   GET /api/phoenix/recovery-log - Recovery events log
 *   GET /api/phoenix/health - System health check
 */

import { Router } from 'express';
import {
  listActiveCheckpoints,
  loadAllCheckpoints,
  clearCheckpoints,
  getCheckpointStats,
} from '../core/checkpoint.js';
import { getRecoveryLog } from '../core/gitRecovery.js';
import { socketService } from './SocketService.js';
import os from 'os';

export function createPhoenixRouter(): Router {
  const router = Router();

  /**
   * GET /api/phoenix/checkpoints
   * List all active checkpoints (latest per task)
   */
  router.get('/checkpoints', async (_req, res) => {
    try {
      const checkpoints = await listActiveCheckpoints();
      res.json({ checkpoints });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/phoenix/checkpoints/:taskId
   * Get all checkpoints for a specific task
   */
  router.get('/checkpoints/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params;
      const checkpoints = await loadAllCheckpoints(taskId);
      res.json({ taskId, checkpoints });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * DELETE /api/phoenix/checkpoints/:taskId
   * Clear all checkpoints for a completed task
   */
  router.delete('/checkpoints/:taskId', async (req, res) => {
    try {
      const { taskId } = req.params;
      const success = await clearCheckpoints(taskId);
      socketService.emit('gold:checkpoint_cleared', { taskId, timestamp: new Date().toISOString() });
      res.json({ success, message: `Checkpoints cleared for task: ${taskId}` });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/phoenix/stats
   * Get checkpoint database statistics
   */
  router.get('/stats', async (_req, res) => {
    try {
      const stats = await getCheckpointStats();
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/phoenix/recovery-log
   * Get recovery events log
   */
  router.get('/recovery-log', (_req, res) => {
    try {
      const events = getRecoveryLog();
      res.json({ events });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  /**
   * GET /api/phoenix/health
   * System health check (CPU, memory, process)
   */
  router.get('/health', (_req, res) => {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const health = {
        status: 'healthy',
        uptime: process.uptime(),
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          percentUsed: ((usedMem / totalMem) * 100).toFixed(2),
        },
        cpu: {
          loadAvg: os.loadavg(),
        },
        process: {
          pid: process.pid,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
        },
      };

      res.json(health);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  return router;
}
