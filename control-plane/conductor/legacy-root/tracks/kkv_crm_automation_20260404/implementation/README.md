# CRM Implementation - Skeleton

Purpose: quickstarter notes for TASK-CRM-002 (n8n ingest flow skeleton) and initial developer onboarding.

Prerequisites
- Node.js 18+
- n8n (local) or access to a sandbox n8n instance
- A local SQLite (optional) for temp persistence

Quickstart - n8n local
1. Start n8n (desktop or docker):
   - docker run -it --rm \
     -p 5678:5678 \
     -v ~/.n8n:/home/node/.n8n \
     n8nio/n8n:latest
2. Create a new workflow:
   - Trigger: Webhook (POST /webhook/crm/ingest)
   - Transform: Code node - validate payload & normalize
   - Persist: HTTP Request to `POST /api/v1/crm/intake`

Example webhook payload (POST /webhook/crm/ingest)
```json
{
  "source": "hubspot",
  "payload": {
    "email": "lead@example.com",
    "phone": "+36-30-123-4567",
    "company": "Contoso",
    "lead_source": "website_form",
    "created_at": "2026-04-04T10:34:00Z"
  }
}
```

Developer notes
- Keep the transform deterministic and easily testable.
- Add unit tests for the normalization helper under `test/` or `tracks/kkv_crm_automation_20260404/tests/`.
- The intake API persists to `data/crm.db` and dedupes by canonical email/phone/company/source hash.

Next actions
- Implement TASK-CRM-003: lead scoring + routing on top of the stored CRM lead records.
- The follow-up routing track (`kkv_crm_followup_routing_20260405`) will consume the same CRM store and add D+3 / D+7 / D+14 behavior.

How to run local transform test
1. From the repository root, run:
  npx vitest run test/crmLead.test.ts test/crmDb.test.ts
2. The suite validates normalization and dedupe key generation.
