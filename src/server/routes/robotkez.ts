/**
 * RobotkezV2 REST API Routes
 *
 * Replaces the old Browser-Use based robotkez with the new
 * Persistent Browser + LLM Planning approach.
 *
 * Endpoints:
 * - POST /api/v1/robotkez/chat - Natural language chat
 * - POST /api/v1/robotkez/plan - Plan preview (no execution)
 * - POST /api/v1/robotkez/exec - Direct browser action
 * - GET /api/v1/robotkez/status - Agent status
 * - GET /api/v1/robotkez/tasks - Background tasks list
 * - GET /api/v1/robotkez/tasks/:id - Task status by ID
 * - DELETE /api/v1/robotkez/tasks/:id - Cancel task
 *
 * @track robotkezv2-full-comet-20260215
 * @phase Phase 5 - REST API Endpoints
 */

import { Router, Request, Response } from 'express';
import { RobotkezV2Agent } from '../../agents/RobotkezV2Agent.js';
import { generateExecutionPlan } from '../../utils/llmPlanner.js';
import { getRobotkezBrowserEngine, getRobotkezEngineName } from '../../utils/browserEngine.js';
import { backgroundTaskManager } from '../../utils/backgroundTaskManager.js';
import { logInfo, logError } from '../../utils/logger.js';
import { getMessages, saveMessage } from '../../utils/db.js';

export function createRobotkezRoutes(): Router {
    const router = Router();
    const agent = new RobotkezV2Agent();

    /**
     * POST /api/v1/robotkez/chat
     * Natural language chat interface
     *
     * Body: { instruction: string }
     * Response: AgentResult (success, message, data)
     */
    router.post('/chat', async (req: Request, res: Response) => {
        try {
            const { instruction } = req.body;

            if (!instruction || typeof instruction !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing or invalid "instruction" field'
                });
            }

            logInfo('RobotkezAPI', `Chat request: "${instruction}"`);

            const CHAT_ID = 'robotkez-chat';
            
            // Save user message
            await saveMessage(CHAT_ID, 'user', instruction);

            // Get history (last 10 messages)
            const allMessages = await getMessages(CHAT_ID);
            const history = allMessages.slice(-10).map(m => ({
                role: m.role,
                content: m.content
            }));

            const result = await agent.execute(instruction, { 
                swarm: { 
                    sessionId: CHAT_ID,
                    history,
                    artifacts: {}
                } 
            });

            // Save assistant response
            if (result.status === 'success' || result.status === 'handoff') {
                await saveMessage(CHAT_ID, 'assistant', result.message || 'Kész');
            }

            res.json(result);

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Chat error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * POST /api/v1/robotkez/plan
     * Generate execution plan without executing (preview mode)
     *
     * Body: { instruction: string }
     * Response: { plan: ExecutionPlan }
     */
    router.post('/plan', async (req: Request, res: Response) => {
        try {
            const { instruction } = req.body;

            if (!instruction || typeof instruction !== 'string') {
                return res.status(400).json({
                    success: false,
                    error: 'Missing or invalid "instruction" field'
                });
            }

            logInfo('RobotkezAPI', `Plan request: "${instruction}"`);

            const plan = await generateExecutionPlan(instruction);

            res.json({
                success: true,
                plan,
                message: `Plan generálva: ${plan.plan.length} lépés`
            });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Plan error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * POST /api/v1/robotkez/exec
     * Execute direct browser action (low-level)
     *
     * Body: { action: string, ...params }
     * Examples:
     * - { action: 'navigate', url: 'https://google.com' }
     * - { action: 'click', selector: '.button' }
     * - { action: 'type', selector: 'input', text: 'hello' }
     */
    router.post('/exec', async (req: Request, res: Response) => {
        try {
            const { action, ...params } = req.body;

            if (!action) {
                return res.status(400).json({
                    success: false,
                    error: 'Missing "action" field'
                });
            }

            logInfo('RobotkezAPI', `Exec request: ${action}`);

            const browserEngine = getRobotkezBrowserEngine();

            const result = await browserEngine.sendCommand({
                action,
                ...params
            });

            res.json({
                success: true,
                result,
                message: `Action executed: ${action}`
            });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Exec error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * GET /api/v1/robotkez/status
     * Get agent and browser status
     *
     * Response: { agent, browser, tasks }
     */
    router.get('/status', async (req: Request, res: Response) => {
        try {
            const tasks = backgroundTaskManager.getAllTasks();
            const runningTasks = tasks.filter(t => t.status === 'running');

            res.json({
                success: true,
                agent: {
                    name: agent.name,
                    role: agent.role,
                    capabilities: agent.capabilities
                },
                browser: {
                    active: true, // TODO: Check actual browser status
                    type: 'persistent',
                    engine: getRobotkezEngineName() === 'cloudflare' ? 'Cloudflare Browser Rendering' : 'Playwright + Python'
                },
                browserStatus: runningTasks.length > 0 ? 'running' : 'idle', // For test compatibility
                tasks: {
                    total: tasks.length,
                    running: runningTasks.length,
                    completed: tasks.filter(t => t.status === 'completed').length,
                    error: tasks.filter(t => t.status === 'error').length
                }
            });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Status error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * GET /api/v1/robotkez/tasks
     * List all background tasks
     *
     * Query params:
     * - status?: 'running' | 'completed' | 'error' | 'cancelled'
     * - limit?: number (default: 50)
     *
     * Response: { tasks: BackgroundTask[] }
     */
    router.get('/tasks', async (req: Request, res: Response) => {
        try {
            const { status, limit } = req.query;

            let tasks = backgroundTaskManager.getAllTasks();

            // Filter by status if provided
            if (status && typeof status === 'string') {
                const statusStr = Array.isArray(status) ? status[0] : status;
                tasks = tasks.filter(t => t.status === statusStr);
            }

            // Apply limit
            const limitStr = Array.isArray(limit) ? limit[0] : limit;
            const limitNum = limitStr ? parseInt(limitStr as string, 10) : 50;
            tasks = tasks.slice(0, limitNum);

            res.json({
                success: true,
                tasks,
                count: tasks.length
            });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Tasks list error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * GET /api/v1/robotkez/tasks/:id
     * Get single task status by ID
     *
     * Response: { task: BackgroundTask }
     */
    router.get('/tasks/:id', async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const task = backgroundTaskManager.getTaskStatus(id);

            if (!task) {
                return res.status(404).json({
                    success: false,
                    error: `Task not found: ${id}`
                });
            }

            res.json({
                success: true,
                task
            });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Task status error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * DELETE /api/v1/robotkez/tasks/:id
     * Cancel running task
     *
     * Response: { cancelled: boolean }
     */
    router.delete('/tasks/:id', async (req: Request, res: Response) => {
        try {
            const id = req.params.id as string;

            const cancelled = backgroundTaskManager.cancelTask(id);

            if (!cancelled) {
                return res.status(400).json({
                    success: false,
                    error: `Task cannot be cancelled (not running or not found): ${id}`
                });
            }

            res.json({
                success: true,
                cancelled: true,
                message: `Task ${id} cancelled`
            });

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Task cancel error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    /**
     * GET /api/v1/robotkez/screenshot
     * Get latest browser screenshot (PNG image)
     *
     * Response: PNG image (Content-Type: image/png)
     */
    router.get('/screenshot', async (req: Request, res: Response) => {
        try {
            const browserEngine = getRobotkezBrowserEngine();
            const screenshot = browserEngine.getLastScreenshot();

            if (!screenshot) {
                return res.status(404).json({
                    success: false,
                    error: 'No screenshot available'
                });
            }

            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.send(Buffer.from(screenshot));

        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `Screenshot error: ${msg}`);
            res.status(500).json({
                success: false,
                error: msg
            });
        }
    });

    return router;
}
