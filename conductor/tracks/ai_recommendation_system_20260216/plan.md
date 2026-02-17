# Implementation Plan: AI Recommendation System

**Track ID:** `ai_recommendation_system_20260216`  
**Priority:** `MEDIUM`  
**Status:** `pending_approval` → `planned`

---

## Phase 1: API + Tooling (Week 1)

- [x] **Task 1.1:** `src/server/routes/recommendation.ts` – REST endpoint ✅ (2026-02-16)
- [x] **Task 1.2:** `src/tools/getAiRecommendation.ts` + `registry.ts` – MCP tool regisztráció ✅ (2026-02-16)
- [x] **Task 1.3:** Request/response typizálás (RecommendationRequest/Response) ✅ (2026-02-16)

**Acceptance Criteria:**
- ✅ POST /api/v1/brunella/recommend endpoint működik
- ✅ GET /api/v1/brunella/recommend/health health check
- ✅ MCP tool: `get_ai_recommendation` regisztrálva
- ✅ Fallback statikus ajánlások ha RAG nem elérhető

---

## Phase 2: RAG Logic (Week 2)

- [x] **Task 2.1:** `src/utils/rag.ts` – HybridMemory.search() integráció ✅ (2026-02-16)
- [x] **Task 2.2:** 30s timeout védelem + graceful fallback ✅ (2026-02-16)
- [x] **Task 2.3:** Relevancia score visszadás RAG resultból ✅ (2026-02-16)

**Acceptance Criteria:**
- ✅ RAG keresés működik Ollama embedding nélkül is (text fallback)
- ✅ Timeout esetén 4 statikus fallback ajánlás

---

## Phase 3: Frontend Integration (Week 3)

- [ ] **Task 3.1:** Dashboard UI fetch hívás a statikus JSON helyett
- [ ] **Task 3.2:** Loading state + felbukkanó kártya nézet

**Acceptance Criteria:**
- Fallback működik 500-as hibánál

---

*Plan v1.0 | 2026-02-16*