import { Router } from 'express';
import { ensureError } from '../../utils/ensureError.js';
import { logError, logInfo } from '../../utils/logger.js';
import {
  disableHook,
  enableHook,
  fireHook,
  getHookCircuitSnapshot,
  getHookDlqEntries,
  getHookExecutions,
  getHookRegistrySnapshot,
  getHookSummary,
  isHookEnabled,
  retryAllHookDlqEntries,
  retryHookDlqEntry,
  type HookDlqStatus,
  type HookExecutionStatus,
  type HookName,
} from '../../core/hookRegistry.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseHours(value: unknown, fallback: number): number {
  const parsed = parseLimit(value, fallback);
  return Math.max(1, parsed);
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value === 'true' || value === '1';
  }

  return fallback;
}

function parseStatus(value: unknown): HookExecutionStatus | undefined {
  return value === 'fired' ||
    value === 'skipped' ||
    value === 'failed' ||
    value === 'blocked' ||
    value === 'dead_letter'
    ? value
    : undefined;
}

function parseDlqStatus(value: unknown): HookDlqStatus | undefined {
  return value === 'pending' ||
    value === 'retrying' ||
    value === 'resolved' ||
    value === 'failed'
    ? value
    : undefined;
}

function parseEventName(value: unknown): HookName | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

export function createHookRoutes(): Router {
  const router = Router();

  router.get('/summary', (req, res) => {
    try {
      const hours = parseHours(req.query.hours, 24);
      res.json({
        success: true,
        snapshot: {
          windowHours: hours,
          summary: getHookSummary(hours),
          registry: getHookRegistrySnapshot(),
          executions: getHookExecutions(25),
          dlq: getHookDlqEntries(25),
          circuits: getHookCircuitSnapshot(),
        },
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `GET /summary failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/registry', (_req, res) => {
    try {
      res.json({ success: true, registry: getHookRegistrySnapshot() });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `GET /registry failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/executions', (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 50);
      const event = parseEventName(req.query.event);
      const status = parseStatus(req.query.status);
      res.json({
        success: true,
        executions: getHookExecutions(limit, { event, status }),
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `GET /executions failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/dlq', (req, res) => {
    try {
      const limit = parseLimit(req.query.limit, 50);
      const status = parseDlqStatus(req.query.status);
      res.json({
        success: true,
        dlq: getHookDlqEntries(limit, status),
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `GET /dlq failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.get('/circuits', (req, res) => {
    try {
      const event = parseEventName(req.query.event);
      res.json({
        success: true,
        circuits: getHookCircuitSnapshot(event),
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `GET /circuits failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/fire', async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const event = parseEventName(body.event);

      if (!event) {
        res.status(400).json({ success: false, error: 'Missing hook event name' });
        return;
      }

      const summary = await fireHook(event, body.payload, {
        force: parseBoolean(body.force),
        source: typeof body.source === 'string' ? body.source : 'hook-api',
        metadata: parseMetadata(body.metadata),
      });

      res.json({
        success: true,
        summary,
        enabled: isHookEnabled(event),
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `POST /fire failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/disable/:event', (req, res) => {
    try {
      const event = parseEventName(req.params.event);
      if (!event) {
        res.status(400).json({ success: false, error: 'Missing hook event name' });
        return;
      }

      disableHook(event);
      logInfo('HookRoutes', `Disabled hook: ${event}`);
      res.json({ success: true, enabled: isHookEnabled(event) });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `POST /disable failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/enable/:event', (req, res) => {
    try {
      const event = parseEventName(req.params.event);
      if (!event) {
        res.status(400).json({ success: false, error: 'Missing hook event name' });
        return;
      }

      enableHook(event);
      logInfo('HookRoutes', `Enabled hook: ${event}`);
      res.json({ success: true, enabled: isHookEnabled(event) });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `POST /enable failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/dlq/:id/retry', async (req, res) => {
    try {
      const id = Number.parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) {
        res.status(400).json({ success: false, error: 'Invalid DLQ entry id' });
        return;
      }

      const summary = await retryHookDlqEntry(id);
      if (!summary) {
        res.status(404).json({ success: false, error: 'DLQ entry not found' });
        return;
      }

      res.json({ success: true, summary });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `POST /dlq/:id/retry failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  router.post('/dlq/retry-all', async (_req, res) => {
    try {
      const retried = await retryAllHookDlqEntries();
      res.json({ success: true, retried });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `POST /dlq/retry-all failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

  return router;
}
