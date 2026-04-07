# 📊 Rendszer Lefedettség Analízis
## P-Sales Human-Loop Revenue Track — Coverage Report
_Generálva: 2026-04-07 | Brunella Orchestrator_

---

## 1. AGENT ÖKOSZISZTÉMA LEFEDETTSÉG

### ✅ Megvan (registry + TypeScript fájl)

| sel.md neve | Registry ID | TypeScript fájl | Státusz |
|---|---|---|---|
| SalesHunterAgent | `sales_hunter` | `SalesHunterAgent.ts` | ✅ Aktív |
| LeadMiningAgent | `lead_mining` | `LeadMiningAgent.ts` | ✅ Aktív |
| CampaignGeneratorAgent | `CampaignGenerator` | `CampaignGeneratorAgent.ts` | ✅ Aktív |
| ApifyScraping | `ApifyScraping` | `ApifyScrapingAgent.ts` | ✅ Aktív |
| copywriter | `copywriter` | `CopywriterAgent.ts` | ✅ Aktív |
| enterprise_orchestrator | `enterprise_orchestrator` | `EnterpriseOrchestratorAgent.ts` | ✅ Aktív |
| NurturerAgent | `NurturerAgent` | `NurturerAgent.ts` | ✅ Aktív |
| DigitalHeadhunter | `DigitalHeadhunter` | `DigitalHeadhunterAgent.ts` | ✅ Aktív |
| EmailAgent | `EmailAgent` | `EmailAgent.ts` | ✅ Aktív |
| market_intel | `market_intel` | `MarketIntelAgent.ts` | ✅ Aktív |
| Developer | `Developer` | `DeveloperAgent.ts` | ✅ Aktív |
| Architect | `Architect` | `ArchitectAgent.ts` | ✅ Aktív |

**ÖSSZESEN: 78 agent, 12 releváns a feladathoz — MIND MEGVAN ✅**

---

## 2. MCP SZERVEREK LEFEDETTSÉG

| MCP Szerver | Állapot | Felhasználás |
|---|---|---|
| `brunella-core` | ✅ Auto-start | 53 tool — fő orchestráció |
| `brunella-remote` | ✅ HTTP FastMCP | Remote deployment backup |
| `playwright` | ✅ Auto-start | Browser scraping fallback |
| `chrome-devtools` | ✅ Auto-start | Browser diagnosztika |
| `github` | ✅ Auto-start (Docker) | Repo integráció |
| `windows_automation_bridge` | ✅ Win32 | Windows UI automation |
| `filesystem` | ✅ Auto-start | Fájlkezelés |
| `memory` | ✅ Auto-start | Kontextus memória |
| `sequential-thinking` | ✅ Auto-start | Összetett döntések |

---

## 3. CLOUDFLARE WORKERS FLOTTA

### 🌟 Kiemelkedő felfedezés: `brunella-lead-intelligence` Worker

**Ez a Worker MÁR MEGOLDJA a KKV lead gen feladatot!**

```
Worker neve:  brunella-lead-intelligence
URL pattern:  https://brunella-lead-intelligence.ACCOUNT_ID.workers.dev
D1 adatbázis: bas-leads (f6c5e7fd-3719-403d-9bb3-98fd9069c30b)
Cron:         naponta 02:00 UTC (automatikus)
```

**Beépített funkciók:**
- Google Places API → KKV adatok (cím, telefon, weboldal, értékelések)
- Pain score 0-100: elavult weboldal, nincs HTTPS, kevés értékelés, mobilbarát problémák
- Magyar iparág kulcsszavak: fogorvos, kozmetika, fitness, étterem, szakiparos, ingatlan, állatorvos, optika, ügyvéd
- Lead státusz: new → contacted → responded → converted/rejected
- Endpointok: `POST /research`, `GET /research/:jobId`, `GET /leads`, `GET /health`

### `cean-orchestrator` Worker (fő orchestrátor)

```
Binding-ok:
  - KV: BAS_TASKS (b6718ab359ac401bb24da7c34c24f11b)
  - D1: bas-metadata (1c4e7d00-7b09-4ddf-88b4-8df42e1123ab)
  - R2: vodor1
  - Vectorize: brunella-agent-memory
  - Queue producers: bas-task-queue, bas-result-queue
  - Workers AI binding
```

### Cloudflare Erőforrások (`.env`-ből)
- `CF_ACCOUNT_ID` ✅
- `CF_TOKEN`, `CF_API_TOKEN`, `CF_GLOBAL_API_KEY` ✅
- `CLOUDFLARE_D1_WORKER_URL` ✅
- `CLOUDFLARE_TUNNEL_URL`, `CLOUDFLARE_TUNNEL_N8N_URL` ✅
- `D1_API_TOKEN` ✅

---

## 4. .ENV KULCSOK ÁLLAPOTA

### ✅ Megvan és konfigurálva
| Kulcs | Fontosság | Megjegyzés |
|---|---|---|
| `APIFY_TOKEN` | 🔴 KRITIKUS | **DE: agent `APIFY_API_TOKEN`-t keres! → BUG!** |
| `GOOGLE_SHEETS_ID` | 🟡 Magas | CRM tracker → kész |
| `GOOGLE_SHEETS_CREDS` | 🟡 Magas | OAuth credentials |
| `GOOGLE_CLOUD_CREDENTIALS_PATH` | 🟡 Magas | Google API hitelesítés |
| `N8N_API_KEY` | 🔴 KRITIKUS | n8n automatizálás |
| `N8N_SERVER_URL` | 🔴 KRITIKUS | n8n base URL |
| `N8N_WEBHOOK_URL` | 🔴 KRITIKUS | Webhook endpoint |
| `GMAIL_USER` | 🟡 Magas | Email küldés |
| `GMAIL_PASSWORD` | 🟡 Magas | Gmail SMTP |
| `GEMINI_API_KEY` | 🟢 Megvan | LLM copywriting |
| `OPENAI_API_KEY` | 🟢 Megvan | LLM fallback |
| `GITHUB_PAT` | 🟢 Megvan | GitHub integráció |

### ❌ Hiányzó kulcsok
| Kulcs | Fontosság | Megoldás |
|---|---|---|
| `APIFY_API_TOKEN` | 🔴 BUG-FIX | Alias hozzáadása → `APIFY_API_TOKEN=${APIFY_TOKEN}` |
| `BRUNELLA_WEBHOOK_SECRET` | 🔴 KRITIKUS | Generálandó — ld. gaps.md |
| `TYPEFORM_API_KEY` | 🟡 Opcionális | Tally.so (ingyenes) ajánlott alternatíva |
| `GOOGLE_PLACES_API_KEY` | 🟡 Magas | CF Worker-nek kell — wrangler secret put |
| `CLOUDFLARE_ACCESS_CLIENT_ID` | 🟢 Low | Zero-trust, nem blokkoló |

---

## 5. N8N WORKFLOW LEFEDETTSÉG

| Workflow | Státusz | Forrás |
|---|---|---|
| KKV Intake (Typeform → Brunella) | ❌ NEM IMPORTÁLVA | sel.md-ben kész JSON |
| Brand Intake (Typeform → Brunella) | ❌ NEM IMPORTÁLVA | sel.md-ben kész JSON |
| Lead Mining Automation | ❓ Ellenőrzendő | Esetleg már megvan |
| Outreach Approval Gate | ❌ HIÁNYZIK | Human-in-loop kritikus |

**n8n tunnel**: `https://n8n-bas.trycloudflare.com` (jelenleg inaktív)

---

## 6. ÖSSZESÍTETT LEFEDETTSÉG TÁBLÁZAT

| sel.md / sel2.md Funkció | Lefedettség | Mit kell tenni |
|---|---|---|
| **LinkedIn lead-gen pipeline** | 🟡 70% | ApifyScraping APIFY_TOKEN bug fix |
| **KKV pain scoring** | ✅ 100% | CF Lead Intelligence Worker KÉSZ! |
| **Instagram Brand scraping** | 🟡 60% | Apify Instagram actor konfigurálás |
| **CampaignGenerator agent** | ✅ 100% | Megvan, konfigurálni kell |
| **Copywriter agent** | ✅ 100% | Megvan, aktív |
| **Email outreach** | ✅ 90% | EmailAgent + Gmail konfig kész |
| **n8n intake workflow** | ❌ 0% | JSON importálás szükséges |
| **Human-in-loop approval** | ❌ 0% | FÁZIS 1 BLOKKOLÓ |
| **Onboarding form (Typeform)** | ❌ 0% | Tally.so ajánlott |
| **Google Sheets CRM** | ✅ 85% | SheetsSyncAgent + OAuth kész |
| **Upwork profil** | ❌ 0% | Manuális feladat |
| **LinkedIn profil** | ❌ 0% | Manuális feladat |
| **Brand STARTER SOP** | ✅ 80% | Dokumentumban kész |
| **KKV csomagok árazás** | ✅ 100% | sel2.md-ben definiálva |
