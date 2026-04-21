CI Triage Checklist — kkv-crm/feature/ingest-skeleton

Purpose
-------
Quick steps to triage CI failures for this PR. Aim to identify whether failures are related to this small change (transform + tests) or are unrelated repository-wide build issues.

1) Collect CI artifacts & logs
   - Download failing job logs and test artifacts from the CI run.
   - Save the console log and the failing test stack traces.

2) Reproduce locally (minimum commands)

```bash
# run the exact commands CI runs (example):
npm ci
npm run build
npm run test:fast
# or the focused test:
npx vitest run tracks/kkv_crm_automation_20260404/tests/transform.test.js --run
```

3) Quick checks for common repo failures
   - TypeScript compile errors in `src/` (run `npx tsc --noEmit`) — if failures appear, note file/line and error text.
   - Native binding issues: `better-sqlite3` ABI mismatch → `npm rebuild better-sqlite3` and re-run build.
   - Missing secrets / env: MANIFEST_SIGNING_SECRET (must be provided on CI), GITHUB_PAT vs GH_TOKEN, OLLAMA_BASE_URL.
   - buildHealthResponse parameter error (wrong arg count) — ensure mocks match 10 args.

4) Focused PR-level tests
   - If the failing tests are within `tracks/kkv_crm_automation_20260404`, run them locally and inspect failures.
   - If failures are unrelated (server TypeScript), open a maintenance issue/PR to fix the global build separately.

5) Short-term remedies
   - If unrelated infra flakiness (e.g., external LLM not reachable), mark those CI jobs as flaky and re-run the CI.
   - If TypeScript errors are caused by the PR, push a fix to the PR branch.
   - If errors are unrelated and block merges, create a dedicated maintenance PR referencing the failure and assign to core maintainers.

6) Communication
   - In the PR thread, state: "Branch kept under normal hook verification. If CI still fails with unrelated errors, please raise a maintenance PR referencing <CI job id> and block merge until it is resolved."
   - Tag `@pohi99999` (repo owner) in the PR for urgent build-fix assistance.

7) Post-triage
   - If CI passes: merge and continue TASK‑CRM‑003..006.
   - If CI fails for unrelated reasons: open maintenance PR and block merging until resolved (or request an exception with CI logs).
