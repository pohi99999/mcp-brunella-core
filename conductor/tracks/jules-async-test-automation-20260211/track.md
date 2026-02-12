# Track: Jules Async Test Automation (GitHub Actions)

**Status:** PROPOSED
**Priority:** P1
**Complexity:** MEDIUM
**Created:** 2026-02-11
**Owner:** Claude

## 🎯 Cél

Jules AI automatikus tesztelés időigényes teszt suite-okhoz. 15 párhuzamos szál, 4 óránként futás (napi 90 teszt ciklus), automatikus PR/Issue készítés hibákhoz.

## ✅ Acceptance Criteria

1. GitHub Actions workflow (15 párhuzamos szál)
2. Test suite matrix (integration, e2e, performance, security)
3. Automatikus PR készítés javítható hibákhoz
4. Issue tracking manuális hibákhoz
5. Napi összesítő report (Test Coordinator)
6. **Dashboard:** Test results widget (latest runs)
7. **CLI:** Test status lekérdezés (magyar)

## 🔧 Technikai Követelmények

### GitHub Actions: .github/workflows/jules-async-tests.yml
```yaml
strategy:
  matrix:
    test_suite: [integration_ollama, e2e_full, performance_stress, ...]
  max-parallel: 15

schedule:
  - cron: '0 */4 * * *'  # 4 óránként
```

### Dashboard: src/dashboard/components/JulesTestStatus.tsx
- Latest test runs table
- Pass/Fail badge
- Duration chart (trend)
- "Trigger Tests" button
- WebSocket live updates

### CLI: src/cli-commands/tests-hu.ts
```
1. 🧪 Legutóbbi teszt eredmények
2. 🚀 Tesztek futtatása (trigger GitHub Action)
3. 📊 Teszt trendek
4. 🔙 Vissza
```

## 📋 Implementation Plan

### Phase 1: GitHub Actions Workflows
- [ ] jules-async-tests.yml létrehozás
- [ ] Test matrix konfigurálás (15 suite)
- [ ] Jules API key secret setup
- [ ] Test prompt írás (analyze, fix, report)
- [ ] jules-test-coordinator.yml (napi összesítő)

### Phase 2: Dashboard Widget
- [ ] JulesTestStatus.tsx komponens
- [ ] GitHub API integráció (workflow runs fetch)
- [ ] Table + Chart komponensek
- [ ] "Trigger Tests" button (workflow_dispatch)
- [ ] Dashboard integráció

### Phase 3: CLI Commands
- [ ] tests-hu.ts létrehozás
- [ ] GitHub API calls (latest runs)
- [ ] Trend analysis display
- [ ] Trigger command (workflow_dispatch)
- [ ] CLI regisztráció

### Phase 4: Testing & Docs
- [ ] Workflow trigger test
- [ ] Dashboard widget test
- [ ] CLI test
- [ ] README.md frissítés
- [ ] GitHub commit

## 📝 Implementation Prompt

```
Jules AI GitHub Actions tesztautomatizálás:

Workflow:
- 15 párhuzamos test suite
- 4 óránként trigger
- Automatikus PR/Issue creation
- Napi coordinator report

Dashboard:
- JulesTestStatus.tsx widget
- Latest runs table
- Pass/Fail badges
- Trigger button

CLI:
- Magyar teszt status parancsok
- GitHub API integration
- Trend display
```

---

## 📝 Napló

### 2026-02-12

- Spec-first: `spec.md` létrehozva, `meta.json` → `spec_status: pending_approval`.
