import { Router } from 'express';
import { defaultDatabaseManager, type DatabaseManager, getBusinessJobs, saveBusinessJob, updateBusinessJobStatus, getLeadsByJob, getPipelineStats, updateLeadStatus } from '@packages/utils/db.js';
import { agentManager } from '@packages/agents/AgentManager.js';
import { v4 as uuidv4 } from 'uuid';

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function readLimit(value: unknown, fallback: number): number {
    const parsed = Number(value ?? fallback);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(Math.max(Math.trunc(parsed), 1), 100);
}

function normalizeMetadata(value: unknown): string | undefined {
    if (isRecord(value)) return JSON.stringify(value);
    const text = readString(value);
    return text ?? undefined;
}

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
            const jobId = readString(req.params.jobId);
            if (!jobId) {
                res.status(400).json({ success: false, error: 'Job id is required' });
                return;
            }
            const leads = await getLeadsByJob(jobId);
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
            const body = isRecord(req.body) ? req.body : {};
            const leadId = readString(req.params.leadId);
            const status = readString(body.status);
            const notes = readString(body.notes);
            if (!leadId) {
                res.status(400).json({ success: false, error: 'Lead id is required' });
                return;
            }
            if (!status) {
                res.status(400).json({ success: false, error: 'Status is required' });
                return;
            }
            await updateLeadStatus(leadId, status, notes ?? undefined);
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
            const limit = readLimit(req.query.limit, 20);
            const type = readString(req.query.type) ?? undefined;
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
            const body = isRecord(req.body) ? req.body : {};
            const type = readString(body.type);
            const query = readString(body.query);
            const metadata = isRecord(body.metadata) ? body.metadata : undefined;

            if (!type || !query) {
                res.status(400).json({ success: false, error: 'Type and query are required' });
                return;
            }

            const jobId = uuidv4();
            await saveBusinessJob({
                id: jobId,
                type,
                query,
                metadata: normalizeMetadata(metadata)
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
