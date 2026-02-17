# Invoice Automation E2E Testing & Validation

**Track ID:** `invoice-e2e-testing-20260217`  
**Status:** PROPOSED  
**Priority:** MEDIUM  
**Created:** 2026-02-17  

---

## 🎯 Célja

A Phase 1-5 végigvitt számlakezelő pipeline end-to-end (E2E) tesztelésének és validációjának automatizálása.

Előfeltétel: 
- **invoice-to-sheets-automation-20260214** COMPLETED ✅

---

## 📋 Fázisok

### Phase 1: E2E Test Infrastructure Setup
- Pytest E2E test marker regisztráció (`pytest.mark.e2e`)
- Test fixtures létrehozása: Számlázz.hu mock, Google Sheets mock
- Test dataset előkészítése (sample invoices, edge cases)
- Error handling test cases

### Phase 2: End-to-End Pipeline Testing
- **Test Chain 1:** Számlázz.hu API → InvoiceData validation → LanceDB indexing
- **Test Chain 2:** Gmail fallback harvesting (if API down)
- **Test Chain 3:** Refiner pipeline (validation + normalization + embedding)
- **Test Chain 4:** Google Sheets write + duplicate detection
- **Integration End-to-End:** Full harvest → refine → index → export cycle

### Phase 3: Performance & Load Testing
- Load test: 1000+ invoices batch write performance
- Latency profiling: API response times
- Memory usage monitoring (LanceDB, threading)
- Concurrency testing (parallel batch writes)

### Phase 4: Environment Setup & Documentation
- `.env.example` finalize with all required vars
- Test execution guide (how to run locally vs CI)
- Expected output documentation
- Error scenarios guide

### Phase 5: CI/CD Integration
- GitHub Actions workflow for E2E tests (scheduled, optional)
- Test report generation
- Failure notifications
- Track completion & archive

---

## 🧪 Test Scenarios

| Phase | Scenario | Expected Result |
|-------|----------|-----------------|
| 1 | Valid invoice from Számlázz.hu | ✅ Indexed in LanceDB, row added to Sheets |
| 1 | Invalid invoice (missing required field) | ❌ Skipped with error log |
| 2 | Számlázz.hu API down, Gmail fallback | ✅ PDFs downloaded, metadata logged |
| 2 | Both Számlázz.hu & Gmail unavailable | ❌ Error reported, no data loss |
| 3 | Duplicate invoice (same invoice_no) | ⏭️ Skipped (duplicate detection) |
| 3 | Large batch (500+ invoices) | ✅ Batch write in 50-100 row chunks |
| 4 | Network timeout during write | 🔄 Phoenix Protocol retry (5 attempts) |
| 4 | Sheets API rate limit | ⏳ Exponential backoff, resume on success |

---

## 📁 Files to Create/Modify

- **test/invoice_automation_e2e_test.py** ✅ CREATED (Phase 0 work)
  - Main E2E smoke test
  - Skip logic for missing env vars
  - Happy path: get invoices → refine → write sheets

- **test/invoice_e2e_performance.test.ts** (Phase 3)
  - Load testing for batch writes
  - Profiling helpers

- **docs/INVOICE_E2E_GUIDE.md** (Phase 4)
  - How to run E2E tests locally
  - CI/CD setup instructions
  - Expected env vars list

- **.github/workflows/invoice-e2e-tests.yml** (Phase 5)
  - Scheduled E2E test run (weekly?)
  - Only runs if creds available
  - Reports to console + email

---

## 🎬 Timeline

- **Phase 1:** 1-2 days (test infrastructure)
- **Phase 2:** 2-3 days (pipeline testing)
- **Phase 3:** 1-2 days (performance + load)
- **Phase 4:** 1 day (docs + setup)
- **Phase 5:** 1 day (CI/CD integration)

**Total:** ~1 week

---

## ✅ Definition of Done

- [ ] Phase 1: Test infrastructure ready, all fixtures in place
- [ ] Phase 2: All 6+ test chains passing (with real/mock data)
- [ ] Phase 3: Performance baseline established, no regressions
- [ ] Phase 4: Full documentation + env example finalized
- [ ] Phase 5: CI/CD workflow deployed, runs monthly
- [ ] npm test: 100% pass
- [ ] Track archived + summarized

---

## 🔗 Dependencies

- Completed: **invoice-to-sheets-automation-20260214** ✅
- Upcoming: None (standalone validation track)

---

## 📝 Notes

- E2E tests should be **optional** for local dev (skip if no credentials)
- CI/CD can run with mocked Számlázz.hu + GCS (don't expose real creds)
- Performance baseline should be documented for future regression detection
