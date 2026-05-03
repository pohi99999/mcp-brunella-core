import { Router } from 'express';
import { agentManager } from '@packages/agents/AgentManager.js';
import { decomposeToDAGAsync } from '@packages/agents/taskDecomposerCore.js';
import type { DAGWorkflow } from '@packages/core-logic/dagEngine.js';

const WORKFLOW_CATALOG = [
  {
    id: 'auto-dag',
    name: 'Auto DAG decomposition',
    source: 'taskDecomposerCore',
    description: 'Generates a DAG workflow from a natural-language task and executes it through AgentManager.',
  },
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function isDAGWorkflow(value: unknown): value is DAGWorkflow {
  if (!isRecord(value)) return false;
  if (typeof value.id !== 'string' || !value.id.trim()) return false;
  if (typeof value.name !== 'string' || !value.name.trim()) return false;
  if (!Array.isArray(value.nodes) || value.nodes.length === 0) return false;

  return value.nodes.every((node) => {
    if (!isRecord(node)) return false;
    if (typeof node.id !== 'string' || !node.id.trim()) return false;
    if (typeof node.label !== 'string' || !node.label.trim()) return false;
    return node.type === 'agent' || node.type === 'condition' || node.type === 'loop' || node.type === 'transform';
  });
}

export function createWorkflowRoutes(): Router {
  const router = Router();

  router.get('/list', async (_req, res) => {
    try {
      res.json({ catalog: WORKFLOW_CATALOG, recent: agentManager.listWorkflowExecutions() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/status', async (_req, res) => {
    try {
      res.json({ workflows: agentManager.listWorkflowExecutions() });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post('/run', async (req, res) => {
    try {
      const body = isRecord(req.body) ? req.body : {};
      const task = readString(body.task);
      const defaultAgent = readString(body.defaultAgent) ?? undefined;
      const initialContext = isRecord(body.initialContext) ? body.initialContext : undefined;

      if (body.initialContext !== undefined && !isRecord(body.initialContext)) {
        res.status(400).json({ error: 'initialContext must be an object when provided' });
        return;
      }

      if (body.workflow !== undefined && !isDAGWorkflow(body.workflow)) {
        res.status(400).json({ error: 'workflow must be a DAG workflow with id, name, and at least one valid node' });
        return;
      }

      const workflow = body.workflow;
      const resolvedWorkflow = workflow ?? (task ? await decomposeToDAGAsync(task, { defaultAgent }) : undefined);
      if (!resolvedWorkflow) {
        res.status(400).json({ error: 'task or workflow is required' });
        return;
      }

      const result = await agentManager.executeWorkflow(resolvedWorkflow, initialContext);
      res.json({ success: true, workflow: resolvedWorkflow, result });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
