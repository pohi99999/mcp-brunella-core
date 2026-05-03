import { Router } from 'express';
import { ensureError } from '@packages/utils/ensureError.js';
import { logError, logInfo } from '@packages/utils/logger.js';
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
} from '@packages/core-logic/hookRegistry.js';

type HookReadinessStatus = 'ready' | 'partial' | 'blocked';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseLimit(value: unknown, fallback: number): number {
  if (typeof value !== 'string') {
    return fallback;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 200) : fallback;
}

function parseHours(value: unknown, fallback: number): number {
  const parsed = parseLimit(value, fallback);
  return Math.min(Math.max(1, parsed), 168);
}

function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }

  return fallback;
}

function parseStatus(value: unknown): HookExecutionStatus | undefined {
  const status = typeof value === 'string' ? value.trim() : undefined;
  return status === 'fired' ||
    status === 'skipped' ||
    status === 'failed' ||
    status === 'blocked' ||
    status === 'dead_letter'
    ? status
    : undefined;
}

function parseDlqStatus(value: unknown): HookDlqStatus | undefined {
  const status = typeof value === 'string' ? value.trim() : undefined;
  return status === 'pending' ||
    status === 'retrying' ||
    status === 'resolved' ||
    status === 'failed'
    ? status
    : undefined;
}

function parseEventName(value: unknown): HookName | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseSource(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : 'hook-api';
}

function parsePositiveInteger(value: unknown): number | undefined {
  const parsed = typeof value === 'string' ? Number.parseInt(value.trim(), 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function buildHookReadiness(hours: number) {
  const summary = getHookSummary(hours);
  const registry = getHookRegistrySnapshot();
  const circuits = getHookCircuitSnapshot();
  const dlq = getHookDlqEntries(25);
  const executions = getHookExecutions(25);

  const openCircuits = circuits.filter((circuit) => circuit.state === 'open');
  const recentFailures = executions.filter((execution) => (
    execution.status === 'failed' ||
    execution.status === 'blocked' ||
    execution.status === 'dead_letter'
  ));

  const blockers = [
    ...openCircuits.map((circuit) => `open circuit: ${circuit.event}`),
    ...(summary.enabledHandlers === 0 ? ['no enabled hook handlers registered'] : []),
    ...(summary.dlqCount > 0 ? [`${summary.dlqCount} hook DLQ entries waiting for replay`] : []),
    ...(summary.audit.failed > 0 ? [`${summary.audit.failed} failed hook executions in the window`] : []),
  ];

  const status: HookReadinessStatus = openCircuits.length > 0
    ? 'blocked'
    : blockers.length > 0
      ? 'partial'
      : 'ready';

  return {
    status,
    blockers,
    summary,
    registry: {
      totalEvents: registry.length,
      enabledEvents: registry.filter((entry) => entry.enabled).length,
      registeredHandlers: summary.registeredHandlers,
      enabledHandlers: summary.enabledHandlers,
      disabledEvents: summary.disabledEvents,
    },
    circuits: {
      open: openCircuits,
      total: circuits.length,
    },
    dlq: {
      count: summary.dlqCount,
      entries: dlq,
    },
    recentFailures,
  };
}

function parseMetadata(value: unknown): Record<string, unknown> {
  return isRecord(value) ? { ...value } : {};
}

export function createHookRoutes(): Router {
  const router = Router();

  router.get('/readiness', (req, res) => {
    try {
      const hours = parseHours(req.query.hours, 24);
      res.json({
        success: true,
        readiness: buildHookReadiness(hours),
      });
    } catch (error: unknown) {
      const normalized = ensureError(error);
      logError('HookRoutes', `GET /readiness failed: ${normalized.message}`);
      res.status(500).json({ success: false, error: normalized.message });
    }
  });

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
        source: parseSource(body.source),
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
      const id = parsePositiveInteger(req.params.id);
      if (id === undefined) {
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
