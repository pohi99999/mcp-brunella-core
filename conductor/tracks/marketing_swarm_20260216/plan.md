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

- [ ] **Task 2.1:** `myai/workers/trend_analyst.py` implementálás
- [ ] **Task 2.2:** JSON validáció (Pydantic model)
- [ ] **Task 2.3:** Timeout és retry logika

**Acceptance Criteria:**
- Trend report JSON valid
- 3 perces timeout alatt teljesül

---

## 🎯 Phase 3: Media Factory & Assembly (Week 3)

- [ ] **Task 3.1:** `myai/workers/media_factory.py` (Draft Mode)
- [ ] **Task 3.2:** `_KNOWLEDGE_BASE/campaigns` mentési pipeline
- [ ] **Task 3.3:** Summary markdown generálás

**Acceptance Criteria:**
- Media assetek helyesen mentve
- Summary markdown létrejön

---

## 🧪 Testing & Validation

- [ ] Unit: MarketingDirector/Copywriter
- [ ] Integration: Trend analyst + copywriter + assembly
- [ ] E2E: Kampánycsomag létrehozás 1 termékre

---

*Plan v1.0 | 2026-02-16*