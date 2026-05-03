/**
 * Ephemeral Agent HTTP Route
 *
 * POST   /api/v1/ephemeral/spawn     — új ephemeral agent indítása
 * GET    /api/v1/ephemeral           — lista
 * GET    /api/v1/ephemeral/:id       — egyedi rekord
 * DELETE /api/v1/ephemeral/:id       — manuális terminálás
 */
import { Router } from 'express';
import { ephemeralAgentManager } from '@packages/core-logic/ephemeralAgentManager.js';
import type { EphemeralAgentSpec } from '@packages/core-logic/ephemeralAgentManager.js';
import { executeEphemeralAgent } from '@packages/core-logic/ephemeralAgentExecutor.js';
import { logInfo } from '@packages/utils/logger.js';

const EPHEMERAL_STATES = new Set<string>(['pending', 'running', 'terminated', 'expired', 'failed']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function readStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((entry) => readString(entry)).filter((entry): entry is string => entry !== null);
}

function readContext(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function readSpec(value: unknown): (EphemeralAgentSpec & { systemPrompt?: string; name?: string }) | null {
  if (!isRecord(value)) return null;
  const parentAgentName = readString(value.parentAgentName);
  const purpose = readString(value.purpose);
  const allowedTools = readStringArray(value.allowedTools);
  if (!parentAgentName || !purpose || !allowedTools) return null;

  return {
    ...value,
    parentAgentName,
    purpose,
    allowedTools,
    systemPrompt: readString(value.systemPrompt) ?? undefined,
    name: readString(value.name) ?? undefined,
  } as EphemeralAgentSpec & { systemPrompt?: string; name?: string };
}

export function createEphemeralRouter(): Router {
  const router = Router();

  /** Ephemeral agent indítása — életciklus kezelés nélkül (csak spawn) */
  router.post('/spawn', async (req, res): Promise<void> => {
    try {
      const spec = readSpec(req.body);
      if (!spec) {
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

  /** Ephemeral agent teljes végrehajtás (spawn + execute + terminate) */
  router.post('/execute', async (req, res): Promise<void> => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const spec = readSpec(body.spec);
      const task = readString(body.task);
      if (!spec || !task) {
        res.status(400).json({ error: 'spec.parentAgentName, spec.purpose, spec.allowedTools és task kötelező' });
        return;
      }
      logInfo('EphemeralRoute', `Execute kérés: ${spec.purpose} — "${task.slice(0, 60)}"`);
      const result = await executeEphemeralAgent({ spec, task, context: readContext(body.context) });
      res.status(result.success ? 200 : 500).json(result);
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
    }
  });

  /** Futó / összes agent listája */
  router.get('/', (_req, res): void => {
    const stateFilter = readString(_req.query['state']);
    const agents = stateFilter
      ? ephemeralAgentManager.listAgents(EPHEMERAL_STATES.has(stateFilter) ? stateFilter as 'pending' | 'running' | 'terminated' | 'expired' | 'failed' : undefined)
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
    const body = isRecord(req.body) ? req.body : {};
    const reason = readString(body.reason) ?? 'manual_api';
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
