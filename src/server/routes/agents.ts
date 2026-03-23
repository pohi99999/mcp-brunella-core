import { Router } from 'express';
import { agentManager } from '../../agents/AgentManager.js';
import { AgentArchitect } from '../../agents/AgentArchitect.js';
import { logEmitter, type LogEvent } from '../../utils/logger.js';

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
            const { task, context } = req.body;
            if (!task) {
                res.status(400).json({ error: 'A feladat megadása kötelező' });
                return;
            }

            const result = await agentManager.delegate('Orchestrator', task, {
                ...context,
                chatMode: 'orchestrator'
            });

            const message = (result as any)?.message || (result as any)?.data || 'Kész.';
            res.json({
                success: true,
                message,
                taskId: (result as any)?.taskId,
                steps: (result as any)?.steps,
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
            const { task, context } = req.body;

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
                console.error(`Execution error for task ${taskId}:`, err);
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
