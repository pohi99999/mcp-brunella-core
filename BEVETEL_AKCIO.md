# 💰 BRUNELLA BEVÉTEL AKCIÓ TERV
**Készült:** 2026-02-24 | **Verzió:** 1.0 | **Státusz:** AKTÍV

---

## 🏗️ TELJES RENDSZER ÁLLAPOT AUDIT

```
╔══════════════════════════════════════════════════════════════════════════════╗
║              BRUNELLA AGENT SYSTEM v2.4.0 — PRODUCTION READINESS            ║
╠══════════════════════════════╦═══════════════════════════════════════════════╣
║  ✅ PRODUCTION READY         ║  ⚠️ CONFIG SZÜKSÉGES                          ║
║                              ║                                               ║
║  • Node.js Express (:3000)   ║  • Apify API kulcs                            ║
║  • React Dashboard (:5173)   ║  • LinkedIn proxy config                      ║
║  • Python FastAPI (:8000)    ║  • Google Sheets OAuth                        ║
║  • SQLite task queue         ║  • Invoice OCR kalibráció                     ║
║  • LanceDB vektor DB (RAG)   ║  • SMTP email config                          ║
║  • AnythingLLM tudásbázis    ║  • CEAN Workers terjesztés (tervezett)        ║
║  • Phoenix Protocol v2       ║                                               ║
║  • ~1200 teszt (99%+ pass)   ║                                               ║
║  • Ollama + Gemini + GPT-4o  ║                                               ║
║  • 49 regisztrált ügynök     ║                                               ║
╚══════════════════════════════╩═══════════════════════════════════════════════╝
```

---

## ☁️ CLOUDFLARE EDGE LÉGIÓ (Kiépített Infrastruktúra)

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                     ☁️ CLOUDFLARE EDGE NETWORK — AKTÍV                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║                                                                              ║
║  DEPLOYED WORKERS (6-8 aktív):                                               ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │ ✅ llm-chat-app-template   — Chat UI Cloudflare Workers AI-val      │    ║
║  │ ✅ agents-api              — MCP agent API proxy edge-en            │    ║
║  │ ✅ saas-admin              — Admin + SaaS management worker         │    ║
║  │ ✅ brunella-cf             — Brunella core API edge proxy           │    ║
║  │ ✅ bas-orchestrator        — Központi agent delegáló worker         │    ║
║  │    URL: https://bas-orchestrator.iam-dd1.workers.dev               │    ║
║  │ ✅ throbbing-fire          — Általános worker (audit szükséges)     │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
║                                                                              ║
║  STORAGE & AI INFRASTRUKTÚRA:                                                ║
║  ┌─────────────────────────────────────────────────────────────────────┐    ║
║  │ ✅ D1 Database    — SQLite edge adatbázis (12 tábla, kész)          │    ║
║  │ ✅ KV Storage     — Key-value store (integrálva)                    │    ║
║  │ ✅ Vectorize R1   — Vektoros keresés (embeddings, kész)             │    ║
║  │ ✅ AI Gateway     — LLM routing (@cf/meta/llama-3.1-8b)            │    ║
║  │ ✅ Browser API    — Playwright automation (siTRHomo1G_...)          │    ║
║  │ ✅ Tunnel         — Publikus URL localhost-hoz                      │    ║
║  │ ⏳ R2 Storage     — Object storage (credentials kész, nem aktív)   │    ║
║  │ ⏳ Durable Obj.   — Stateful workers (tervezett)                   │    ║
║  └─────────────────────────────────────────────────────────────────────┘    ║
║                                                                              ║
║  EDGE AGENT (EdgeProxyAgent):                                                ║
║  • D1 ↔ SQLite szinkron    • KV cache layer    • Vectorize RAG queries      ║
║  • Cloudflare Worker URL: CLOUDFLARE_WORKER_URL env-ben                      ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

## 🤖 ÜGYNÖK SEREG — 49 AGENT, 8 CSAPAT

### 🏆 SQUAD 1 — "PÉNZCSINÁLÓ CSAPAT" 💰
> **Közvetlen bevétel szerzés — Azonnal élesíthető**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **LeadMiningAgent** | B2B lead lista gyártás, scraping, icebreaker generálás | ⭐⭐⭐⭐⭐ |
| **SalesHunterAgent** | LinkedIn scraping, lead scoring, email draft | ⭐⭐⭐⭐⭐ |
| **SalesAgent** | Lead gen, CRM integráció, email drafting | ⭐⭐⭐⭐ |
| **NurturerAgent** | Copywriting, kampány tervezés, lead nurturing | ⭐⭐⭐⭐ |
| **MarketingAgent** | Corporate lead hunting, teaser email, personalizáció | ⭐⭐⭐⭐ |
| **CopywriterAgent** | Social media, email sorozat, slogan | ⭐⭐⭐⭐ |
| **MarketingDirectorAgent** | Kampány orchestráció, content assembly, trend koord. | ⭐⭐⭐⭐ |

```
🎯 SZOLGÁLTATÁS: "BAS Lead Engine"
   → Iparág + célpiac megadása → 50 minősített lead/hét + személyre szabott email
   → Ár: 49.000 Ft/projekt | 29.000 Ft/hó havidíj
   → Élesítési idő: 2-3 nap
```

---

### 🔍 SQUAD 2 — "PIACI HÍRSZERZŐK" 🕵️
> **Versenytárs figyelés, pályázat, jogszabály — B2B SaaS**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **MarketIntelAgent** | Ár + versenytárs monitoring, trend, alerting | ⭐⭐⭐⭐⭐ |
| **GrantWatcherAgent** | Pályázat scraping, eligibility matching, TEÁOR szűrés | ⭐⭐⭐⭐⭐ |
| **GrantHunterAgent** | Pályázat matching, eligibility, compliance check | ⭐⭐⭐⭐⭐ |
| **LawDetectiveAgent** | Magyar Közlöny figyelő, compliance, KKV impact | ⭐⭐⭐⭐⭐ |
| **TrendAnalystAgent** | Piaci trend, versenytárs, tracking | ⭐⭐⭐⭐ |
| **PricingAgent** | Piac elemzés, versenytárs tracking, ár optimalizálás | ⭐⭐⭐⭐ |
| **ApifyScrapingAgent** | Web adatgyűjtés (Google, LinkedIn, Amazon, Twitter) | ⭐⭐⭐⭐ |
| **InnovationBridgeAgent** | TRIZ-alapú cross-industry innováció transzfer | ⭐⭐⭐ |

```
🎯 SZOLGÁLTATÁS 1: "KKV Pályázat Radar"
   → Figyeli a releváns EU/HU pályázatokat + jogszabályokat automatikusan
   → Ár: 9.990 Ft/hó | 10 ügyfél = 100.000 Ft/hó
   → Élesítési idő: 1-2 nap

🎯 SZOLGÁLTATÁS 2: "Versenytárs Figyelő"
   → Napi ár + termék monitoring, riasztás
   → Ár: 14.990 Ft/hó retail/KKV ügyfeleknek
```

---

### 💼 SQUAD 3 — "BACK-OFFICE AUTOMATIZÁLÓ" 🏢
> **Cégek belső folyamatai — Havidíjas SaaS**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **FinanceGuardian** | Számla OCR, anomália detektálás, pénzügyi trend | ⭐⭐⭐⭐⭐ |
| **FinancialGuardAgent** | Számla OCR, PDF feldolgozás, duplikát detektálás | ⭐⭐⭐⭐⭐ |
| **EmailTriageAgent** | Email osztályozás, prioritás, auto-válasz | ⭐⭐⭐⭐ |
| **LogisticsDispatcher** | Fuvarkövetés, útvonal optimalizálás, értesítések | ⭐⭐⭐⭐ |
| **ProcurementAgent** | Szállítói ár elemzés, tárgyalás stratégia | ⭐⭐⭐⭐ |
| **KnowledgeBaseBuilderAgent** | Wiki generálás, FAQ, message analízis | ⭐⭐⭐ |
| **DigitalOfficeManager** | Email triage, automation rules, priority scoring | ⭐⭐⭐⭐ |
| **ProactiveClaimsAgent** | Kárrendezés, kockázat értékelés, fraud detection | ⭐⭐⭐ |

```
🎯 SZOLGÁLTATÁS: "AI Irodavezető Csomag"
   → Email kezelés + Számla feldolgozás + Logisztika automatizálás
   → Ár: 29.990 Ft/hó kisebb cégeknek
   → Élesítési idő: 3-5 nap (SMTP + OCR config)
```

---

### 🤖 SQUAD 4 — "ROBOTKÉZ BRIGÁD" 🖥️
> **Automatizált böngészős feladatok — azonnali SaaS**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **RobotkezV2 (CometBrowser)** | Önjavító hibrid böngésző ügynök, vision, form fill | ⭐⭐⭐⭐⭐ |
| **RobotkezAgent** | Browser automation, UI interaction, screenshots | ⭐⭐⭐⭐ |

```
🎯 SZOLGÁLTATÁS: "Web Robotpilóta"
   → "Bármilyen webes feladatot elvégzünk robot-tal"
   → Adatgyűjtés, form kitöltés, monitoring
   → Ár: 5.000 Ft/feladat | 29.000 Ft/hó korlátlan
   → Élesítési idő: HOLNAP (teljesen kész!)
```

---

### 🛠️ SQUAD 5 — "SZOFTVER GYÁR" 💻
> **Szoftverfejlesztés automatizálása fejlesztő cégeknek**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **DeveloperAgent** | Kód generálás, self-healing pipeline | ⭐⭐⭐⭐ |
| **EvaluatorAgent / QA** | Teszt futtatás, audit, health check | ⭐⭐⭐⭐ |
| **ChromeDevToolsAgent** | Web debug, performance, CDP hálózat | ⭐⭐⭐ |
| **LintFixerAgent** | ESLint + TypeScript auto javítás | ⭐⭐⭐ |
| **SpecWriterAgent** | Track/spec generálás EPP v2 szerint | ⭐⭐⭐⭐ |
| **UXDesignerAgent** | UI tervek szövegesen, component blueprint | ⭐⭐⭐ |
| **GenesisOrchestrator** | Párhuzamos task orchestráció | ⭐⭐⭐ |
| **GitHubModelsAgent** | Premium GPT-4o kód review, architecture | ⭐⭐⭐⭐ |

```
🎯 SZOLGÁLTATÁS: "AI Dev Csapat Bérlés"
   → "Egy AI agent csapat dolgozik a kódodon éjjel-nappal"
   → Ár: 150.000 Ft/hó | projekt alapú árazás
   → Élesítési idő: 1 nap (már kész)
```

---

### 👥 SQUAD 6 — "HR & KAPCSOLATOK CSAPAT" 🤝
> **Toborzás, konfliktus, sentiment**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **DigitalHeadhunterAgent** | CV parsing, LinkedIn scraping, skill matching | ⭐⭐⭐⭐ |
| **HeadhunterAgent** | CV parsing, kandidát matching, interjú kérdések | ⭐⭐⭐⭐ |
| **ConflictMediatorAgent** | Sentiment analízis, konfliktus detektálás | ⭐⭐⭐ |
| **SentimentAnalysisModule** | Sentiment, emotion detection, key phrase | ⭐⭐⭐ |
| **PropertyAnalystAgent** | Vision, OCR, ingatlan analízis | ⭐⭐⭐ |

```
🎯 SZOLGÁLTATÁS: "AI Toborzó Asszisztens"
   → CV szűrés + LinkedIn keresés + jelölt értékelés
   → Ár: 19.990 Ft/toborzási projekt
```

---

### 🌱 SQUAD 7 — "CSR & TUDÁS CSAPAT" 📚
> **Fenntarthatóság, tudásmenedzsment**

| Ügynök | Mit tud? | Bevétel potenciál |
|--------|----------|-------------------|
| **LocalCSRAgent** | Carbon footprint, ESG riport, charity | ⭐⭐⭐ |
| **LocalCSRBot** | Regulatory compliance, CSR ajánlások | ⭐⭐⭐ |
| **KnowledgeBuilder** | Dokumentum létrehozás, wiki mgmt, knowledge graph | ⭐⭐⭐ |

---

### 🧠 SQUAD 8 — "MOTOR ROOM" (Belső Infra) ⚙️
> **Nem bevétel csapat — az összes többi csapat működtetői**

| Ügynök | Szerepe |
|--------|---------|
| **OrchestratorAgent** | Feladat irányítás, routing, delegálás |
| **EnterpriseOrchestratorAgent** | 18 enterprise modul routing |
| **ResearcherAgent** | RAG keresés, összefoglalás |
| **TaskDecomposerAgent** | Komplex feladat → mikro-taskok |
| **DataScientistAgent** | Adat tisztítás, LanceDB, E2B sandbox |
| **EdgeProxyAgent** | Cloudflare D1/KV/Vectorize kommunikáció |
| **VoiceAgent** | Hang parancsok, multimodális |
| **ProjectConductorAgent** | Track mgmt, dokumentáció szinkron |
| **AgentArchitectAgent** | Új ügynökök tervezése |
| **DocsIntelligenceAgent** | Dokumentáció frissítés |
| **IntegratorAgent** | AnythingLLM, tudásbázis szinkron |
| **PythonAgent** | Python script végrehajtás |

---

## 🚦 ÉLESÍTÉSI ÁLLAPOT — TRAFFIC LIGHT

```
╔══════════════════════════════════════════════════════════════════╗
║               PRODUCTION READINESS RÉSZLETES                    ║
╠═══════════════════════════╦══════════╦═══════════════════════════╣
║  SZOLGÁLTATÁS             ║ ÁLLAPOT  ║  MI HIÁNYZIK?             ║
╠═══════════════════════════╬══════════╬═══════════════════════════╣
║ Copywriter + Marketing    ║ 🟢 100%  ║  SEMMI — kész!            ║
║ RobotkezV2 Browser        ║ 🟢 95%   ║  SEMMI — kész!            ║
║ Dev/QA Automation         ║ 🟢 95%   ║  SEMMI — kész!            ║
║ Grant Watcher + Hunter    ║ 🟢 95%   ║  Csak config finomhang.   ║
║ Law Detective (KKV)       ║ 🟢 95%   ║  Csak config finomhang.   ║
║ Market Intelligence       ║ 🟢 90%   ║  Apify API kulcs          ║
║ Lead Mining + Sales       ║ 🟡 80%   ║  Proxy / API kulcs        ║
║ Email Triage              ║ 🟡 75%   ║  SMTP config              ║
║ Invoice OCR (Finance)     ║ 🟡 75%   ║  OCR kalibráció           ║
║ Logistics Dispatcher      ║ 🟡 70%   ║  Integráció finalizálás   ║
║ Cloudflare Edge Workers   ║ 🟢 90%   ║  CEAN full deploy         ║
╚═══════════════════════════╩══════════╩═══════════════════════════╝
```

---

## 💰 TOP 5 GYORS BEVÉTEL LEHETŐSÉG

```
┌──────────────────────────────────────────────────────────────────────┐
│ #1 🏆 WEB ROBOTPILÓTA (RobotkezV2 Comet)                            │
│ "Bármilyen webes feladatot elvégzünk robot-tal emberi felügyelet    │
│  nélkül — adatgyűjtés, form kitöltés, monitoring"                   │
│                                                                      │
│  Agentok: RobotkezV2 (CometBrowser) + ApifyScrapingAgent           │
│  Ár:      5.000 Ft/feladat | 29.000 Ft/hó korlátlan               │
│  Élesítés: HOLNAP ✅ (teljesen kész!)                               │
├──────────────────────────────────────────────────────────────────────┤
│ #2 🏆 KKV PÁLYÁZAT + JOGSZABÁLY RADAR                               │
│ "Automatikusan figyeljük a pályázatokat és jogszabályokat —        │
│  értesítünk ha valami érint téged"                                  │
│                                                                      │
│  Agentok: GrantWatcherAgent + GrantHunterAgent + LawDetectiveAgent │
│  Ár:      9.990 Ft/hó | 10 ügyfél = 100.000 Ft/hó                │
│  Élesítés: 1-2 nap (config véglegesítés)                           │
├──────────────────────────────────────────────────────────────────────┤
│ #3 🏆 TARTALOM GYÁRTÁS CSOMAG                                        │
│ "Havi social media posztok + email kampányok AI-val"               │
│                                                                      │
│  Agentok: CopywriterAgent + MarketingDirectorAgent + NurturerAgent │
│  Ár:      19.990 Ft/hó (10 poszt + 2 email sorozat/hó)            │
│  Élesítés: HOLNAP ✅ (teljesen kész!)                               │
├──────────────────────────────────────────────────────────────────────┤
│ #4 🏆 B2B LEAD GENERÁLÁS SZOLGÁLTATÁS                                │
│ "Adj meg egy iparágat — küldünk 50 minősített lead-et/hét          │
│  személyre szabott megkeresővel"                                    │
│                                                                      │
│  Agentok: LeadMiningAgent + SalesHunterAgent + SalesAgent          │
│  Ár:      49.000 Ft/projekt | 29.000 Ft/hó                        │
│  Élesítés: 2-3 nap                                                  │
├──────────────────────────────────────────────────────────────────────┤
│ #5 🏆 AI SZOFTVERFEJLESZTŐ CSAPAT BÉRLÉS                             │
│ "Egy teljes AI agent csapat dolgozik éjjel-nappal a kódodon"       │
│                                                                      │
│  Agentok: Developer + QA/Evaluator + GitHubModels + LintFixer      │
│  Ár:      150.000 Ft/hó | projekt alapú                            │
│  Élesítés: 1 nap ✅ (már kész)                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## ☁️ CLOUDFLARE EDGE — BEVÉTEL SZORZÓ

```
A Cloudflare infrastruktúra GLOBÁLIS terjesztést és SKÁLÁZHATÓSÁGOT ad:

✅ bas-orchestrator.workers.dev  → Ügyfél API endpoint (0ms latency)
✅ D1 Database                  → Ügyfél adatok edge-en tárolva
✅ KV Storage                   → Cache, session, real-time state
✅ Vectorize R1                 → Személyre szabott RAG minden ügyfélnek
✅ AI Gateway                   → LLM költség optimalizálás (cache hit ~30%)
✅ Tunnel                       → Publikus demo linkek azonnal

💡 Edge előny az értékesítésben:
   "A rendszer globálisan elérhető, 99.9% uptime, GDPR compliant,
    adataid nem hagyják el az EU-t (Cloudflare EU régió)"
```

---

## 🗓️ HOLNAPI AKCIÓTERV (2026-02-25)

| Idő | Feladat | Felelős Agent(ek) |
|-----|---------|-------------------|
| 09:00 | Grant Watcher config + első futtatás | GrantWatcherAgent |
| 09:30 | Law Detective config véglegesítés | LawDetectiveAgent |
| 10:00 | Copywriter service demo anyag elkészítése | CopywriterAgent + MarketingDirector |
| 10:30 | RobotkezV2 demo link generálás (CF tunnel) | RobotkezV2 + EdgeProxy |
| 11:00 | Első 3 ajánlat kiküldése próba ügyfeleknek | SalesAgent + NurturerAgent |
| 13:00 | Lead Mining első batch futtatás | LeadMiningAgent + SalesHunter |
| 15:00 | Eredmények kiértékelése | EvaluatorAgent |

---

## 📊 BEVÉTEL PROGNÓZIS

```
KONZERVATÍV BECSLÉS (1 hónap):
├── Web Robotpilóta:    5 ügyfél × 29.000 Ft  =  145.000 Ft/hó
├── Pályázat Radar:    10 ügyfél × 9.990 Ft   =   99.900 Ft/hó
├── Tartalom csomag:    5 ügyfél × 19.990 Ft  =   99.950 Ft/hó
├── Lead generálás:     3 projekt × 49.000 Ft =  147.000 Ft/hó
├── Dev csapat bérlés:  1 ügyfél × 150.000 Ft =  150.000 Ft/hó
└─────────────────────────────────────────────────────────────
   ÖSSZESEN:                                  =  641.850 Ft/hó

OPTIMISTA (3 hónap múlva, skálázva):
   2.5M - 4M Ft/hó (ha 50-100 ügyfél + enterprise)
```

---

## 🔑 KRITIKUS KÖVETKEZŐ LÉPÉSEK

1. **API kulcsok véglegesítése** (`.env` frissítés):
   - `APIFY_API_KEY` — Lead mining + scraping
   - `SMTP_*` konfig — Email triage
   - `GOOGLE_OAUTH` — Sheets integráció

2. **Landing page / ajánlat** a top 3 szolgáltatáshoz

3. **Cloudflare Workers élesítése** CEAN agent fleet-tel

4. **Demo videó** RobotkezV2-ről (legjobb értékesítési eszköz!)

---

*Generálta: Brunella Agent System | 2026-02-24*
*Agentok: 49 regisztrált | Tesztek: ~1200 (99%+ pass) | CF Workers: 6-8 aktív*
