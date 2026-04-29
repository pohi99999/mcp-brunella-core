import { Router } from 'express';
import { agentManager } from '@packages/agents/AgentManager.js';
import { decomposeToDAGAsync } from '@packages/agents/taskDecomposerCore.js';

export function createWorkflowRoutes(): Router {
  const router = Router();

  router.get('/list', async (_req, res) => {
    try {
      // Placeholder: return recent workflow executions and empty static catalog
      res.json({ catalog: [], recent: agentManager.listWorkflowExecutions() });
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
      const { task, workflow, defaultAgent, initialContext } = req.body as {
        task?: string;
        workflow?: Parameters<typeof agentManager.executeWorkflow>[0];
        defaultAgent?: string;
        initialContext?: Record<string, unknown>;
      };

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
