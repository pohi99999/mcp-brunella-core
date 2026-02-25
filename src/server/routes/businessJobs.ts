import { Router } from 'express';
import { getBusinessJobs, saveBusinessJob, updateBusinessJobStatus } from '../../utils/db.js';
import { agentManager } from '../../agents/AgentManager.js';
import { v4 as uuidv4 } from 'uuid';

export function createBusinessJobsRoutes(): Router {
    const router = Router();

    /**
     * @swagger
     * /api/v1/business-jobs:
     *   get:
     *     summary: List all business jobs
     *     responses:
     *       200:
     *         description: List of jobs
     */
    router.get('/', async (req, res) => {
        try {
            const limit = parseInt(req.query.limit as string) || 20;
            const type = typeof req.query.type === 'string' ? req.query.type : undefined;
            const jobs = await getBusinessJobs(limit, type);
            res.json({ success: true, jobs });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * @swagger
     * /api/v1/business-jobs:
     *   post:
     *     summary: Start a new business job (e.g. lead mining)
     */
    router.post('/', async (req, res) => {
        try {
            const { type, query, metadata } = req.body;

            if (!type || !query) {
                res.status(400).json({ success: false, error: 'Type and query are required' });
                return;
            }

            const jobId = uuidv4();
            await saveBusinessJob({
                id: jobId,
                type,
                query,
                metadata: typeof metadata === 'object' ? JSON.stringify(metadata) : metadata
            });

            // Trigger the agent asynchronously
            if (type === 'lead_mining') {
                agentManager.queueTask(`Bányássz lead-eket: ${query}`, 'lead_mining', { jobId });
            } else if (type === 'invoice_sync') {
                agentManager.queueTask(`Szinkronizáld a számlákat: ${query}`, 'FinanceGuardian', { jobId, taskType: 'full_sync' });
            } else if (type === 'innovation_bridge') {
                agentManager.queueTask(`Innovációs kutatás: ${query}`, 'InnovationBridge', { jobId, problem: query });
            } else if (type === 'digital_hr') {
                agentManager.queueTask(`CV szűrés és értékelés: ${query}`, 'DigitalHeadhunter', { jobId, taskType: 'process_cvs' });
            } else if (type === 'grant_hunter') {
                agentManager.queueTask(`Pályázatfigyelés: ${query}`, 'GrantWatcher', { jobId, taskType: 'scan_grants' });
            } else {
                // Generic handler
                agentManager.queueTask(`Üzleti feladat (${type}): ${query}`, 'orchestrator', { jobId });
            }

            res.json({ success: true, jobId, message: 'Business job queued' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: msg });
        }
    });

    return router;
}
