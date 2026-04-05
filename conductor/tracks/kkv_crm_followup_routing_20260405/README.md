KKV CRM Followup Routing — quick n8n import & smoke test
=================================

This folder contains an importable n8n workflow (n8n JSON), a sample webhook payload, and a smoke-test script to validate the workflow locally.

Files added:
- `n8n/kkv-followup-routing.json` — n8n workflow export (Webhook -> verify(optional) -> idempotency placeholder -> HTTP call to orchestrator).
- `tests/sample_payload.json` — sample webhook payload for smoke tests.
- `tests/smoke_send_sample_webhook.ps1` — PowerShell script that POSTs the sample payload to local n8n webhook.

Quick steps to validate locally
-------------------------------

1) Start n8n locally (Docker):

```powershell
# Pull & run n8n (exposes UI on http://localhost:5678)
docker run -it --rm -p 5678:5678 -e N8N_BASIC_AUTH_ACTIVE=false n8nio/n8n:latest
```

2) Import the workflow in the n8n UI:
   - Open http://localhost:5678
   - Click the menu (top-right) → Import → choose the `n8n/kkv-followup-routing.json` file
   - After import, activate the workflow or leave it inactive and test.

3) (Optional) Set environment variables in the n8n runtime if you want signature verification or a different orchestrator:
   - `WEBHOOK_SECRET` — HMAC secret used by the optional verify step
   - `ORCHESTRATOR_URL` — where the workflow will POST followup jobs (default: http://localhost:3000/api/v1/followups)

4) Run the smoke test (PowerShell) from the repo root:

```powershell
cd .\conductor\tracks\kkv_crm_followup_routing_20260405\tests
pwsh .\smoke_send_sample_webhook.ps1
```

If n8n is running and the workflow is imported, you should see the request arrive in n8n and the smoke script print the response from the `Call Orchestrator` node (or an HTTP error if the orchestrator URL is unreachable).

Notes
-----
- The `Verify Signature` node is permissive for smoke tests: if `WEBHOOK_SECRET` is not set, the workflow accepts the request. In production, set `WEBHOOK_SECRET` and ensure the client sends `x-crm-signature` header.
- The `Idempotency Check` node is a placeholder in this quick import; implement Redis/DB-based dedupe for production.

Next steps I can take for you:
- Commit these files and open a PR with the followup-routing scaffold.
- Implement an Express route scaffold + unit tests instead of n8n (if you prefer the internal orchestrator path).
