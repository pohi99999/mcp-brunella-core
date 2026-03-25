# 🤖 Copilot Agent Routing Guide

> GitHub Copilot CLI számára — BAS 61 ügynök meghívási útmutató.
> Ha feladatot kapsz, keresd meg itt a megfelelő ügynököt, és hívd meg a dispatch scripttel.

## Dispatch: 2 mód

### A) Offline Router (szerver nélkül, GYORS)

```powershell
# Feladat → legjobb agent (szerver NEM kell)
node scripts/copilot-route.js "Fix TypeScript lint errors"

# Összes agent listázása
node scripts/copilot-route.js --list

# Domainek
node scripts/copilot-route.js --domains

# Domain szűrés
node scripts/copilot-route.js --domain marketing
```

### B) REST API Dispatch (szerver KELL, agent VÉGREHAJTÁS)

```powershell
# Konkrét ügynök hívása
.\scripts\copilot-dispatch.ps1 -Mode execute -AgentName "Developer" -Task "Fix TS errors"

# Automatikus routing (AgentManager dönt)
.\scripts\copilot-dispatch.ps1 -Mode route -Task "Keress rá az AI trendekre"

# Ügynökök listázása
.\scripts\copilot-dispatch.ps1 -Mode list

# Állapot ellenőrzés
.\scripts\copilot-dispatch.ps1 -Mode status
```

**Előfeltétel REST-hez:** BAS Express szerver fusson → `npm run dev` vagy `start-full.bat`

### C) Copilot Workflow (hogyan használd)

1. **Routing döntés:** `node scripts/copilot-route.js "feladat leírás"` → JSON válasz a legjobb agent-tel
2. **Ha 0.7+ confidence** → használd az agentot (REST dispatch vagy közvetlen kód hívás)
3. **Ha <0.7 confidence** → nézd meg az alternatívákat, vagy csináld magad
4. **Ha szerver nem fut** → az offline router mindig elérhető

---

## Agent Routing Mátrix

### 🔧 Fejlesztés & Kód

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| Kód generálás, hibajavítás, refactoring | **Developer** | TypeScript/JS kód módosítás, bug fix |
| GitHub Models GPT-4o kód review | **github_models** | Premium kód generálás, review |
| Lint hibák automatikus javítása | **lint_fixer** | ESLint/TSC hibák auto-fix |
| Kódelemzés, függőségi gráf | **DependencyGraph** | Import vizsgálat, kód struktúra |
| Tesztelés, validáció | **qa** | Test futtatás, test generálás |
| DevOps, CI/CD | **DevOps** | Pipeline, deploy, infra |
| Python alrendszer | **Python** | myai/ Python kód, FastAPI |
| Chrome DevTools debug | **ChromeDevTools** | Web debug, performance |

### 🌐 Web & Böngésző Automatizálás

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| Weboldal automatizálás (kattintás, form) | **robotkezv2** / **RobotkezV2** | Böngésző vezérlés, scraping |
| Web scraping (Apify) | **ApifyScraping** | Strukturált web adatgyűjtés |
| Cloudflare Edge worker | **EdgeProxy** | Edge routing, D1/KV/R2 |

### 📊 Enterprise Suite

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| Számla feldolgozás, OCR | **finance_guardian** / **FinancialGuard** | Invoice, pénzügyi anomália |
| Logisztika, szállítás | **logistics_dispatcher** / **LogisticsDispatcher** | Shipment tracking, route |
| HR, toborzás | **DigitalHeadhunter** | CV screening, recruitment |
| Konfliktuskezelés, hangulatelemzés | **ConflictMediator** | Sentiment analysis, mediation |
| Értékesítés, CRM | **sales** | Lead generálás, ügyfélkezelés |
| LinkedIn scraping | **sales_hunter** | B2B lead mining |
| Lead bányászat | **lead_mining** | B2B lead generálás |
| Beszerzés, tárgyalás | **procurement** | Supplier negotiation, pricing |
| Dinamikus árazás | **PricingAgent** | Piaci ár optimalizálás |
| Biztosítás, kockázat | **ProactiveClaimsAgent** | Insurance, risk |
| Ingatlan elemzés | **PropertyAnalyst** / **PropertyVisionary** | Ingatlan OCR, piacelemzés |
| Fenntarthatóság, ESG | **LocalCSR** | CSR reporting |

### 📝 Tartalom & Marketing

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| Szövegírás, social media, email | **copywriter** | Marketing szövegek |
| Marketing kampány | **CampaignGenerator** / **marketing_director** | Kampány tervezés |
| Nurture kampányok | **NurturerAgent** | Drip campaign |
| UX/UI tervezés | **UXDesigner** | Design spec generálás |

### 🔬 Kutatás & Elemzés

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| RAG keresés, összefoglalás | **researcher** | Dokumentum keresés, összefoglalás |
| Adatelemzés, Python ML | **DataScientist** | Data analysis, gépi tanulás |
| Piaci hírszerzés | **market_intel** | Competitor analysis, trends |
| TRIZ innováció | **innovation_bridge** | Iparágak közötti innováció |
| Pályázatfigyelés | **grant_watcher** | EU/hazai pályázat scraping |
| Jogi monitoring | **law_detective** | Jogszabály változás, compliance |

### 🏗️ Projekt & Rendszer

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| Track kezelés, projekt státusz | **ProjectConductor** | EPP-v2 tracks, conductor |
| Feladat dekompozíció | **task_decomposer** | Komplex task DAG-ra bontás |
| Spec írás, track generálás | **SpecWriter** | Új track spec + plan |
| Agent tervezés | **agent_architect** | Új agent prompt/config |
| Dokumentáció | **documenter** | Auto-docs, summary |
| Kritikus review | **critic_agent** | Minőségellenőrzés, hallucinatio |

### 🎙️ Egyéb

| Feladattípus | Ügynök | Mikor használd |
|---|---|---|
| Hangvezérlés, screenshot | **voice** | Audio input, képernyőkép |
| Email triage | **email_triage** | Inbox rendezés, prioritás |
| Tudásbázis építés | **knowledge_base_builder** | Wiki generálás |
| Multi-modul koordináció | **enterprise_orchestrator** | ERP szintű orkesztráció |
| Monitoring, diagnosztika | **ops** | Rendszer health check |
| Értékelés, health check | **evaluator** | Agent/system tesztelés |

---

## Döntési Fa (Copilot számára)

```
Feladat beérkezik
  │
  ├─ Kód módosítás szükséges? ──────── NEM hívok agentot, magam csinálom
  │   (fájl szerkesztés, git)          (Copilot CLI natív képesség)
  │
  ├─ Web böngészés / scraping? ─────── robotkezv2 / ApifyScraping
  │
  ├─ Számla / pénzügy? ────────────── finance_guardian
  │
  ├─ Marketing szöveg? ────────────── copywriter / CampaignGenerator
  │
  ├─ Adatelemzés / ML? ────────────── DataScientist
  │
  ├─ Piaci kutatás? ───────────────── market_intel / researcher
  │
  ├─ HR / toborzás? ───────────────── DigitalHeadhunter
  │
  ├─ Logisztika / tracking? ───────── logistics_dispatcher
  │
  ├─ Jogi / compliance? ──────────── law_detective
  │
  ├─ Projekt track kezelés? ───────── ProjectConductor
  │
  ├─ Komplex multi-agent feladat? ─── Orchestrator (route mód)
  │
  └─ Nem tudom melyik? ───────────── route mód (AgentManager dönt)
```

## Megjegyzések

- **Szerver MUSZÁJ fusson** (`:3000`) — különben a dispatch sikertelen
- **Timeout:** Alapértelmezetten 120 másodperc, komplex feladatnál növelhető `-TimeoutSec 300`
- **Magyar trigger szavak** működnek a route módban: "számla", "logisztika", "böngésző", stb.
- **Context** paraméterben extra info adható: `-Context '{"debugMode":true,"domain":"example.com"}'`
