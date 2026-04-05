# Plan: KKV CRM follow-up routing — végrehajtó terv

## Rövid célleírás
Automatizálni a CRM-ből érkező lead eseményekből a follow-up munkák létrehozását úgy, hogy a routing logika könnyen konfigurálható legyen, idempotens, biztonságos és monitorozott. Platform választás: n8n (rapid deploy) vagy belső orchestrator HTTP API (új endpoint), mindkettő támogatva.

## Technikai kontextus
- Input: CRM webhook események (JSON)
- Output: follow-up job létrehozása belső API-n keresztül (`POST /api/v1/followups`) vagy n8n események
- Security: webhook secret HMAC, service token az orchestratorhoz

## Fázisok és Plan elemek

P1 — Setup & Scaffolding
- P1.1: Track scaffold és repo hely: `conductor/tracks/kkv_crm_followup_routing_20260405`
- P1.2: Konfiguráció storage: `config/followup-routing.yaml` (később: Vault/KeyVault)

P2 — Foundation (blocking prerequisites)
- P2.1: CRM ingest readiness (dependency: `kkv_crm_ingest_foundation_20260405`) — verify schema
- P2.2: Orchestrator API contract: `POST /api/v1/followups` (spec vagy OpenAPI stub)
- P2.3: Secrets management: `WEBHOOK_SECRET`, `ORCHESTRATOR_TOKEN`

P3 — Implementation (n8n fast path)
- P3.1: n8n webhook workflow: webhook trigger → Validate signature → Transform → Call Orchestrator API → Set status/metrics
- P3.2: n8n error path: retry/backoff → dead-letter (log + alert)

P4 — Implementation (internal orchestrator path)
- P4.1: Implement `/api/v1/crm/webhook/followup` route (Express/Route sample) that: validates, enqueues/creates job (calls internal service), returns 200/201
- P4.2: Service-level idempotency check (event_id dedupe table or Redis)

P5 — Tests
- P5.1: Unit tests for signature validation and routing rules
- P5.2: Integration test: simulate webhook -> verify `/api/v1/followups` called or n8n executed
- P5.3: E2E smoke test (staging): CRM sample event → job visible in followup queue

P6 — CI / Deployment
- P6.1: Add pipeline job to run `npm run test:fast` and linter on PR
- P6.2: Add n8n workflow export to repo (if using n8n) and CI lint step to validate import

P7 — Rollout & Runbook
- P7.1: Feature flag (initial rollout to 10% of leads) and monitoring dashboard
- P7.2: Runbook for failures and manual retry

## Task Breakdown (TIDs)

- [ ] T001 [Plan:P1.1] Add track scaffold: `conductor/tracks/kkv_crm_followup_routing_20260405/meta.json` (DONE)
- [ ] T002 [Plan:P1.2] Create `config/followup-routing.example.yaml` with default rules
- [ ] T003 [Plan:P2.2] Draft OpenAPI stub for `POST /api/v1/followups` at `src/server/api/followups/openapi.yaml`
- [ ] T004 [Plan:P3.1] Create n8n workflow JSON in `conductor/tracks/.../n8n/kkv-followup-routing.json` (importable)
- [ ] T005 [Plan:P4.1] Implement sample webhook route `src/server/routes/crmFollowupWebhook.ts` (sample below)
- [ ] T006 [Plan:P4.2] Implement idempotency store interface (`src/core/idempotency.ts`) using Redis/SQLite
- [ ] T007 [Plan:P5.1] Unit tests for `src/server/routes/crmFollowupWebhook.ts` — `test/crmFollowupWebhook.test.ts`
- [ ] T008 [Plan:P5.2] Integration test harness script `conductor/tracks/.../tests/integration/run_integration.sh`
- [ ] T009 [Plan:P6.1] CI: add `ci/kkv_crm_followup.yml` (extends base pipeline, runs tests + lints)
- [ ] T010 [Plan:P7.2] Write runbook `docs/runbooks/kkv_crm_followup.md`

## Requirement Mapping

| REQ ID | Short desc | Plan Items | Implementation Evidence |
|--------|------------|------------|------------------------|
| REQ-001 | Event-driven routing | P3.1, P4.1 | n8n workflow JSON, `src/server/routes/crmFollowupWebhook.ts` |
| REQ-002 | Idempotencia | P4.2 | `src/core/idempotency.ts`, integration test |
| REQ-003 | Biztonság: webhook signature | P3.1, P4.1 | signature validation in handler, unit tests |
| REQ-004 | Konfigurable routing rules | P1.2, P3.1 | `config/followup-routing.example.yaml` |
| REQ-005 | Observability | P3.2, P6.1 | logs/metrics, CI smoke tests |
| REQ-006 | Retry & Fallback | P3.2, P4.1 | retry/backoff logic in workflow/handler |

## Minimal sample webhook handler (példa)
Path (suggested sample): `conductor/tracks/kkv_crm_followup_routing_20260405/samples/kkvCrmFollowupWebhook.ts`

```ts
// Minimal standalone handler example (use project logger + types in real code)
import type { Request, Response } from 'express';
import crypto from 'crypto';

const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL || 'http://localhost:3000/api/v1/followups';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'change-me';

export async function crmFollowupHandler(req: Request, res: Response) {
  const raw = JSON.stringify(req.body);
  const signature = req.headers['x-crm-signature'] as string | undefined;
  if (!verifySignature(raw, signature)) return res.status(401).send('invalid signature');

  const { lead_id, event_id, status, priority, owner_id } = req.body;
  if (!lead_id || !event_id) return res.status(400).send('missing lead_id/event_id');

  // idempotency check should be here (call to idempotency store)
  // routing decision (example): create followup when status === 'new' or priority === 'high'
  const shouldCreate = status === 'new' || priority === 'high';
  if (!shouldCreate) return res.status(204).send();

  // create follow-up job in orchestrator
  const payload = { lead_id, owner_id, due_in_days: 2, note: 'Follow up via automated routing', source: 'crm-webhook' };
  try {
    await fetch(ORCHESTRATOR_URL, { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${process.env.ORCHESTRATOR_TOKEN || ''}` }, body: JSON.stringify(payload) });
    return res.status(201).send({ ok: true });
  } catch (e) {
    // log and return 502 to trigger retry if upstream expects it
    return res.status(502).send('orchestrator error');
  }
}

function verifySignature(raw: string, signature?: string) {
  if (!signature) return false;
  const h = crypto.createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');
  return signature === `sha256=${h}`;
}
```

## Minimal unit test (Vitest style) — path:
`conductor/tracks/kkv_crm_followup_routing_20260405/samples/kkvCrmFollowupWebhook.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { crmFollowupHandler } from './kkvCrmFollowupWebhook';

// This is illustrative — adapt to project's request/response test helpers
describe('crmFollowupHandler', () => {
  it('returns 401 for invalid signature', async () => {
    // build mock req/res with invalid signature -> expect 401
  });
});
```

## CI & deployment notes
- Add `ci/kkv_crm_followup.yml` that runs tests and validates n8n workflow JSON when opened as PR
- If deploying n8n: store workflow JSON in `conductor/tracks/.../n8n/` and document manual import steps in plan

## Rollout checklist (quick)
1. Deploy handler in staging behind feature-flag
2. Send synthetic webhook events (integration script)
3. Validate follow-ups in queue
4. Gradual rollout to production
