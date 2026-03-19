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
import { socketService } from '../SocketService.js';
import { ChromeDevToolsAgent } from '../../agents/ChromeDevToolsAgent.js';

const PYTHON_API = process.env.PYTHON_API_URL || 'http://localhost:8000';

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
                    active: getRobotkezBrowserEngine().isConnected(),
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

    // -----------------------------------------------------------------------
    // COMPUTER USE — OS szintű vezérlés proxy-k (Python myai/server.py → port 8000)
    // -----------------------------------------------------------------------

    /**
     * GET /api/v1/robotkez/computer/screenshot
     * Képernyőfotó készítése pyautogui segítségével (base64 PNG)
     *
     * Response: { status, screenshot_b64 }
     */
    router.get('/computer/screenshot', async (_req: Request, res: Response) => {
        try {
            const r = await fetch(`${PYTHON_API}/os/screenshot`);
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/screenshot error: ${msg}`);
            res.status(502).json({ success: false, error: `Python API nem elérhető: ${msg}` });
        }
    });

    /**
     * GET /api/v1/robotkez/computer/screen-size
     * Képernyő felbontás lekérdezése
     *
     * Response: { width, height }
     */
    router.get('/computer/screen-size', async (_req: Request, res: Response) => {
        try {
            const r = await fetch(`${PYTHON_API}/os/screen-size`);
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/screen-size error: ${msg}`);
            res.status(502).json({ success: false, error: `Python API nem elérhető: ${msg}` });
        }
    });

    /**
     * POST /api/v1/robotkez/computer/click
     * Kattintás abszolút koordinátákra
     *
     * Body: { x: number, y: number, clicks?: number }
     */
    router.post('/computer/click', async (req: Request, res: Response) => {
        try {
            const { x, y, clicks = 1 } = req.body as { x: number; y: number; clicks?: number };
            if (x === undefined || y === undefined) {
                return res.status(400).json({ success: false, error: 'x és y megadása kötelező' });
            }
            const r = await fetch(`${PYTHON_API}/os/click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x, y, clicks })
            });
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/click error: ${msg}`);
            res.status(502).json({ success: false, error: `Python API nem elérhető: ${msg}` });
        }
    });

    /**
     * POST /api/v1/robotkez/computer/click-pct
     * Kattintás százalékos koordinátákra (felbontás-független)
     *
     * Body: { x_pct: number, y_pct: number, clicks?: number }  — értékek: 0.0–1.0
     */
    router.post('/computer/click-pct', async (req: Request, res: Response) => {
        try {
            const { x_pct, y_pct, clicks = 1 } = req.body as { x_pct: number; y_pct: number; clicks?: number };
            if (x_pct === undefined || y_pct === undefined) {
                return res.status(400).json({ success: false, error: 'x_pct és y_pct megadása kötelező (0.0-1.0)' });
            }
            const r = await fetch(`${PYTHON_API}/os/click-pct`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ x_pct, y_pct, clicks })
            });
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/click-pct error: ${msg}`);
            res.status(502).json({ success: false, error: `Python API nem elérhető: ${msg}` });
        }
    });

    /**
     * POST /api/v1/robotkez/computer/type
     * Szöveg begépelése (aktív ablakba)
     *
     * Body: { text: string, interval?: number }
     */
    router.post('/computer/type', async (req: Request, res: Response) => {
        try {
            const { text, interval } = req.body as { text: string; interval?: number };
            if (!text || typeof text !== 'string') {
                return res.status(400).json({ success: false, error: 'text megadása kötelező' });
            }
            const body: Record<string, unknown> = { text };
            if (interval !== undefined) body['interval'] = interval;
            const r = await fetch(`${PYTHON_API}/os/type`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/type error: ${msg}`);
            res.status(502).json({ success: false, error: `Python API nem elérhető: ${msg}` });
        }
    });

    /**
     * POST /api/v1/robotkez/computer/vision-click
     * Vision alapú kattintás: leírás alapján megkeresi és rákattint az elemre
     *
     * Body: { description: string }
     */
    router.post('/computer/vision-click', async (req: Request, res: Response) => {
        try {
            const { description } = req.body as { description: string };
            if (!description || typeof description !== 'string') {
                return res.status(400).json({ success: false, error: 'description megadása kötelező' });
            }
            const r = await fetch(`${PYTHON_API}/os/vision-click`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ description })
            });
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/vision-click error: ${msg}`);
            res.status(502).json({ success: false, error: `Python API nem elérhető: ${msg}` });
        }
    });

    // -----------------------------------------------------------------------
    // COMET AUTO — Autonóm multi-step loop (Planner → Actor → Critic)
    // -----------------------------------------------------------------------

    const ROBOTKEZ_PRO_API = process.env.ROBOTKEZ_PRO_URL || 'http://localhost:8090';

    /**
     * POST /api/v1/robotkez/step-event
     * Fogadja a Python Comet Orchestrator step eseményeit és továbbítja Socket.IO-n
     *
     * Body: { type, attempt, step_index, action, success, error, ... }
     */
    router.post('/step-event', async (req: Request, res: Response) => {
        try {
            const stepInfo = req.body as Record<string, unknown>;
            socketService.broadcastRobotkezStep(stepInfo);
            res.json({ ok: true });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `step-event error: ${msg}`);
            res.status(500).json({ ok: false, error: msg });
        }
    });

    /**
     * POST /api/v1/robotkez/computer/auto
     * Autonóm feladat-végrehajtás Comet Orchestrator-ral
     *
     * Body: { task: string, max_retries?: number }
     * Response: { status, comet_result: { success, attempts, steps_completed, error }, step_log }
     */
    router.post('/computer/auto', async (req: Request, res: Response) => {
        try {
            const { task, max_retries = 3 } = req.body as { task: string; max_retries?: number };
            if (!task || typeof task !== 'string') {
                return res.status(400).json({ success: false, error: 'task megadása kötelező' });
            }
            logInfo('RobotkezAPI', `Comet Auto indítás: "${task.slice(0, 60)}"`);
            const r = await fetch(
                `${ROBOTKEZ_PRO_API}/computer_use_auto?task=${encodeURIComponent(task)}&max_retries=${max_retries}`,
                { method: 'POST' }
            );
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `computer/auto error: ${msg}`);
            res.status(502).json({ success: false, error: `Robotkéz Pro API nem elérhető: ${msg}` });
        }
    });

    // -----------------------------------------------------------------------
    // TRAINING MANAGEMENT — háttér tréning vezérlés
    // -----------------------------------------------------------------------

    /**
     * POST /api/v1/robotkez/training/start
     * Háttérben elindítja a training suite-ot
     *
     * Body: { mode?: 'basic' | 'workflows', hours?: number, retries?: number }
     */
    router.post('/training/start', async (req: Request, res: Response) => {
        try {
            const { mode = 'basic', hours = 4, retries = 3 } = req.body as {
                mode?: string; hours?: number; retries?: number;
            };
            logInfo('RobotkezAPI', `Training start: mode=${mode}`);
            const r = await fetch(`${ROBOTKEZ_PRO_API}/training/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode, hours, retries })
            });
            const data = await r.json() as Record<string, unknown>;
            if (!r.ok) {
                return res.status(r.status).json(data);
            }
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `training/start error: ${msg}`);
            res.status(502).json({ success: false, error: `Robotkéz Pro nem elérhető: ${msg}` });
        }
    });

    /**
     * GET /api/v1/robotkez/training/status
     * Visszaadja a futó tréning állapotát
     */
    router.get('/training/status', async (_req: Request, res: Response) => {
        try {
            const r = await fetch(`${ROBOTKEZ_PRO_API}/training/status`);
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(502).json({ running: false, error: `Robotkéz Pro nem elérhető: ${msg}` });
        }
    });

    /**
     * POST /api/v1/robotkez/training/stop
     * Leállítja a futó tréninget
     */
    router.post('/training/stop', async (_req: Request, res: Response) => {
        try {
            const r = await fetch(`${ROBOTKEZ_PRO_API}/training/stop`, { method: 'POST' });
            const data = await r.json() as Record<string, unknown>;
            res.json(data);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            res.status(502).json({ success: false, error: `Robotkéz Pro nem elérhető: ${msg}` });
        }
    });

    // -----------------------------------------------------------------------
    // CHROME DEVTOOLS — hálózati, konzol, performance debug (Playwright CDP)
    // -----------------------------------------------------------------------

    const devToolsAgent = new ChromeDevToolsAgent();

    /**
     * POST /api/v1/robotkez/devtools/report
     * Teljes debug riport (hálózat + konzol + performance) egy URL-ről
     *
     * Body: { url: string }
     * Response: { success, report: DebugReport, markdown: string }
     */
    router.post('/devtools/report', async (req: Request, res: Response) => {
        try {
            const { url } = req.body as { url?: string };
            if (!url || typeof url !== 'string') {
                return res.status(400).json({ success: false, error: 'url megadása kötelező' });
            }
            logInfo('RobotkezAPI', `DevTools report: ${url}`);
            const result = await devToolsAgent.execute(`Debug report for ${url}`, { url, capability: 'report' });
            if (result.status === 'error') {
                return res.status(500).json({ success: false, error: result.error });
            }
            const data = result.data as { report: unknown; markdown: string };
            res.json({ success: true, report: data.report, markdown: data.markdown });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `devtools/report error: ${msg}`);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * POST /api/v1/robotkez/devtools/network
     * Hálózati kérések rögzítése egy URL-ről
     *
     * Body: { url: string, duration?: number }
     * Response: { success, requests, failedRequests }
     */
    router.post('/devtools/network', async (req: Request, res: Response) => {
        try {
            const { url, duration } = req.body as { url?: string; duration?: number };
            if (!url || typeof url !== 'string') {
                return res.status(400).json({ success: false, error: 'url megadása kötelező' });
            }
            logInfo('RobotkezAPI', `DevTools network: ${url}`);
            const data = await devToolsAgent.captureNetworkRequests(url, duration || 8000);
            res.json({ success: true, ...data });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `devtools/network error: ${msg}`);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * POST /api/v1/robotkez/devtools/console
     * Konzol hibák és figyelmeztetések rögzítése
     *
     * Body: { url: string, duration?: number }
     * Response: { success, errors, warnings }
     */
    router.post('/devtools/console', async (req: Request, res: Response) => {
        try {
            const { url, duration } = req.body as { url?: string; duration?: number };
            if (!url || typeof url !== 'string') {
                return res.status(400).json({ success: false, error: 'url megadása kötelező' });
            }
            logInfo('RobotkezAPI', `DevTools console: ${url}`);
            const data = await devToolsAgent.captureConsoleErrors(url, duration || 8000);
            res.json({ success: true, ...data });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `devtools/console error: ${msg}`);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * POST /api/v1/robotkez/devtools/performance
     * Teljesítmény metrikák gyűjtése
     *
     * Body: { url: string }
     * Response: { success, metrics: PerformanceMetrics }
     */
    router.post('/devtools/performance', async (req: Request, res: Response) => {
        try {
            const { url } = req.body as { url?: string };
            if (!url || typeof url !== 'string') {
                return res.status(400).json({ success: false, error: 'url megadása kötelező' });
            }
            logInfo('RobotkezAPI', `DevTools performance: ${url}`);
            const metrics = await devToolsAgent.getPerformanceMetrics(url);
            res.json({ success: true, metrics });
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            logError('RobotkezAPI', `devtools/performance error: ${msg}`);
            res.status(500).json({ success: false, error: msg });
        }
    });

    return router;
}
