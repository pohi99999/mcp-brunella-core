import { Router } from 'express';
import { getDynamicToolRegistry } from '@packages/core-logic/dynamicToolRegistry.js';
import { toolManager } from '../ToolManager.js';
import { socketService } from '@packages/agents/SocketService.js';
import { requireOperatorAccess } from '../middleware.js';

interface DiscoveryToolInfo {
    id: string;
    name: string;
    version: string;
    description: string;
    publishedBy: string;
    tags: string[];
    deprecated: boolean;
    totalCalls: number;
    errorRate: number;
    avgLatencyMs: number;
    enabled: boolean;
}

interface ToolMetricsResponse {
    toolId: string;
    totalCalls: number;
    successCalls: number;
    errorCalls: number;
    errorRate: number;
    avgLatencyMs: number;
    p95LatencyMs: number;
    lastUsed: number;
    lastError?: string;
}

function buildDiscoveryTools(): DiscoveryToolInfo[] {
    const dynamicRegistry = getDynamicToolRegistry();
    const dynamicEntries = dynamicRegistry.getAll();

    return toolManager.getToolDefinitions().map((tool) => {
        const dynamicEntry =
            dynamicRegistry.getTool(tool.id) ??
            dynamicEntries.find((entry) => entry.manifest.name === tool.name);
        const metrics = dynamicEntry?.metrics;

        return {
            id: tool.id,
            name: tool.name,
            version: dynamicEntry?.manifest.version ?? '1.0.0',
            description: tool.description,
            publishedBy: dynamicEntry?.manifest.publishedBy ?? 'brunella-core',
            tags: dynamicEntry?.manifest.tags ?? [tool.category],
            deprecated: dynamicEntry?.manifest.deprecated ?? false,
            totalCalls: metrics?.totalCalls ?? 0,
            errorRate: metrics && metrics.totalCalls > 0
                ? metrics.errorCalls / metrics.totalCalls
                : 0,
            avgLatencyMs: metrics?.avgLatencyMs ?? 0,
            enabled: tool.enabled,
        };
    });
}

function buildRegistryStats(tools: DiscoveryToolInfo[]) {
    const totalCalls = tools.reduce((sum, tool) => sum + tool.totalCalls, 0);
    const weightedLatency = tools.reduce(
        (sum, tool) => sum + (tool.avgLatencyMs * tool.totalCalls),
        0,
    );

    return {
        totalTools: tools.length,
        deprecatedTools: tools.filter((tool) => tool.deprecated).length,
        totalCalls,
        avgLatencyMs: totalCalls > 0 ? weightedLatency / totalCalls : 0,
        publishers: [...new Set(tools.map((tool) => tool.publishedBy))],
    };
}

function getToolMetrics(toolId: string): ToolMetricsResponse | null {
    const dynamicRegistry = getDynamicToolRegistry();
    const dynamicEntry =
        dynamicRegistry.getTool(toolId) ??
        dynamicRegistry.getAll().find((entry) => entry.manifest.name === toolId);

    const toolExists = toolManager
        .getToolDefinitions()
        .some((tool) => tool.id === toolId || tool.name === toolId);

    if (!dynamicEntry && !toolExists) {
        return null;
    }

    const metrics = dynamicEntry?.metrics;
    const totalCalls = metrics?.totalCalls ?? 0;
    const errorCalls = metrics?.errorCalls ?? 0;

    return {
        toolId,
        totalCalls,
        successCalls: metrics?.successCalls ?? 0,
        errorCalls,
        errorRate: totalCalls > 0 ? errorCalls / totalCalls : 0,
        avgLatencyMs: metrics?.avgLatencyMs ?? 0,
        p95LatencyMs: metrics?.p95LatencyMs ?? 0,
        lastUsed: metrics?.lastUsed ?? 0,
        lastError: metrics?.lastError,
    };
}

function normalizeChainInput(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }

    if (value === undefined || value === null) {
        return {};
    }

    return { task: String(value) };
}

export function createToolRoutes(): Router {
    const router = Router();

    router.get('/', (req, res) => {
        try {
            const tools = toolManager.getToolDefinitions();
            res.json({ tools });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg, tools: [] });
        }
    });

    router.get('/registry', (_req, res) => {
        try {
            res.json(buildDiscoveryTools());
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/stats', (_req, res) => {
        try {
            const tools = buildDiscoveryTools();
            res.json(buildRegistryStats(tools));
        } catch (e: unknown) {
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
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/chain', requireOperatorAccess, async (req, res) => {
        let completedSteps = 0;
        try {
            const steps = Array.isArray(req.body?.steps) ? req.body.steps : [];
            const input = req.body?.input ?? {};

            if (steps.length === 0 || !steps.every((step: unknown) => typeof step === 'string' && step.trim().length > 0)) {
                res.status(400).json({ success: false, error: 'steps must be a non-empty array of tool names' });
                return;
            }

            const agentName = typeof req.headers['x-agent-name'] === 'string'
                ? req.headers['x-agent-name']
                : undefined;
            let currentResult: unknown = input;
            const results: Array<{ step: string; result: unknown }> = [];

            for (let index = 0; index < steps.length; index += 1) {
                const step = steps[index];
                currentResult = await toolManager.executeTool(step, normalizeChainInput(currentResult), {
                    agentName,
                    requestId: (req as { id?: string }).id,
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
        } catch (e: unknown) {
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
            const args = req.body;
            // Pass agent name from request header (if any) for permission auditing
            const agentName = typeof req.headers['x-agent-name'] === 'string'
                ? req.headers['x-agent-name']
                : undefined;

            const result = await toolManager.executeTool(toolName, args, {
                agentName,
                requestId: (req as { id?: string }).id,
                metadata: {
                    source: 'http-tools-route',
                    remoteUser: req.remoteUser?.userId,
                },
            });
            res.json({ result });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            const status = msg.includes('denied') ? 403 : 500;
            res.status(status).json({ error: msg });
        }
    });

    return router;
}

export function createDebugRoutes(): Router {
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
        } catch (e: unknown) {
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
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
