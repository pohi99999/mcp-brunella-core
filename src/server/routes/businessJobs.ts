import { Router } from 'express';
import { defaultDatabaseManager, type DatabaseManager, getBusinessJobs, saveBusinessJob, updateBusinessJobStatus, getLeadsByJob, getPipelineStats, updateLeadStatus } from '../../utils/db.js';
import { agentManager } from '../../agents/AgentManager.js';
import { v4 as uuidv4 } from 'uuid';

export function createBusinessJobsRoutes(dbManager: DatabaseManager = defaultDatabaseManager): Router {
    const router = Router();

    /**
     * GET /api/v1/business-jobs/pipeline/stats
     * SalesPipelineWidget uses this to get lead counts per stage
     */
    router.get('/pipeline/stats', async (_req, res) => {
        try {
            const stats = await getPipelineStats();
            res.json({ success: true, stats });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * GET /api/v1/business-jobs/leads/all
     * Returns all leads across all jobs (recent 100)
     */
    router.get('/leads/all', async (_req, res) => {
        try {
            const database = await dbManager.getDb();
            if (!database) {
                res.json({ success: true, leads: [] });
                return;
            }
            const leads = database.prepare('SELECT * FROM business_leads ORDER BY created_at DESC LIMIT 100').all();
            res.json({ success: true, leads });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * GET /api/v1/business-jobs/leads/:jobId
     * Returns leads for a specific job
     */
    router.get('/leads/:jobId', async (req, res) => {
        try {
            const leads = await getLeadsByJob(req.params.jobId);
            res.json({ success: true, leads });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * PATCH /api/v1/business-jobs/leads/:leadId/status
     * Updates a lead's pipeline stage
     */
    router.patch('/leads/:leadId/status', async (req, res) => {
        try {
            const { status, notes } = req.body;
            if (!status) {
                res.status(400).json({ success: false, error: 'Status is required' });
                return;
            }
            await updateLeadStatus(req.params.leadId, status, notes);
            res.json({ success: true, message: 'Lead status updated' });
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            res.status(500).json({ success: false, error: msg });
        }
    });

    /**
     * GET /api/v1/business-jobs
     * List all business jobs
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
     * POST /api/v1/business-jobs
     * Start a new business job (e.g. lead mining, grant hunting, etc.)
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
                agentManager.queueTask(`Bányássz lead-eket: ${query}`, 'lead_mining', { jobId, metadata });
            } else if (type === 'invoice_sync') {
                agentManager.queueTask(`Szinkronizáld a számlákat: ${query}`, 'FinanceGuardian', { jobId, taskType: 'full_sync' });
            } else if (type === 'innovation_bridge') {
                agentManager.queueTask(`Innovációs kutatás: ${query}`, 'InnovationBridge', { jobId, problem: query });
            } else if (type === 'digital_hr') {
                agentManager.queueTask(`CV szűrés és értékelés: ${query}`, 'DigitalHeadhunter', { jobId, taskType: 'process_cvs' });
            } else if (type === 'grant_hunter') {
                agentManager.queueTask(`Pályázatfigyelés: ${query}`, 'GrantWatcher', { jobId, taskType: 'scan_grants' });
            } else {
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
