import { Router, type Request, type Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  getBusinessJobById,
  getBusinessJobs,
  saveBusinessJob,
  saveBusinessLead,
  updateBusinessJobStatus,
} from '../../utils/db.js';
import { getGlobalDb } from '../../utils/globalDb.js';
import { agentManager } from '../../agents/AgentManager.js';
import { logInfo, logError, logWarn } from '../../utils/logger.js';

const ROUTE = 'OnboardingIntake';

interface IntakeBody {
  trigger?: string;
  client_name?: string;
  contact_email?: string;
  email?: string;
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

type StoredIntakeMetadata = IntakeBody & {
  resolved_at?: string;
  agent_trigger?: string;
};

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

function normalizeClientName(body: IntakeBody): string {
  return typeof body.client_name === 'string' && body.client_name.trim().length > 0
    ? body.client_name.trim()
    : typeof body.brand_name === 'string' && body.brand_name.trim().length > 0
      ? body.brand_name.trim()
      : '';
}

function normalizeContactEmail(body: IntakeBody): string {
  return typeof body.contact_email === 'string' && body.contact_email.trim().length > 0
    ? body.contact_email.trim()
    : typeof body.email === 'string' && body.email.trim().length > 0
      ? body.email.trim()
      : '';
}

function parseStoredIntakeMetadata(raw: string | null): StoredIntakeMetadata | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) {
      return null;
    }
    return parsed as StoredIntakeMetadata;
  } catch {
    return null;
  }
}

function buildDispatchTask(body: StoredIntakeMetadata, agentTrigger: string): string {
  const clientLabel = normalizeClientName(body);
  const painPoint = typeof body.pain_point === 'string' ? body.pain_point : 'nincs megadva';
  const industry = typeof body.industry === 'string' ? body.industry : 'nincs megadva';
  const formType = typeof body.form_type === 'string' ? body.form_type : 'nincs megadva';

  if (agentTrigger === 'copywriter') {
    return [
      `Jóváhagyott brand onboarding intake: ${clientLabel}.`,
      'Készíts approval-safe kickoff csomagot: tone of voice vázlat, első ajánlott deliverable lista, és a következő manuális egyeztetési lépések.',
      `Form type: ${formType}.`,
      `Pilot termék: ${typeof body.pilot_product === 'string' ? body.pilot_product : 'nincs megadva'}.`,
      `Célvásárló: ${typeof body.target_customer === 'string' ? body.target_customer : 'nincs megadva'}.`,
      `Márka leírás: ${typeof body.brand_sentence === 'string' ? body.brand_sentence : 'nincs megadva'}.`,
    ].join(' ');
  }

  return [
    `Jóváhagyott onboarding intake: ${clientLabel}.`,
    `Iparág: ${industry}.`,
    `Pain point: ${painPoint}.`,
    `Form type: ${formType}.`,
    'Készíts approval-safe következő lépés tervet, elsődleges agent outputot és manuális follow-up javaslatot; kifelé ható üzenetet csak javaslatként adj vissza, ne automatikus küldésként.',
  ].join(' ');
}

type TokenValidationResult =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

/** Validate HMAC-style token from X-Brunella-Token header for external webhook intake */
function validateWebhookToken(req: Request): TokenValidationResult {
  const secret = process.env.BRUNELLA_WEBHOOK_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'test') {
      return { ok: true };
    }
    logError(ROUTE, 'BRUNELLA_WEBHOOK_SECRET nincs beállítva — az intake webhook letiltva');
    return { ok: false, status: 503, error: 'Webhook secret is not configured' };
  }

  const provided = req.headers['x-brunella-token'];
  if (typeof provided !== 'string' || provided !== secret) {
    logWarn(ROUTE, 'Unauthorized intake request — invalid X-Brunella-Token');
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  return { ok: true };
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
  router.post('/', async (req: Request, res: Response) => {
    const tokenValidation = validateWebhookToken(req);
    if (!tokenValidation.ok) {
      return res.status(tokenValidation.status).json({ status: 'error', error: tokenValidation.error });
    }

    const body = (req.body ?? {}) as IntakeBody;
    const clientName = normalizeClientName(body);
    const contactEmail = normalizeContactEmail(body);
    const formType = typeof body.form_type === 'string' ? body.form_type : '';

    // Required field validation
    const missing: string[] = [];
    if (!clientName) missing.push(body.form_type === 'premium_brand' ? 'brand_name' : 'client_name');
    if (!contactEmail) missing.push(body.form_type === 'premium_brand' ? 'email' : 'contact_email');
    if (!formType) missing.push('form_type');
    if (missing.length > 0) {
      return res.status(400).json({ status: 'error', error: `Hiányzó mezők: ${missing.join(', ')}` });
    }

    const jobId = uuidv4();
    const agentTrigger = resolveAgentTrigger(body);
    const metadata = JSON.stringify({
      ...body,
      client_name: clientName,
      contact_email: contactEmail,
      resolved_at: new Date().toISOString(),
      agent_trigger: agentTrigger,
    } satisfies StoredIntakeMetadata);

    try {
      // 1. business_job mentés (human-in-loop: pending_approval)
      await saveBusinessJob({
        id: jobId,
        type: 'onboarding_intake',
        status: 'pending_approval',
        query: `${clientName} | ${formType}`,
        metadata,
      });

      // 2. webhook_events audit log
      const db = getGlobalDb();
      if (db) {
        db.prepare(
          `INSERT INTO webhook_events (id, type, provider, payload, processed)
           VALUES (?, ?, ?, ?, 0)`,
        ).run(uuidv4(), 'onboarding_intake', formType, metadata);
      }

      logInfo(ROUTE, `Intake rögzítve | job_id=${jobId} | ügyfél=${clientName} | trigger=${agentTrigger} | státusz=pending_approval`);

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
  router.get('/pending', async (_req: Request, res: Response) => {
    try {
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
  router.post('/:jobId/approve', async (req: Request, res: Response) => {
    const jobId = String(req.params['jobId']);
    try {
      const job = await getBusinessJobById(jobId);
      if (!job) {
        return res.status(404).json({ status: 'error', error: 'Intake nem található' });
      }
      if (job.status !== 'pending_approval') {
        return res.status(409).json({ status: 'error', error: `Az intake már nem jóváhagyásra vár (státusz: ${job.status})` });
      }

      const intake = parseStoredIntakeMetadata(job.metadata);
      if (!intake) {
        return res.status(422).json({ status: 'error', error: 'Az intake metadata sérült vagy hiányzik' });
      }

      const agentTrigger = typeof intake.agent_trigger === 'string' && intake.agent_trigger.trim().length > 0
        ? intake.agent_trigger
        : resolveAgentTrigger(intake);
      const dispatchTask = buildDispatchTask(intake, agentTrigger);
      const queuedTaskId = await agentManager.queueTask(dispatchTask, agentTrigger, {
        source: 'onboarding_intake',
        jobId,
        approvedBy: 'dashboard',
        formType: intake.form_type ?? null,
        intake,
      });

      await saveBusinessLead({
        id: uuidv4(),
        job_id: jobId,
        company_name: normalizeClientName(intake),
        contact_email: normalizeContactEmail(intake),
        metadata: JSON.stringify({
          source: 'onboarding_intake',
          form_type: intake.form_type ?? null,
          industry: intake.industry ?? null,
          pain_point: intake.pain_point ?? null,
          queued_task_id: queuedTaskId,
        }),
        outreach_status: 'approved',
      });

      await updateBusinessJobStatus(jobId, 'approved', JSON.stringify({
        approved_at: new Date().toISOString(),
        approved_by: 'dashboard',
        agent_trigger: agentTrigger,
        queued_task_id: queuedTaskId,
        dispatch_task: dispatchTask,
      }));
      logInfo(ROUTE, `Intake jóváhagyva és sorba állítva | job_id=${jobId} | agent=${agentTrigger} | taskId=${queuedTaskId}`);
      return res.json({
        status: 'ok',
        job_id: jobId,
        agent_trigger: agentTrigger,
        queued_task_id: queuedTaskId,
        message: 'Jóváhagyva. Agent task sorba állítva.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(500).json({ status: 'error', error: msg });
    }
  });

  /**
   * POST /api/v1/webhook/onboarding-intake/:jobId/reject
   * Elutasítás
   */
  router.post('/:jobId/reject', async (req: Request, res: Response) => {
    const jobId = String(req.params['jobId']);
    const reason = (req.body as { reason?: string }).reason ?? 'Nincs megadva ok';
    try {
      const job = await getBusinessJobById(jobId);
      if (!job) {
        return res.status(404).json({ status: 'error', error: 'Intake nem található' });
      }
      if (job.status !== 'pending_approval') {
        return res.status(409).json({ status: 'error', error: `Az intake már nem jóváhagyásra vár (státusz: ${job.status})` });
      }

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
