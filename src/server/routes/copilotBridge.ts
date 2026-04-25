/**
 * Copilot Bridge API Routes
 * 
 * REST endpoints for the Copilot CLI ↔ Dashboard bridge.
 * The CLI pushes command logs here, the Dashboard panel reads them.
 */
import { Router, Request, Response } from 'express';
import { copilotBridgeState, CopilotCommand } from '../../core/copilotBridgeState.js';
import { logInfo, logError } from '../../utils/logger.js';

const TAG = 'CopilotBridge';

export function createCopilotBridgeRoutes(): Router {
  const router = Router();

  // GET /api/copilot-bridge/stats — Bridge statistics
  router.get('/stats', (_req: Request, res: Response) => {
    try {
      const stats = copilotBridgeState.getStats();
      res.json(stats);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Stats error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // GET /api/copilot-bridge/commands — Recent commands list
  router.get('/commands', (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const commands = copilotBridgeState.getRecentCommands(limit);
      res.json(commands);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Commands list error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/copilot-bridge/commands — Log a new command (used by CLI)
  router.post('/commands', (req: Request, res: Response) => {
    try {
      const { domain, action, params, status } = req.body as {
        domain?: string;
        action?: string;
        params?: Record<string, unknown>;
        status?: 'pending' | 'running' | 'success' | 'error';
      };

      if (!domain || !action) {
        res.status(400).json({ error: 'domain and action are required' });
        return;
      }

      const cmd = copilotBridgeState.addCommand({
        domain,
        action,
        params,
        status: status ?? 'running',
      });

      logInfo(TAG, `Command logged: ${domain}/${action} [${cmd.id}]`);
      res.status(201).json(cmd);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Command log error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // PATCH /api/copilot-bridge/commands/:id — Update command status
  router.patch('/commands/:id', (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const update = req.body as Partial<CopilotCommand>;
      const cmd = copilotBridgeState.updateCommand(id, update);
      if (!cmd) {
        res.status(404).json({ error: 'Command not found' });
        return;
      }
      res.json(cmd);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Command update error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // GET /api/copilot-bridge/dispatches — Recent agent dispatches
  router.get('/dispatches', (req: Request, res: Response) => {
    try {
      const limit = Math.min(Number(req.query.limit) || 50, 200);
      const dispatches = copilotBridgeState.getRecentDispatches(limit);
      res.json(dispatches);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Dispatches list error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // POST /api/copilot-bridge/dispatches — Log an agent dispatch
  router.post('/dispatches', (req: Request, res: Response) => {
    try {
      const { agentName, task, status } = req.body as {
        agentName?: string;
        task?: string;
        status?: 'queued' | 'running' | 'success' | 'error';
      };

      if (!agentName || !task) {
        res.status(400).json({ error: 'agentName and task are required' });
        return;
      }

      const dispatch = copilotBridgeState.addDispatch({
        agentName,
        task,
        status: status ?? 'queued',
      });

      logInfo(TAG, `Dispatch logged: ${agentName} [${dispatch.id}]`);
      res.status(201).json(dispatch);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Dispatch log error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  // DELETE /api/copilot-bridge/clear — Clear all bridge state
  router.delete('/clear', (_req: Request, res: Response) => {
    try {
      copilotBridgeState.clear();
      logInfo(TAG, 'Bridge state cleared');
      res.json({ success: true, message: 'Bridge state cleared' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(TAG, `Clear error: ${msg}`);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
