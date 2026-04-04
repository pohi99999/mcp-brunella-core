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
   - Transform: Function node - validate payload & normalize
   - Persist: HTTP Request to local microservice or write to temp file

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
- Add unit tests for the Function node logic (extract/normalize fields) - store tests under `tracks/kkv_crm_automation_20260404/tests/`.
- First PR should add the n8n workflow export (JSON) and a lightweight node script that can run the same transform locally for CI.

Next actions
- Implement TASK-CRM-002: export n8n skeleton JSON + local transform script.
- Implement TASK-CRM-001 in parallel: provision OAuth client in CRM sandbox and store creds in `credentials/` (encrypted in secrets store, not in repo).
