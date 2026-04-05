# Végrehajtási Terv: Kognitív Könyvelés és Multi-Ágens Egyeztetés — Bővítmény

**Track ID:** `konyveles_kognitiv_bovites_20260330`
**Kapcsolódó alap-track:** `n8n_konyveles_pipeline_20260328` (COMPLETED)
**Blokkoló előfeltétel:** `konyveles_phase3_20260403` (live pipeline — **ELŐBB KELL LEZÁRNI!**)
**Becsült idő:** Phase 0: 1 nap · Phase 1: 5 nap · Phase 2: 7 nap · Phase 3: 5 nap · Phase 4: 3 nap
**Utolsó audit:** 2026-04-03

---

## ✅ MÁR MEGÉPÍTVE (nem kell újra)

- ✅ `BankAgent.ts`, `NavAgent.ts`, `MatchingAgent.ts` — alap egyeztetési logika
- ✅ `bookkeeping_db.ts` — SQLite séma (bővítésre szorul Phase 2-ben)
- ✅ `src/tools/getSzamlazzInvoices.ts` — MCP tool wrapper

## ❌ NINCS MEGÉPÍTVE (ez a track feladata)

- ❌ `src/core/accountingKnowledgeBase.ts` (Phase 1)
- ❌ `src/utils/accountingKbIngest.ts` (Phase 1)
- ❌ `src/mcp/accountingKnowledgeMcp.ts` (Phase 1)
- ❌ Langflow flow-ok: accounting-rag-chain, reconciliation-exception stb. (Phase 1-3)
- ❌ `ReconciliationIngestionAgent.ts`, `AdvancedMatchingAgent.ts` (Phase 2)
- ❌ `ReconciliationExceptionAgent.ts`, `ReconciliationCommunicationAgent.ts` (Phase 2)
- ❌ `NavCrossCheckAgent.ts` (Phase 2)
- ❌ `AnomalyDetectionAgent.ts`, `CashFlowPredictionAgent.ts` (Phase 3)
- ❌ n8n WF-K1, WF-K2, WF-K3, WF-K4 workflow-ok (Phase 2-3)
- ❌ `AccountingKbWidget.tsx`, `CashFlowWidget.tsx` (Phase 4)

---

## Phase 0 — Előfeltétel Ellenőrzés ⛔ BLOKKOLVA (1 nap)

> **STOP.** Ezt a fázist csak akkor kezd el, ha `konyveles_phase3_20260403` archivált!

- [ ] `konyveles_phase3_20260403` státuszának ellenőrzése → archivált?
- [ ] LanceDB telepítve: `cd myai && uv add lancedb` → `python -c "import lancedb; print('OK')"`
- [ ] Langflow instance fut: `http://localhost:7860` elérhető?
- [x] `data/accounting-kb/` mappa létrehozása (scaffold már megvan; jelenleg csak `README.md`)
- [ ] Könyvvizsgálati/számviteli politika PDF-ek összegyűjtése `data/accounting-kb/`-ba
- [ ] Egységes számlatükör JSON elkészítése: `data/accounting-kb/chart_of_accounts.json`

---

## Phase 1 — Számviteli Tudásbázis és MCP Integráció (25%)

**Cél:** A rendszer ne "fekete dobozként" kezelje a könyvelési logikát, hanem a cég saját számviteli politikája alapján döntsön.
**Állapot: PLANNED (nem IN_PROGRESS — semmi sem épült meg belőle!)**

### 1.1 Tudásbázis adatok összegyűjtése és vektorizálása
- [ ] Belső számviteli politika PDF-ek és szabályzatok összegyűjtése (`data/accounting-kb/`)
- [ ] Korábbi főkönyvi kivonatok és kontírozási példák exportálása
- [ ] Egységes számlatükör (1-9. számlaosztályok) strukturált formában (JSON/CSV)
- [ ] Magyar Számviteli Törvény (2000. évi C. törvény) releváns paragrafusai szöveg formában
- [ ] LanceDB ingesztálás: `src/utils/accountingKbIngest.ts` script írása
- [ ] Vektorizálás: `text-embedding-3-small` (OpenAI) vagy `nomic-embed-text` (Ollama) modelllel

### 1.2 MCP szerver kialakítása (accounting-knowledge-mcp)
- [ ] `src/mcp/accountingKnowledgeMcp.ts` létrehozása
- [ ] Tool-ok definiálása: `search_accounting_policy`, `get_chart_of_accounts`, `find_similar_entries`
- [ ] RBAC jogosultság: csak `DEVELOPER`, `EVALUATOR`, `ADMIN` profilok érhessék el
- [ ] Érzékeny adatok maszkolása (partnernevek, bankszámlaszámok anonimizálása a vektortárban)
- [ ] n8n MCP Client Tool csomópont konfigurálása a szerverre
- [ ] CLI parancs: `brunella mcp test accounting` (tudásbázis teszt lekérdezés)
- [ ] Dashboard fül: "Tudásbázis" panel az `AccountingKbWidget.tsx`-ben

### 1.3 Langflow RAG lánc — Few-shot kontírozási asszisztens
- [ ] Langflow flow létrehozása: `accounting-rag-chain`
- [ ] Bejövő számla adatok (OCR output) → MCP lekérdezés → LLM kontírozási javaslat
- [ ] Few-shot prompt sablon: Számviteli törvény kontextus + 3 korábbi kontírozási példa
- [ ] Strukturált JSON kimenet: `{ "debit": "5xx", "credit": "4xx", "amount": 0, "confidence": 0.0, "rationale": "" }`
- [ ] Langflow API exportálása REST endpoint-ként, n8n HTTP Request node-ból hívható
- [ ] Teszt: 5 különböző számlatípus helyes kontírozásának ellenőrzése

---

## Phase 2 — Multi-Ágens Reconciliation Motor (35%)

**Cél:** A meglévő `matching_engine.ts` heurisztikus szabályait kiegészíteni intelligens ágensekkel, amelyek a nehéz kivételeket is kezelik.

### 2.1 Ingesztor és Párosító Ágens finomhangolása
- [ ] `ReconciliationIngestionAgent.ts` létrehozása
  - Bemeneti formátumok felismerése: bank OFX/CSV, NAV XML, szamlazz.hu JSON
  - Normalizálás egységes belső formátumra (ISO 8601 dátum, HUF/EUR/USD)
  - Deduplikáció ellenőrzés (duplikált számla guard)
- [ ] `AdvancedMatchingAgent.ts` — részleges fizetések és árfolyam-különbözetek
  - Többlépéses egyeztetési logika: egzakt match → összeg-tartomány match → szemantikus match
  - Árfolyam-különbözet kezelés: MNB API lekérdezés az adott napi árfolyamhoz
  - Részleges fizetés split: egy banki utalás → több számla arányos párosítása
- [ ] n8n workflow (WF-K1): Reconciliation trigger → Ingesztor ágens → Párosító ágens → eredmény SQLite-ba

### 2.2 Kivételkezelő (Exception) Ágens
- [ ] `ReconciliationExceptionAgent.ts` implementálása
  - Input: párosítatlan banki tétel + kontextus (partner neve, összeg, dátum, közlemény)
  - MCP lekérdezés: partner korábbi fizetési szokásai, átlagos fizetési késés
  - Megjegyzés rovat szemantikai elemzése (NLP): "részfizetés", "előleg", "stornó" kulcsszavak
  - Döntési fa: valószínű ok azonosítása (időbeli eltolódás / összevont tétel / hibás közlemény / valós kivétel)
  - Output: strukturált kivétel rekord + javasolt akció
- [ ] n8n "Exception Queue" workflow (WF-K2): rendszeres futás (2 óránként), Human-in-Loop értesítés

### 2.3 Kommunikációs Ágens
- [ ] `ReconciliationCommunicationAgent.ts` — partner e-mail draft generálás
  - Prompt sablon: professzionális, udvarias magyarázat-kérő e-mail a partnernek
  - Változók: partner neve, számla száma, eltérő összeg, javasolt korrekció
  - Langflow-ban definiált prompt (roleplay: "Pénzügyi munkatársként írsz...")
- [ ] n8n WF-K2 kiegészítése: Gmail/SMTP send node + "Send and wait for response" jóváhagyás
- [ ] Dashboard: "Kivételek" panel az `InvoiceAutomationWidget`-ben, akció gombok (Jóváhagyás / Elutasítás / E-mail küldés)

### 2.4 NAV API v3.0 cross-reconciliation
- [ ] `NavCrossCheckAgent.ts` — minden számlát NAV XML-lel validál
  - n8n HTTP Request: `GET https://api.onlineszamla.nav.gov.hu/invoices/v3/queryInvoiceData`
  - Mezők validálása: adószám, ÁFA-kód, adóalap, bruttó összeg
  - Eltérés esetén: automatikus korrekció javaslat, "Kézi review szükséges" flag
- [ ] Biztonságos credential tárolás: NAV API kulcs n8n credential vault-ban

---

## Phase 3 — Anomáliadetektálás és Prediktív Analitika (25%)

**Cél:** Proaktív pénzügyi védelem — a rendszer előre jelzi a problémákat, nem csak utólag rögzíti.

### 3.1 Continuous Monitoring Ágens
- [ ] `AnomalyDetectionAgent.ts` implementálása
  - Folyamatos (Cron: 1 óránként) elemzés a `bookkeeping_db.ts` tranzakcióin
  - Duplikált számla guard: ugyanaz a számlaszám + összeg < 7 napon belül kétszer
  - Kiugró ár riasztás: partner átlagárától > 30% eltérés esetén flag
  - Szokatlan időpont: munkaidőn kívüli (éjféli) tranzakció jelzése
  - Készletforgási sebesség anomália (a készletkezelő track adataival kombinálva)
- [ ] n8n WF-K3: Cron trigger → AnomalyDetection → SQLite anomália log → riesztás
- [ ] Riasztási szintek: INFO / WARNING / CRITICAL (különböző csatornák: log / Slack / email)

### 3.2 Cash-flow Predikciós Ágens
- [ ] `CashFlowPredictionAgent.ts` — 14-30 napos előrejelzés
  - Historikus fizetési adatok aggregálása: átlagos fizetési idő partner szerint
  - Várható bevételek: nyitott vevői számlák várható beérkezési dátuma
  - Várható kiadások: szállítói számlák lejárati dátumai + ismétlődő tételek (rezsi, bérleti díj)
  - LLM prompt (Langflow): "14 napos cash-flow előrejelzés készítése a következő adatok alapján..."
  - Output: JSON `{ "days": [{"date": "...", "balance": 0, "risk": "low|medium|high"}] }`
- [ ] Dashboard: "Cash-flow Predikció" widget `CashFlowWidget.tsx`

### 3.3 Human-in-the-Loop értesítési rendszer
- [ ] n8n WF-K4: "Send and wait for response" workflow
  - Anomália vagy kritikus cash-flow kockázat esetén interaktív Slack/email üzenet
  - Gombok: "Kifizetés leállítása" / "Rendben, jóváhagyom" / "Manuális review"
  - Webhook fogadja a választ → n8n továbbirányít a megfelelő ágra
  - Timeout: 2 óra után automatikus "CRITICAL" státusz + eskáláció

---

## Phase 4 — Dashboard, CLI és Tesztek (15%)

### 4.1 Dashboard frissítések
- [ ] `InvoiceAutomationWidget.tsx` kiegészítése:
  - "Anomáliák" tab: lista, szűrés, akció gombok
  - "Predikciók" tab: cash-flow grafikon (Recharts), 14 napos előrejelzés
  - "Kivételek" tab: párosítatlan tételek, e-mail draft küldés gomb
- [ ] `AccountingKbWidget.tsx`: tudásbázis keresés UI, kontírozási javaslat teszter
- [ ] Navigation.tsx frissítése: új panel regisztrálása a Finance NavGroup-ban

### 4.2 CLI parancsok (magyar, inquirer.js)
- [ ] `brunella mcp test accounting` — tudásbázis teszt lekérdezés
- [ ] `brunella finance audit` — anomáliadetektálás futtatása
- [ ] `brunella finance predict` — cash-flow előrejelzés futtatása
- [ ] `brunella reconcile status` — egyeztetési státusz összefoglalója

### 4.3 Tesztek
- [ ] `test/accountingKb.test.ts` — LanceDB vektorizálás és MCP lekérdezés mock tesztek
- [ ] `test/reconciliation.test.ts` — AdvancedMatchingAgent edge case-ek: részleges fizetés, árfolyam
- [ ] `test/anomalyDetection.test.ts` — mockolt anomális adatok, riasztási szintek
- [ ] `npm run test:fast` minden commit előtt zöld

---

## Acceptance Kritériumok

| # | Kritérium | Mérési módszer |
|---|---|---|
| AC-1 | Dinamikus kontírozás: az LLM a cég szabályzata alapján ad javaslatot | 10 teszt számla helyes kontírozása |
| AC-2 | Párosítatlan banki tételek aránya < 10% | Reconciliation dashboard statisztika |
| AC-3 | Duplikált számla 100%-ban detektálva | Teszt adattal szimulált duplikáció |
| AC-4 | Cash-flow predikció 14 napos horizonton elérhető | Dashboard widget működik |
| AC-5 | Human-in-Loop értesítés anomáliánál < 5 percen belül | n8n execution log |
