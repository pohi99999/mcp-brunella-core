# Implementation Plan: Marketing Swarm

**Track ID:** `marketing_swarm_20260216`  
**Priority:** `HIGH`  
**Status:** `pending_approval` → `planned`

---

## 🎯 Phase 1: Core Swarm Orchestration (Week 1)

- [x] **Task 1.1:** `myai/agents/CopywriterAgent.toml` létrehozása ✅ (2026-02-16)
- [x] **Task 1.2:** `myai/agents/MarketingDirectorAgent.toml` létrehozása ✅ (2026-02-16)
- [x] **Task 1.3:** DynamicAgent framework integrálás (TOML-based) ✅ (2026-02-16)
- [x] **Task 1.4:** Agent regisztráció (`src/agents/registry.json`) ✅ (2026-02-16)
- [x] **Task 1.5:** Dashboard + CLI integráció ✅ (2026-02-16)
- [x] **Task 1.6:** Accessibility audit & fixes ✅ (2026-02-16)

**Acceptance Criteria:**
- ✅ MarketingDirector & Copywriter API-n elérhető
- ✅ Dashboard-on látszanak az ügynökök
- ✅ CLI-ben regisztráltak
- ✅ Accessibility legalább WCAG 2.1 AA
- ✅ Build: 0 errors, 0 warnings

---

## 🎯 Phase 2: Trend Analyst (Week 2)

- [x] **Task 2.1:** `myai/workers/trend_analyst.py` implementálás ✅ (2026-02-16)
- [x] **Task 2.2:** JSON validáció (Pydantic model) ✅ (2026-02-16)
- [x] **Task 2.3:** Timeout és retry logika ✅ (2026-02-16)

**Acceptance Criteria:**
- ✅ Trend report JSON valid (Pydantic TrendAnalysisReport)
- ✅ 3 perces timeout alatt teljesül
- ✅ Fallback mock trendek ha Ollama nem elérhető

---

## 🎯 Phase 3: Media Factory & Assembly (Week 3)

- [x] **Task 3.1:** `myai/workers/media_factory.py` (Draft Mode) ✅ (2026-02-16)
- [x] **Task 3.2:** `_KNOWLEDGE_BASE/campaigns` mentési pipeline ✅ (2026-02-16)
- [x] **Task 3.3:** Summary markdown generálás ✅ (2026-02-16)

**Acceptance Criteria:**
- ✅ Media assetek helyesen mentve (`_KNOWLEDGE_BASE/campaigns/<slug>/<id>/`)
- ✅ Summary markdown létrejön (SUMMARY.md)
- ✅ JSON campaign.json + platform-specifikus .txt fájlok

---

## 🧪 Testing & Validation

- [x] **Unit: trend_analyst.py** – 41 teszt, 100% PASS ✅ (2026-02-17)
  - Pydantic validáció (TrendItem, Request, Report)
  - Mock mód (fallback engine)
  - Ollama fallback (connection error → statikus trendek)
  - FALLBACK_TRENDS konstans validáció
  - CLI belépési pont (stdin + args, markdown, limit)
  - `myai/tests/test_trend_analyst.py`

- [x] **Unit: media_factory.py** – 49 teszt, 100% PASS ✅ (2026-02-17)
  - Pydantic modellek (TrendItemInput, MediaAsset, CampaignPackage, Request)
  - Segédfüggvények (_slugify, _generate_campaign_id, _generate_placeholder_asset)
  - produce_campaign() mock módban
  - Mentési pipeline (campaign.json, SUMMARY.md, platform .txt)
  - Summary markdown generálás
  - CLI belépési pont (stdin + args)
  - `myai/tests/test_media_factory.py`

- [x] **Integration: Teljes pipeline** – 8 teszt, 100% PASS ✅ (2026-02-17)
  - E2E: trend_analyst → media_factory → fájlrendszer
  - JSON round-trip
  - Summary tartalom ellenőrzés
  - Több termék izolálva (nem keverednek)
  - Score sorrend megőrzés
  - Edge cases (üres trendlista, 1 platform, speciális karakterek)
  - `test/marketing_swarm_integration_test.py`

**🎉 Összesen: 98 teszt, 98 PASSED, 0 FAILED**

---

*Plan v1.1 | 2026-02-17 – Testing Phase COMPLETE*