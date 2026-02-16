# Implementation Plan: Enterprise Suite Master Track

**Track ID:** `enterprise_suite_master_20260216`  
**Priority:** CRITICAL  
**Status:** `pending_approval` → `planned`  

---

## 📋 Overview

A **14 modulos vállalati irányító szoftver** teljes implementációja, amely lefedi a HR, Pénzügy, Értékesítés, Logisztika és Piaci Hírszerzés területeit.

---

## 🎯 Fázisok & Mérföldkövek

### **Phase 1: Az "Agy" és a "Kéz" megerősítése (Infrastructure)**
**Prioritás:** `CRITICAL`  
**Becsült idő:** 2 hét  
**Függőség:** Nincs  

- [ ] **Task 1.1:** `src/agents/EnterpriseOrchestrator.ts` – Az alap Orchestrator felkészítése a 14 modul felismerésére
- [ ] **Task 1.2:** `myai/refiners/factory.py` – Dinamikus Pydantic gyár a modulokat különböző sémákkal kezelő
- [ ] **Task 1.3:** `src/tools/unified_workspace_tool.ts` – Google eszközök integrálása
- [ ] **Task 1.4:** Testing & Documentation

**Acceptance Criteria:**
- `EnterpriseOrchestrator` képes a 14 modul felismerésére
- Pydantic factory dinamikusan váltogatja a sémákat
- Google API integrálása működik
- `npm test` 100% pass

---

### **Phase 2: "Profit & Sales" Modulok (Közvetlen bevétel)**
**Prioritás:** `HIGH`  
**Becsült idő:** 3 hét  
**Függőség:** Phase 1  

- [ ] **Task 2.1:** `src/agents/SalesAgent.ts` – Automata Értékesítő Gép (LinkedIn/Maps lead gen)
- [ ] **Task 2.2:** `src/agents/PricingAgent.ts` – Dinamikus Árazó & Piaci Hírszerző
- [ ] **Task 2.3:** LanceDB integráció trend-tároláshoz
- [ ] **Task 2.4:** E2E Sales Pipeline tesztelése

**Acceptance Criteria:**
- Lead generálás működik LinkedIn-en
- Piaci árak gyűjtődnek LanceDB-be
- Piszkozat-levelek generálódnak
- Email draft mentés működik

---

### **Phase 3: "Admin & Finance" Modulok (Belső hatékonyság)**
**Prioritás:** `HIGH`  
**Becsült idő:** 3 hét  
**Függőség:** Phase 1  

- [ ] **Task 3.1:** `src/agents/FinanceGuardian.ts` – Pénzügyi Őrszem (számla PDF feldolgozás)
- [ ] **Task 3.2:** `src/agents/DigitalOfficeManager.ts` – Digitális Irodavezető (e-mail triázs)
- [ ] **Task 3.3:** `src/agents/GrantHunter.ts` – Pályázatfigyelő
- [ ] **Task 3.4:** Sheets export pipeline

**Acceptance Criteria:**
- PDF számlák feldolgozása működik
- E-mail szűrés szabászható
- Grant eligibility checker működik
- Sheets export automata

---

### **Phase 4: "HR & Soft Skills" Modulok (Humán tőke)**
**Prioritás:** `MEDIUM`  
**Becsült idő:** 3 hét  
**Függőség:** Phase 1  

- [ ] **Task 4.1:** `src/agents/HeadHunterAgent.ts` – Digitális Fejvadász (CV szűrés)
- [ ] **Task 4.2:** `src/agents/ConflictMediatorAgent.ts` – Kreatív Súrlódás Mediátor
- [ ] **Task 4.3:** `src/agents/LocalCSRBot.ts` – Mikro-Helyi CSR Automata
- [ ] **Task 4.4:** Hangulatelemzés modul (Sentiment Analysis)

**Acceptance Criteria:**
- CV feldolgozás működik
- Interjúkérdések generálódnak
- Email hangulatelemzés működik
- Geo-fenced hírek gyűjtődnek

---

### **Phase 5: "Logistics & Wiki" Modulok (Rendszerszintű tudás)**
**Prioritás:** `MEDIUM`  
**Becsült idő:** 2 hét  
**Függőség:** Phase 1, 2, 3  

- [ ] **Task 5.1:** `src/agents/LogisticsDispatcher.ts` – Logisztikai Diszpécser
- [ ] **Task 5.2:** `src/agents/KnowledgeBuilder.ts` – Intelligens Tudástár-építő
- [ ] **Task 5.3:** Proaktív reklamáció modul
- [ ] **Task 5.4:** Projekt indexelés RAG-be

**Acceptance Criteria:**
- Tracking ID kinyerés működik
- Proaktív értesítések jönnek
- ARCHIVED projektek automatikusan indexelődnek
- RAG keresés működik

---

## 🔍 Critical Constraints & Rules

| Szabály | Leírás | Felelős |
|---------|--------|---------|
| **Type Safety** | Tilos `any` az `EnterpriseEvent` payloadban | Developer |
| **Concurrency** | LanceDB írásánál retry logika | DataScientist |
| **Data Isolation** | HR/Pénzügyi adatok csak `_br_temp`-ben | Security Review |
| **Error Handling** | Minden modul try/finally logikát követel | Code Review |
| **Testing** | Minden modul >80% code coverage | Evaluator |

---

## 📊 Resource Allocation

| Ügynök | Szakmai Terület | Fázis(ok) |
|--------|-----------------|----------|
| **DeveloperAgent** | Backend implementation | 1-5 |
| **ArchitectAgent** | System design validation | 1 |
| **ResearcherAgent** | Market intelligence (Phase 2) | 2 |
| **DataScientistAgent** | LanceDB optimization | 2, 5 |
| **EvaluatorAgent** | Testing & QA | 1-5 |

---

## 📅 Timeline & Milestones

| Mérföldkő | Céldátum | Status |
|-----------|----------|--------|
| Phase 1 kész | 2026-03-01 | 🟡 Terv |
| Phase 2 kész | 2026-03-21 | 🟡 Terv |
| Phase 3-4 párhuzam start | 2026-03-01 | 🟡 Terv |
| Phase 5 kész | 2026-04-04 | 🟡 Terv |
| **Éles bevetés (Profit-fokú)** | 2026-04-15 | 🔴 TODO |

---

## ✅ Acceptance Criteria (Globális)

- [ ] Összes modul `npm test` passa
- [ ] `brunella health` zöld
- [ ] 14 modul külön-külön dokumentálva
- [ ] E2E workflow tesztelve
- [ ] Conductor track-ek update-elve

---

## 🚀 Next Steps

1. **Spec approval**: Jóváhagytatni a `spec.md` fájlt az Architecture Review Board-dal
2. **Sprint Planning**: Phase 1 tasks kiosztása Developer Agentnek
3. **Monitoring setup**: Grafana dashboard konfigurálása a 14 modul követésére

---

*Dokumentáció: 2026-02-16 | Verzió: 1.0*
