import { Router } from 'express';
import { agentManager } from '@packages/agents/AgentManager.js';
import { AgentArchitect } from '@packages/agents/AgentArchitect.js';
import { buildAgentRegistryGovernanceSnapshot } from '../agentRegistryGovernance.js';
import { logEmitter, logError, type LogEvent } from '@packages/utils/logger.js';

type AgentRouteContext = Record<string, unknown> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readTask(body: unknown): string | null {
    if (!isRecord(body) || typeof body.task !== 'string') return null;
    const task = body.task.trim();
    return task ? task : null;
}

function readContext(body: unknown): AgentRouteContext {
    if (!isRecord(body)) return undefined;
    return isRecord(body.context) ? body.context : undefined;
}

function normalizeAgentMessage(result: unknown): string {
    if (typeof result === 'string' && result.trim()) return result;
    if (!isRecord(result)) return 'Kész.';

    if (typeof result.message === 'string' && result.message.trim()) return result.message;
    if (typeof result.data === 'string' && result.data.trim()) return result.data;
    if (result.data !== undefined) return JSON.stringify(result.data);

    return 'Kész.';
}

function readOptionalResultField(result: unknown, key: string): unknown {
    return isRecord(result) ? result[key] : undefined;
}

export function createAgentRoutes(): Router {
    const router = Router();

    /**
     * @swagger
     * /api/agents:
     *   get:
     *     summary: List Agents
     *     description: Returns a list of all registered agents and their capabilities.
     *     responses:
     *       200:
     *         description: List of agents
     */
    router.get('/', (req, res) => {
        try {
            const agents = agentManager.listAgentDefinitions();
            res.json({ agents });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/status', (req, res) => {
        try {
            const status = agentManager.listAgentStatuses();
            res.json({ agents: status });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/diagnostics', (req, res) => {
        try {
            const diagnostics = agentManager.getAgentDiagnostics();
            res.json(diagnostics);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/registry-governance', async (req, res) => {
        try {
            const snapshot = await buildAgentRegistryGovernanceSnapshot();
            res.json(snapshot);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    /**
     * @swagger
     * /api/agents/create:
     *   post:
     *     summary: Create New Agent
     *     description: Generates a new dynamic agent, saves its config and registers it.
     */
    router.post('/create', async (req, res) => {
        try {
            const result = await AgentArchitect.createAgent(req.body);
            if (result.success) {
                res.json(result);
            } else {
                res.status(500).json(result);
            }
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, message: msg });
        }
    });

    // Szinkron orkesztrátori chat endpoint — megvárja a valódi magyar választ
    router.post('/orchestrate', async (req, res) => {
        try {
            const task = readTask(req.body);
            const context = readContext(req.body);
            if (!task) {
                res.status(400).json({ error: 'A feladat megadása kötelező' });
                return;
            }

            const result = await agentManager.delegate('Orchestrator', task, {
                ...context,
                chatMode: 'orchestrator'
            });

            res.json({
                success: true,
                message: normalizeAgentMessage(result),
                taskId: readOptionalResultField(result, 'taskId'),
                steps: readOptionalResultField(result, 'steps'),
                executedBy: 'Orchestrator'
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.post('/:agentName/execute', async (req, res) => {
        try {
            let { agentName } = req.params;
            const task = readTask(req.body);
            const context = readContext(req.body);

            if (!task) {
                res.status(400).json({ error: 'A feladat megadása kötelező' });
                return;
            }

            // RULE-OB2: Case-insensitive agent lookup
            const registry = agentManager.listAgentDefinitions();
            const actualAgent = registry.find(a => a.name.toLowerCase() === agentName.toLowerCase());
            
            if (actualAgent) {
                agentName = actualAgent.name; // Use the correctly cased name from registry
            }

            // A ténylegesen létező queueTask-ot használjuk a várólistához
            const taskId = await agentManager.queueTask(task, agentName, context);

            // Azonnali végrehajtás elindítása a háttérben
            agentManager.delegate(agentName, task, { ...context, taskId }).catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : String(err);
                logError('AgentRoutes', `Execution error for task ${taskId}: ${msg}`);
            });

            res.json({ success: true, taskId, message: `#${taskId} feladat elindítva (${agentName})` });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    router.get('/:agentName/logs', (req, res) => {
        const { agentName } = req.params;
        const levelFilter = typeof req.query.level === 'string' ? req.query.level : undefined;

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const logListener = (entry: LogEvent) => {
            if (entry.agent !== agentName) return;
            if (levelFilter && entry.level !== levelFilter) return;
            res.write(`event: log\ndata: ${JSON.stringify(entry)}\n\n`);
        };

        logEmitter.on('log', logListener);

        req.on('close', () => {
            logEmitter.off('log', logListener);
        });
    });

    return router;
}

export function createRegistryRoutes(): Router {
    const router = Router();

    router.get('/', (req, res) => {
        try {
            const registry = agentManager.getRegistry();
            res.json(registry);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}

export function createCloudflareAgentRoutes(): Router {
    const router = Router();

    router.get('/', async (req, res) => {
        try {
            const edgeStatus = agentManager.getEdgeStatus();
            if (!edgeStatus.enabled) {
                res.json({ agents: [], status: 'disabled' });
                return;
            }

            res.json({
                status: edgeStatus.healthy ? 'connected' : 'error',
                agents: [
                    { name: 'EdgeOrchestrator', status: 'active', tasks: 2 },
                    { name: 'EdgeKVReader', status: 'idle', tasks: 0 }
                ]
            });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ error: msg });
        }
    });

    return router;
}
