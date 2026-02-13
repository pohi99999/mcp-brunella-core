# Specifikáció: Jules Async Test Automation (GitHub Actions)

**Track ID:** `jules-async-test-automation-20260211`
**Spec státusz:** `pending_approval`
**Dátum:** 2026-02-12
**Owner:** Claude

## 1. Cél

Hosszú futású / költséges tesztsuite-ok automatizált futtatása GitHub Actions-ben **ütemezve** és **párhuzamosítva**, Jules (vagy hasonló) AI által támogatott hibaelemzéssel és riportolással.

EPP v2 kompatibilitás:

- Dashboard widget (legutóbbi futások)
- CLI (magyar) parancsok

## 2. Scope

### In-scope (Iteration 1)

- GitHub Actions workflow:
  - Ütemezés: 4 óránként (cron)
  - Matrix: több teszt suite (kezdetben kevesebb, bővíthető)
  - `workflow_dispatch` manuális indítás
- Dashboard:
  - Widget a legutóbbi workflow futások listázására (pass/fail, duration)
- CLI (magyar):
  - legutóbbi futások listázása
  - “trigger” (workflow_dispatch) indítás

### Out-of-scope (későbbi iteráció)

- Automatikus PR készítés javítható hibákhoz (GitHub App / PAT jogosultság tisztázása kell)
- Issue creation manuális hibákhoz (policy / label taxonomy)
- 15 párhuzamos szál azonnal (először stabil baseline)

## 3. Workflow terv

Fájlok:

- `.github/workflows/jules-async-tests.yml`
- (később) `.github/workflows/jules-test-coordinator.yml`

Baseline matrix javaslat (Iteration 1):

- `unit_fast`: `npm test`
- `dashboard`: `npm run test:dashboard`
- `e2e`: `npm run test:e2e` (opcionális, mert Playwright környezet)

Idővel bővíthető 15 suite-ra.

## 4. Titkok / jogosultságok

- Iteration 1-ben **nem kötelező** Jules API key.
- Trigger / listázás GitHub API-n keresztül:
  - preferált: `GITHUB_TOKEN` (Actions-ben alapból van, repo policy függ)

## 5. Dashboard követelmények

- Új komponens: `src/dashboard/components/dashboard/JulesTestStatus.tsx` (vagy meglévő JulesPanel bővítés)
- API hívások:
  - `GET /api/v1/jules/workflow-runs?workflow=...&limit=...`
  - `POST /api/v1/jules/dispatch` (workflow_dispatch)

## 6. CLI követelmények (magyar)

- Menüpont a meglévő menürendszerben (Interactive/CLI):
  - “Legutóbbi teszt eredmények”
  - “Tesztek futtatása (trigger)”

Megjegyzés: a repo-ban már létezik Jules CLI útvonal, ezt újrahasznosítjuk.

## 7. Tesztelés

- Unit teszt: backend route validáció (missing params → 400)
- Mockolt GitHub API válaszokkal a dashboard/CLI működés ellenőrzése

## 8. Approval checklist

- [x] Workflow baseline elfogadva - 15 test suite ✅
- [x] GitHub API jogosultság rendben (GITHUB_TOKEN) ✅
- [x] Dashboard + CLI minimál UX megfelel ✅
- [x] Trend chart + CLI trend analysis DONE ✅
- [x] jules-test-coordinator.yml (napi összesítő) DONE ✅

**Jóváhagyva:** 2026-02-13 01:45
**Iteration 1 állapot:** COMPLETE (15 suites + coordinator + dashboard charts + CLI trends)
