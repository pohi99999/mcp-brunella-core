import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { saveBusinessJob } from '../../utils/db.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';

const ROUTE = 'OnboardingIntake';

interface IntakeBody {
  trigger?: string;
  client_name?: string;
  contact_email?: string;
  industry?: string;
  pain_point?: string;
  form_type?: string;
  // optional enrichment fields
  manual_hours?: string | number;
  current_tools?: string;
  wow_result?: string;
  brand_name?: string;
  task?: string;
  [key: string]: unknown;
}

/** Map form_type + pain_point → agent trigger */
function resolveAgentTrigger(body: IntakeBody): string {
  if (body.trigger) return body.trigger;

  const formType = body.form_type ?? '';
  if (formType === 'premium_brand') return 'copywriter';

  // KKV routing by pain_point
  const pain = (body.pain_point ?? '').toLowerCase();
  if (pain.includes('könyvel') || pain.includes('pénzügy') || pain.includes('számla')) return 'InvoiceAutomation';
  if (pain.includes('marketing') || pain.includes('kampány')) return 'CampaignGenerator';
  if (pain.includes('hr') || pain.includes('toborzás') || pain.includes('bér')) return 'enterprise_orchestrator';
  if (pain.includes('logisz') || pain.includes('készlet')) return 'logistics_dispatcher';
  return 'enterprise_orchestrator';
}

/** Validate HMAC-style token from X-Brunella-Token header */
function validateToken(req: any): boolean {
  const secret = process.env.BRUNELLA_WEBHOOK_SECRET;
  if (!secret) {
    logWarn(ROUTE, 'BRUNELLA_WEBHOOK_SECRET nincs beállítva — token validáció kihagyva');
    return true;
  }
  const provided = req.headers['x-brunella-token'];
  return provided === secret;
}

export function createOnboardingIntakeRoutes(): Router {
  const router = Router();

  /**
   * POST /api/v1/webhook/onboarding-intake
   *
   * Human-in-Loop kapupoint — az összes form submission ide érkezik (n8n/Tally/Google Form).
   * Az intake SOHA nem küld ki semmit automatikusan — csak business_job-ot hoz létre
   * pending_approval státusszal, ami manuális jóváhagyást vár a Dashboardon.
   *
   * Body: { trigger?, client_name, contact_email, industry, pain_point, form_type, ...extra }
   * Returns: { status: 'ok', job_id, agent_trigger, message }
   */
  router.post('/', async (req: any, res: any) => {
    if (!validateToken(req)) {
      logWarn(ROUTE, 'Unauthorized intake request — invalid X-Brunella-Token');
      return res.status(401).json({ status: 'error', error: 'Unauthorized' });
    }

    const body = (req.body ?? {}) as IntakeBody;
    const { client_name, contact_email, form_type } = body;

    // Required field validation
    const missing: string[] = [];
    if (!client_name) missing.push('client_name');
    if (!contact_email) missing.push('contact_email');
    if (!form_type) missing.push('form_type');
    if (missing.length > 0) {
      return res.status(400).json({ status: 'error', error: `Hiányzó mezők: ${missing.join(', ')}` });
    }

    const jobId = uuidv4();
    const agentTrigger = resolveAgentTrigger(body);
    const metadata = JSON.stringify({ ...body, resolved_at: new Date().toISOString() });

    try {
      // 1. business_job mentés (human-in-loop: pending_approval)
      await saveBusinessJob({
        id: jobId,
        type: 'onboarding_intake',
        status: 'pending_approval',
        query: `${client_name} | ${form_type}`,
        metadata,
      });

      // 2. webhook_events audit log
      const db = getGlobalDb();
      if (db) {
        db.prepare(
          `INSERT INTO webhook_events (id, type, provider, payload, processed)
           VALUES (?, ?, ?, ?, 0)`,
        ).run(uuidv4(), 'onboarding_intake', form_type, metadata);
      }

      logInfo(ROUTE, `Intake rögzítve | job_id=${jobId} | ügyfél=${client_name} | trigger=${agentTrigger} | státusz=pending_approval`);

      return res.status(201).json({
        status: 'ok',
        job_id: jobId,
        agent_trigger: agentTrigger,
        message: 'Intake rögzítve. Jóváhagyásra vár a Dashboardon.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(ROUTE, `Intake mentési hiba: ${msg}`);
      return res.status(500).json({ status: 'error', error: 'Intake feldolgozás sikertelen' });
    }
  });

  /**
   * GET /api/v1/webhook/onboarding-intake/pending
   * Dashboard lekérdezés — jóváhagyásra váró intake-ek listája
   */
  router.get('/pending', async (_req: any, res: any) => {
    try {
      const { getBusinessJobs } = await import('../../utils/db.js');
      const jobs = await getBusinessJobs(50, 'onboarding_intake');
      const pending = jobs.filter((j) => j.status === 'pending_approval');
      return res.json({ status: 'ok', count: pending.length, jobs: pending });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logError(ROUTE, `Pending lekérdezési hiba: ${msg}`);
      return res.status(500).json({ status: 'error', error: msg });
    }
  });

  /**
   * POST /api/v1/webhook/onboarding-intake/:jobId/approve
   * Jóváhagyás — az agent trigger ekkor indul el
   */
  router.post('/:jobId/approve', async (req: any, res: any) => {
    if (!validateToken(req)) {
      return res.status(401).json({ status: 'error', error: 'Unauthorized' });
    }
    const jobId = String(req.params['jobId']);
    try {
      const { updateBusinessJobStatus } = await import('../../utils/db.js');
      await updateBusinessJobStatus(jobId, 'approved', JSON.stringify({ approved_at: new Date().toISOString(), approved_by: 'dashboard' }));
      logInfo(ROUTE, `Intake jóváhagyva | job_id=${jobId}`);
      return res.json({ status: 'ok', job_id: jobId, message: 'Jóváhagyva. Agent trigger indul.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ status: 'error', error: msg });
    }
  });

  /**
   * POST /api/v1/webhook/onboarding-intake/:jobId/reject
   * Elutasítás
   */
  router.post('/:jobId/reject', async (req: any, res: any) => {
    if (!validateToken(req)) {
      return res.status(401).json({ status: 'error', error: 'Unauthorized' });
    }
    const jobId = String(req.params['jobId']);
    const reason = (req.body as { reason?: string }).reason ?? 'Nincs megadva ok';
    try {
      const { updateBusinessJobStatus } = await import('../../utils/db.js');
      await updateBusinessJobStatus(jobId, 'rejected', JSON.stringify({ rejected_at: new Date().toISOString(), reason }));
      logInfo(ROUTE, `Intake elutasítva | job_id=${jobId} | ok=${reason}`);
      return res.json({ status: 'ok', job_id: jobId, message: 'Elutasítva.' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ status: 'error', error: msg });
    }
  });

  return router;
}
