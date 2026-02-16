# Implementation Plan: AI Recommendation System

**Track ID:** `ai_recommendation_system_20260216`  
**Priority:** `MEDIUM`  
**Status:** `pending_approval` → `planned`

---

## Phase 1: API + Tooling (Week 1)

- [ ] **Task 1.1:** `src/server/web.ts` – REST endpoint
- [ ] **Task 1.2:** `src/server/registry.ts` – MCP tool regisztráció
- [ ] **Task 1.3:** Request/response typizálás

**Acceptance Criteria:**
- POST endpoint működik
- Tool regisztráció sikeres

---

## Phase 2: RAG Logic (Week 2)

- [ ] **Task 2.1:** `src/utils/rag.ts` – kategória-alapú keresés
- [ ] **Task 2.2:** Orchestrator delegálási logika
- [ ] **Task 2.3:** Relevancia score + filtering

**Acceptance Criteria:**
- 80%+ releváns ajánlás manual auditban

---

## Phase 3: Frontend Integration (Week 3)

- [ ] **Task 3.1:** Fetch hívás a statikus JSON helyett
- [ ] **Task 3.2:** Loading state + fallback

**Acceptance Criteria:**
- Fallback működik 500-as hibánál

---

*Plan v1.0 | 2026-02-16*