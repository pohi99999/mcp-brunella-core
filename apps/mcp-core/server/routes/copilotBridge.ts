/**
 * Copilot Bridge API Routes
 * 
 * REST endpoints for the Copilot CLI ↔ Dashboard bridge.
 * The CLI pushes command logs here, the Dashboard panel reads them.
 */
import { Router, Request, Response } from 'express';
import { copilotBridgeState } from '@packages/core-logic/copilotBridgeState.js';
import type { AgentDispatchResult, CopilotCommand } from '@packages/core-logic/copilotBridgeState.js';
import { logInfo, logError } from '@packages/utils/logger.js';

const TAG = 'CopilotBridge';
const COMMAND_STATUSES = new Set<CopilotCommand['status']>(['pending', 'running', 'success', 'error']);
const DISPATCH_STATUSES = new Set<AgentDispatchResult['status']>(['queued', 'running', 'success', 'error']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readLimit(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.min(Math.max(Math.trunc(parsed), 1), 200);
}

function readCommandStatus(value: unknown): CopilotCommand['status'] | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === 'string' && COMMAND_STATUSES.has(value as CopilotCommand['status'])
    ? (value as CopilotCommand['status'])
    : null;
}

function readDispatchStatus(value: unknown): AgentDispatchResult['status'] | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === 'string' && DISPATCH_STATUSES.has(value as AgentDispatchResult['status'])
    ? (value as AgentDispatchResult['status'])
    : null;
}

function readDuration(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

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
      const limit = readLimit(req.query.limit);
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
      const body = isRecord(req.body) ? req.body : {};
      const domain = readString(body.domain);
      const action = readString(body.action);
      const status = readCommandStatus(body.status);

      if (!domain || !action) {
        res.status(400).json({ error: 'domain and action are required' });
        return;
      }

      if (status === null) {
        res.status(400).json({ error: 'status must be one of: pending, running, success, error' });
        return;
      }

      if (body.params !== undefined && !isRecord(body.params)) {
        res.status(400).json({ error: 'params must be an object when provided' });
        return;
      }

      const cmd = copilotBridgeState.addCommand({
        domain,
        action,
        params: body.params,
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
      const body = isRecord(req.body) ? req.body : {};
      const status = readCommandStatus(body.status);
      const durationMs = readDuration(body.durationMs);

      if (status === null) {
        res.status(400).json({ error: 'status must be one of: pending, running, success, error' });
        return;
      }

      if (durationMs === null) {
        res.status(400).json({ error: 'durationMs must be a non-negative finite number' });
        return;
      }

      const update: Partial<CopilotCommand> = {
        status,
        result: body.result,
        error: readString(body.error) ?? undefined,
        durationMs,
      };
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
      const limit = readLimit(req.query.limit);
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
      const body = isRecord(req.body) ? req.body : {};
      const agentName = readString(body.agentName);
      const task = readString(body.task);
      const status = readDispatchStatus(body.status);

      if (!agentName || !task) {
        res.status(400).json({ error: 'agentName and task are required' });
        return;
      }

      if (status === null) {
        res.status(400).json({ error: 'status must be one of: queued, running, success, error' });
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
