import { Router } from 'express';
import { toolManager } from '@packages/core-logic/ToolManager.js';
import { socketService } from '@packages/agents/SocketService.js';
import { requireOperatorAccess } from '../../../apps/mcp-core/server/middleware.js';

function buildDiscoveryTools() {
  return toolManager.getToolDefinitions().map((tool) => ({
    id: tool.id,
    name: tool.name,
    version: tool.version ?? '1.0.0',
    description: tool.description ?? '',
    publishedBy: tool.publishedBy ?? 'brunella-core',
    tags: tool.tags ?? [tool.category ?? 'server'],
    deprecated: tool.deprecated ?? false,
    totalCalls: tool.totalCalls ?? 0,
    errorRate: tool.errorRate ?? 0,
    avgLatencyMs: tool.avgLatencyMs ?? 0,
    enabled: tool.enabled ?? true,
  }));
}

function buildRegistryStats(tools) {
  const totalCalls = tools.reduce((sum, tool) => sum + tool.totalCalls, 0);
  const weightedLatency = tools.reduce((sum, tool) => sum + tool.avgLatencyMs * tool.totalCalls, 0);

  return {
    totalTools: tools.length,
    deprecatedTools: tools.filter((tool) => tool.deprecated).length,
    totalCalls,
    avgLatencyMs: totalCalls > 0 ? weightedLatency / totalCalls : 0,
    publishers: [...new Set(tools.map((tool) => tool.publishedBy))],
  };
}

function getToolMetrics(toolId) {
  const tool = toolManager.getToolDefinitions().find((entry) => entry.id === toolId || entry.name === toolId);
  if (!tool) {
    return null;
  }

  return {
    toolId,
    totalCalls: tool.totalCalls ?? 0,
    successCalls: tool.successCalls ?? 0,
    errorCalls: tool.errorCalls ?? 0,
    errorRate: tool.errorRate ?? 0,
    avgLatencyMs: tool.avgLatencyMs ?? 0,
    p95LatencyMs: tool.p95LatencyMs ?? 0,
    lastUsed: tool.lastUsed ?? 0,
    lastError: tool.lastError,
  };
}

function normalizeChainInput(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }

  if (value === undefined || value === null) {
    return {};
  }

  return { task: String(value) };
}

export function createToolRoutes() {
  const router = Router();

  router.get('/', (_req, res) => {
    try {
      res.json({ tools: toolManager.getToolDefinitions() });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg, tools: [] });
    }
  });

  router.get('/registry', (_req, res) => {
    try {
      res.json(buildDiscoveryTools());
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/stats', (_req, res) => {
    try {
      const tools = buildDiscoveryTools();
      res.json(buildRegistryStats(tools));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.get('/metrics/:toolId', (req, res) => {
    try {
      const metrics = getToolMetrics(req.params.toolId);
      if (!metrics) {
        res.status(404).json({ error: `Tool not found: ${req.params.toolId}` });
        return;
      }

      res.json(metrics);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post('/chain', requireOperatorAccess, async (req, res) => {
    let completedSteps = 0;
    try {
      const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
      const input = req.body?.input ?? {};

      if (steps.length === 0 || !steps.every((step) => typeof step === 'string' && step.trim().length > 0)) {
        res.status(400).json({ success: false, error: 'steps must be a non-empty array of tool names' });
        return;
      }

      const agentName = typeof req.headers['x-agent-name'] === 'string' ? req.headers['x-agent-name'] : undefined;
      let currentResult = input;
      const results = [];

      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index];
        currentResult = await toolManager.executeTool(step, normalizeChainInput(currentResult), {
          agentName,
          requestId: req.id,
          metadata: {
            source: 'http-tools-chain-route',
            remoteUser: req.remoteUser?.userId,
            stepIndex: index,
          },
        });
        completedSteps = index + 1;
        results.push({ step, result: currentResult });
      }

      res.json({
        success: true,
        totalSteps: steps.length,
        completedSteps,
        result: currentResult,
        results,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(msg.includes('denied') ? 403 : 500).json({
        success: false,
        completedSteps,
        failedAtStep: completedSteps + 1,
        totalSteps: Array.isArray(req.body?.steps) ? req.body.steps.length : 0,
        error: msg,
      });
    }
  });

  router.post('/:toolName/execute', requireOperatorAccess, async (req, res) => {
    try {
      const toolName = Array.isArray(req.params.toolName) ? req.params.toolName[0] : req.params.toolName;
      const agentName = typeof req.headers['x-agent-name'] === 'string' ? req.headers['x-agent-name'] : undefined;
      const result = await toolManager.executeTool(toolName, req.body, {
        agentName,
        requestId: req.id,
        metadata: {
          source: 'http-tools-route',
          remoteUser: req.remoteUser?.userId,
        },
      });
      res.json({ result });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(msg.includes('denied') ? 403 : 500).json({ error: msg });
    }
  });

  return router;
}

export function createDebugRoutes() {
  const router = Router();
  router.use(requireOperatorAccess);

  router.post('/broadcast-log', (req, res) => {
    try {
      const { message, type = 'info', source } = req.body;
      if (!message) {
        res.status(400).json({ error: 'message is required' });
        return;
      }
      socketService.broadcastLog(message, type, source);
      res.json({ ok: true, message: 'Log broadcast sent' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  router.post('/agent-status', (req, res) => {
    try {
      const { agentName, status, taskDescription } = req.body;
      if (!agentName || !status) {
        res.status(400).json({ error: 'agentName and status are required' });
        return;
      }
      socketService.updateAgentStatus(agentName, status, taskDescription);
      res.json({ ok: true, message: 'Agent status update sent' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      res.status(500).json({ error: msg });
    }
  });

  return router;
}
