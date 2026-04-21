/**
 * Gold Protocol G7.2: Phoenix Protocol API Routes
 *
 * Checkpoint, health monitoring, recovery log, failover & event-bus API
 *
 * Endpoints:
 *   GET /api/phoenix/checkpoints - List active checkpoints
 *   GET /api/phoenix/checkpoints/:taskId - Get all checkpoints for a task
 *   DELETE /api/phoenix/checkpoints/:taskId - Clear checkpoints for completed task
 *   GET /api/phoenix/stats - Checkpoint database stats
 *   GET /api/phoenix/recovery-log - Recovery events log
 *   GET /api/phoenix/health - System health check
 *   GET /api/phoenix/failover/registry - Failover mappings
 *   GET /api/phoenix/failover/attempts - Failover attempt log
 *   GET /api/phoenix/failover/stats - Failover statistics
 *   GET /api/phoenix/event-bus/stats - Event bus statistics
 *   GET /api/phoenix/event-bus/history - Event bus history
 */

import { Router } from "express";
import {
  listActiveCheckpoints,
  loadAllCheckpoints,
  clearCheckpoints,
  getCheckpointStats,
} from "@packages/core-logic/checkpoint.js";
import { getRecoveryLog } from "@packages/core-logic/gitRecovery.js";
import { phoenixEventBus } from "@packages/core-logic/phoenixEventBus.js";
import { failoverRegistry } from "@packages/core-logic/failoverRegistry.js";
import { socketService } from "@packages/agents/SocketService.js";
import { heartbeatMonitor } from "@packages/utils/heartbeatMonitor.js";
import { ensureError } from "@packages/utils/ensureError.js";
import os from "os";

export function createPhoenixRouter(): Router {
  const router = Router();

  /**
   * GET /api/phoenix/checkpoints
   * List all active checkpoints (latest per task)
   */
  router.get("/checkpoints", async (_req, res) => {
    try {
      const checkpoints = await listActiveCheckpoints();
      res.json({ checkpoints });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/checkpoints/:taskId
   * Get all checkpoints for a specific task
   */
  router.get("/checkpoints/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const checkpoints = await loadAllCheckpoints(taskId);
      res.json({ taskId, checkpoints });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * DELETE /api/phoenix/checkpoints/:taskId
   * Clear all checkpoints for a completed task
   */
  router.delete("/checkpoints/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      const success = await clearCheckpoints(taskId);
      socketService.emit("gold:checkpoint_cleared", {
        taskId,
        timestamp: new Date().toISOString(),
      });
      res.json({ success, message: `Checkpoints cleared for task: ${taskId}` });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/stats
   * Get checkpoint database statistics
   */
  router.get("/stats", async (_req, res) => {
    try {
      const stats = await getCheckpointStats();
      res.json(stats);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/recovery-log
   * Get recovery events log
   */
  router.get("/recovery-log", (_req, res) => {
    try {
      const events = getRecoveryLog();
      res.json({ events });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/health
   * System health check (CPU, memory, process)
   */
  router.get("/health", (_req, res) => {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;

      const health = {
        status: "healthy",
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
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/heartbeat
   * Phoenix Protocol v2 - Heartbeat Monitor status (all services)
   */
  router.get("/heartbeat", (_req, res) => {
    try {
      const services = heartbeatMonitor.getStatus();
      const overall = heartbeatMonitor.getOverallHealth();

      // Convert Map to plain object for JSON serialization
      const servicesArray = Array.from(services.entries()).map(([_, health]) => ({
        name: health.name,
        status: health.status,
        lastCheck: health.lastCheck.toISOString(),
        lastSuccess: health.lastSuccess ? health.lastSuccess.toISOString() : null,
        consecutiveFailures: health.consecutiveFailures,
        latencyMs: health.latencyMs,
        error: health.error,
      }));

      res.json({
        overall: overall.status,
        unhealthyServices: overall.unhealthyServices,
        isActive: heartbeatMonitor.isActive(),
        services: servicesArray,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  // ========================================================================
  // PHOENIX PROTOCOL SZINT 4-5: Failover & Event Bus endpoints
  // ========================================================================

  /**
   * GET /api/phoenix/failover/registry
   * Returns all failover mappings (agent → fallback chain)
   */
  router.get("/failover/registry", (_req, res) => {
    try {
      const mappings = failoverRegistry.getAllMappings();
      res.json({ mappings });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/failover/attempts
   * Returns failover attempt log, optionally filtered by agent
   * Query params: ?agent=Name&limit=50
   */
  router.get("/failover/attempts", (req, res) => {
    try {
      const agentFilter =
        typeof req.query.agent === "string" ? req.query.agent : undefined;
      const limit =
        typeof req.query.limit === "string"
          ? parseInt(req.query.limit, 10)
          : undefined;
      const attempts = failoverRegistry.getAttempts(agentFilter, limit);
      res.json({ attempts, total: attempts.length });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/failover/stats
   * Returns failover statistics (success/fail counts per agent)
   */
  router.get("/failover/stats", (_req, res) => {
    try {
      const stats = failoverRegistry.getStats();
      res.json(stats);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/event-bus/stats
   * Returns event bus statistics (event counts, subscriber counts)
   */
  router.get("/event-bus/stats", (_req, res) => {
    try {
      const stats = phoenixEventBus.getStats();
      res.json(stats);
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  /**
   * GET /api/phoenix/event-bus/history
   * Returns event bus history, optionally filtered by event type
   * Query params: ?event=phoenix:agent_failed&limit=50
   */
  router.get("/event-bus/history", (req, res) => {
    try {
      const eventFilter =
        typeof req.query.event === "string" ? req.query.event : undefined;
      const limit =
        typeof req.query.limit === "string"
          ? parseInt(req.query.limit, 10)
          : undefined;
      const history = phoenixEventBus.getHistory(eventFilter, limit);
      res.json({ history, total: history.length });
    } catch (error: unknown) {
      const err = ensureError(error);
      res.status(500).json({ error: err.message });
    }
  });

  return router;
}

