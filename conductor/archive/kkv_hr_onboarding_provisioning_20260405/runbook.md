# KKV HR onboarding provisioning runbook

## Required configuration
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TO`
- `SLACK_WEBHOOK_URL` or `BRUNELLA_SLACK_WEBHOOK_URL`
- `GOOGLE_WORKSPACE_CREDENTIALS_FILE`
- `GOOGLE_WORKSPACE_TOKEN_FILE`

## Sandbox validation
1. `GET /api/v1/hr-onboarding/samples`
2. `POST /api/v1/hr-onboarding/dry-run` with a sample payload
3. Review `GET /api/v1/hr-onboarding/jobs?limit=5`
4. Or use the CLI:
   - `hr onboarding mintak`
   - `hr onboarding futtat --sample webhook-new-hire`
   - `hr onboarding allapot`

## Deployment notes
- This track is dry-run only; no live account creation is performed here.
- Keep CLI, API, and dashboard payload shapes aligned with `src/utils/hrOnboarding.ts`.
- Use the sample payloads as the regression baseline for onboarding mapping changes.
