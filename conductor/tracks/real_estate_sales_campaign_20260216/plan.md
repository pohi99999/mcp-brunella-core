# Implementation Plan: Real Estate Sales Campaign

**Track ID:** `real_estate_sales_campaign_20260216`  
**Priority:** `HIGH`  
**Status:** `pending_approval` → `planned`  

---

## 📋 Overview

A **Real Estate Ingestion & Valuation System** + **Corporate Hunter & CRM Engine** teljes implementációja. Két párhuzamosan működő ügynök: az **Elemző** (Asset Analyst) és a **Vadász** (Corporate Hunter).

---

## 🎯 Fázisok & Mérföldkövek

### **Phase 1: Document Ingestion & Property Analysis**
**Prioritás:** `CRITICAL`  
**Becsült idő:** 2 hét  
**Függőség:** Nincs  

- [ ] **Task 1.1:** `myai/core/vision_worker.py` – Gemini Vision illesztés OCR-hez
- [ ] **Task 1.2:** `src/agents/PropertyAnalystAgent.ts` – Property intelligence ügynök
- [ ] **Task 1.3:** `src/types/property.ts` – PropertyAsset TypeScript interfészek
- [ ] **Task 1.4:** LanceDB schema: property_valuations table
- [ ] **Task 1.5:** Testing: 10+ property szenárió

**Acceptance Criteria:**
- PDF/JPG fájlok feldolgozása működik
- HRSZ, méret, közművek kinyerése pontos
- Valuation confidence score >0.85
- `npm test` pass

---

### **Phase 2: Market Research & Comparable Analysis**
**Prioritás:** `HIGH`  
**Becsült idő:** 2 hét  
**Függőség:** Phase 1  

- [ ] **Task 2.1:** `src/agents/ResearcherAgent.ts` bővítés – Real estate scraper
- [ ] **Task 2.2:** `myai/refiner_logic.py` – CMA (Comparative Market Analysis)
- [ ] **Task 2.3:** `src/utils/rag.ts` – Property market intelligence index
- [ ] **Task 2.4:** Price estimation algoritmus
- [ ] **Task 2.5:** End-to-end flow teszt

**Acceptance Criteria:**
- Comparable properties gyűjtése 40+ oldal
- CMA report generálása JSON-ben
- Price joking range ±10%
- Market trends LanceDB-be mentve

---

### **Phase 3: Sales Action Plan Generation**
**Prioritás:** `HIGH`  
**Becsült idő:** 1.5 hét  
**Függőség:** Phase 1, 2  

- [ ] **Task 3.1:** `src/tools/googleWorkspace.ts` – Sheets template engine
- [ ] **Task 3.2:** `src/agents/SpecWriterAgent.ts` – Sales roadmap generator
- [ ] **Task 3.3:** Google Sheet "Sales_Action_Plan_YYYY" template
- [ ] **Task 3.4:** Batch operation handling

**Acceptance Criteria:**
- Sales roadmap generálódik Sheets-be
- Teendőlista időütemezéssel
- Felelősök kiosztva

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
