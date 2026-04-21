### PR: feat(kkv-crm): CRM ingest skeleton — normalizeLead + tests

Branch: `kkv-crm/feature/ingest-skeleton`

Summary
-------
This PR provides a small, isolated addition to the CRM ingest pipeline:

- `tracks/kkv_crm_automation_20260404/src/transform.js` — `normalizeLead(raw)` helper (ESM export)
- `tracks/kkv_crm_automation_20260404/tests/transform.test.js` — unit tests (ESM)
- `tracks/kkv_crm_automation_20260404/implementation/README.md` — implementation notes

Why
---
Start the ingest pipeline with a deterministic canonicalization helper so downstream connectors (HubSpot, internal queue) receive normalized payloads. Keep the change intentionally small to make review focused and fast.

Testing
-------
Run locally:

```bash
# from repo root
npm run build: (optional) # repo build may be heavy
npx vitest run tracks/kkv_crm_automation_20260404/tests/transform.test.js --run
```

Notes for reviewers
-------------------
- Hook bypass is not allowed. If local hooks fail because of unrelated repo debt, fix or isolate that debt first and then push with normal verification intact.
- Focus your review on correctness of normalization rules (email lowercasing, phone numeric cleanup, created_at passthrough) and test coverage.

Checklist
---------
- [ ] CI passes (build + test + lint)
- [ ] Maintainers confirm unrelated global TypeScript issues are NOT caused by this PR
- [ ] Merge and follow-up with TASK‑CRM‑003..006 work
