# Implementation Plan: Real Estate Sales Campaign

**Track ID:** `real_estate_sales_campaign_20260216`  
**Priority:** `HIGH`  
**Status:** `ACTIVE` (Phase 1-3 ✅ Complete)  
**Progress:** 60%  
**Last Updated:** 2026-02-18  

---

## 📋 Overview

A **Real Estate Ingestion & Valuation System** + **Corporate Hunter & CRM Engine** teljes implementációja. Két párhuzamosan működő ügynök: az **Elemző** (Asset Analyst) és a **Vadász** (Corporate Hunter).

---

## 🎯 Fázisok & Mérföldkövek

### **Phase 1: Document Ingestion & Property Analysis** ✅
**Prioritás:** `CRITICAL`  
**Becsült idő:** 2 hét  
**Függőség:** Nincs  

- [x] **Task 1.1:** `myai/core/vision_worker.py` – Gemini Vision illesztés OCR-hez ✅
- [x] **Task 1.2:** `src/agents/PropertyAnalystAgent.ts` – Property intelligence ügynök ✅
- [x] **Task 1.3:** `src/types/property.ts` – PropertyAsset TypeScript interfészek ✅
- [x] **Task 1.4:** LanceDB schema: property_valuations table ✅
- [x] **Task 1.5:** Testing: 10+ property szenárió ✅

**Acceptance Criteria:** ✅
- PDF/JPG fájlok feldolgozása működik
- HRSZ, méret, közművek kinyerése pontos
- Valuation confidence score >0.85
- `npm test` pass

---

### **Phase 2: Market Research & Comparable Analysis** ✅
**Prioritás:** `HIGH`  
**Becsült idő:** 2 hét  
**Függőség:** Phase 1  

- [x] **Task 2.1:** `myai/workers/cma_worker.py` – CMA (Comparative Market Analysis) ✅
- [x] **Task 2.2:** Integration with `PropertyAnalystAgent` ✅
- [x] **Task 2.3:** Price estimation algoritmus ✅
- [x] **Task 2.4:** Mock mode for testing ✅
- [x] **Task 2.5:** Integration tests ✅

**Acceptance Criteria:** ✅
- CMA report generálása JSON-ben
- Price estimation range ±10%
- CLI: `--mock` mode
- TypeScript agent integration

---

### **Phase 3: Campaign Generation & Nurturing** ✅
**Prioritás:** `HIGH`  
**Becsült idő:** 1.5 hét  
**Függőség:** Phase 1, 2  

- [x] **Task 3.1:** `src/agents/NurturerAgent.ts` – Marketing campaign generator ✅
- [x] **Task 3.2:** BaseAgent architecture integration ✅
- [x] **Task 3.3:** LLM-based copywriting (mocked for tests) ✅
- [x] **Task 3.4:** Integration tests (`test/phase3_integration.test.ts`) ✅
- [x] **Task 3.5:** Agent registry update ✅

**Acceptance Criteria:** ✅
- Campaign content generation from property analysis
- Hungarian language support
- Mock mode to avoid LLM quota issues
- Integration test passing (1/1)

---

### **Phase 4: Corporate Hunter & Lead Targeting**
**Prioritás:** `HIGH`  
**Becsült idő:** 2.5 hét  
**Függőség:** Phase 1, 2, 3  

- [ ] **Task 4.1:** `myai/tasks/corporate_hunter.py` – LinkedIn/cégjegyzék scraper
- [ ] **Task 4.2:** `src/agents/MarketingAgent.ts` – Teaser email generator
- [ ] **Task 4.3:** `src/utils/db.ts` – Lead CRM table
- [ ] **Task 4.4:** Decision maker enrichment (LinkedIn API)
- [ ] **Task 4.5:** Human-in-the-Loop approval workflow

**Acceptance Criteria:**
- 50+ target company azonosítása
- Decision maker kigyűjtése
- Teaser email draft magyar/angol/német
- CRM tábla feltöltve

---

### **Phase 5: CRM & Interaction Tracking**
**Prioritás:** `MEDIUM`  
**Becsült idő:** 1.5 hét  
**Függőség:** Phase 4  

- [ ] **Task 5.1:** `src/agents/CRMAgent.ts` – Lead lifecycle management
- [ ] **Task 5.2:** Google Sheets ↔ SQLite sync
- [ ] **Task 5.3:** Email tracking (draft view, reply detection)
- [ ] **Task 5.4:** Automated follow-up scheduling

**Acceptance Criteria:**
- Lead státusz szinkronizálódik
- E-mail draft mentés működik
- Follow-up emlékeztetők működnek

---

## 🔍 Critical Constraints & Rules

| Szabály | Leírás | Felelős |
|---------|--------|---------|
| **GDPR Compliance** | Személyes adatok (név, email) nem logolódnak | Security |
| **Type Safety** | PropertyAsset minden mezője typizált | Developer |
| **Google API Quota** | Batch writes, nem individual row updates | Google API Manager |
| **Hallucináció Prevention** | Fake email címekre NEM küldünk | QA |
| **Source Attribution** | Minden ár/piaci adat forrás URL-t tartalmaz | Auditor |

---

## 🚀 Key Features

### Elemző (Asset Analyst)
```
Fájl Upload → OCR/Gemini Vision → PropertyAsset → Valuation → Sheets
```

### Vadász (Corporate Hunter)
```
Location Filter → LinkedIn Search → CEO/Director Identify → Teaser Draft → CRM
```

---

## 📅 Timeline & Milestones

| Mérföldkő | Céldátum | Status |
|-----------|----------|--------|
| Asset ingestion ready | 2026-02-28 | 🟡 Terv |
| CMA report pipeline | 2026-03-07 | 🟡 Terv |
| Sales plan automation | 2026-03-14 | 🟡 Terv |
| Corporate hunter ready | 2026-03-28 | 🟡 Terv |
| CRM integration done | 2026-04-04 | 🟡 Terv |
| **Éles bevetés** | 2026-04-15 | 🔴 TODO |

---

## ✅ Acceptance Criteria (Globális)

- [ ] Teljes dokumentum-feldolgozás (10+ fájl teszt)
- [ ] Valuation accuracy >85%
- [ ] 50+ target company gefunden
- [ ] Email draft security audit pass
- [ ] `npm test` 100% pass

---

*Dokumentáció: 2026-02-16 | Verzió: 1.0*
