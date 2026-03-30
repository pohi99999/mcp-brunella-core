# 🤖 BRUNELLA PROJECT BOOTSTRAP
**MINDEN AI ÜGYNÖK: OLVASD EL INDULÁSKOR! (5 perc)**

---

## ⚡ GYORS TÁJÉKOZÓDÁS (Ha új vagy vagy nem emlékszel)

**3 KÖTELEZŐ FÁJL (sorrendben):**
1. **README.md** - Projekt áttekintés (mi ez, hogyan működik, quickstart)
2. **.ai/FOSZAL.md** - Mi történt LEGUTÓBB? (időrendi napló, MINDEN ügynök munkája)
3. **conductor/tracks.md** - Aktív fejlesztések (mit csinálunk MOST)

**PLUSZ (ha te vagy az ügynök):**
- **Claude:** `.ai/claude.md` (te mit csináltál legutóbb)
- **Gemini:** `.ai/gemini.md` (te mit csináltál legutóbb)
- **Copilot:** `.ai/copilot.md` (te mit csináltál legutóbb)
- **Cursor:** `.ai/cursor.md` (te mit csináltál legutóbb)

---

## 🎯 MI EZ A PROJEKT? (A KÜLDETÉS)

**Brunella Agent System (BAS)** - Multi-agent AI rendszer **valódi problémák** megoldására.

### ❌ NEM:
- Chatbot demo
- Játék projekt
- "Hello World" AI kísérlet

### ✅ HANEM:
- **AI mint PARTNER**, nem eszköz
- **Ember + AI együtt** = 10x produktivitás
- **Valódi problémák**, valódi megoldások
- **Példa arra** hogy milyen potenciál van az AI-ban
- **Pozitív AI kép** formálása (AI segít, nem fenyeget)

---

## 🏗️ ARCHITEKTÚRA (Gyors összefoglaló)

```
┌─────────────────────────────────────────────────────┐
│               BRUNELLA AGENT SYSTEM                 │
├─────────────────────────────────────────────────────┤
│  NODE.JS BACKEND (TypeScript)                       │
│  ├─ Express API (port 3000)                         │
│  ├─ Socket.IO (WebSocket)                           │
│  ├─ MCP Server (StdioServerTransport)               │
│  └─ 58 AI Agents (IAgent interface)                 │
│                                                      │
│  PYTHON SUBSYSTEM (FastAPI)                         │
│  ├─ FastAPI server (port 8000)                      │
│  ├─ Browser automation (Playwright + Browser-Use)   │
│  ├─ Data processing (LanceDB, ChromaDB)             │
│  └─ ML/AI utilities                                 │
│                                                      │
│  DASHBOARD (React + Vite)                           │
│  ├─ Mission Control UI (port 5173)                  │
│  ├─ Agent monitoring                                │
│  ├─ Task queue management                           │
│  └─ Real-time chat interface                        │
│                                                      │
│  CLOUDFLARE EDGE                                    │
│  ├─ 6 Deployed Workers (orchestrator, webhooks)     │
│  ├─ AI Gateway (cache, rate limit, fallback)        │
│  ├─ Tunnel (Ollama + FastAPI exposed)               │
│  └─ Storage (R2, D1, KV, Vectorize, DO)             │
└─────────────────────────────────────────────────────┘
```

**LLM Providers:**
- **Ollama** (lokális, 18 modell): llama3.1, qwen2.5-coder, deepseek-coder, stb.
- **Gemini** (Google): gemini-2.5-flash (alapértelmezett, schema.ts)
- **GitHub Models** (Copilot Pro+): GPT-4o (korlátlan)
- **Anthropic** (Claude): claude-sonnet-4-20250514
- **Cloudflare Workers AI**: @cf/meta/llama-3.1-8b-instruct
- **Bifrost Gateway**: Auto provider-select, fallback chain, userId preferenciák

---

<!-- DOC_STATS_START -->
## 📊 Auto-generated projekt statisztikák

- Agent registry entries: **58**
- Route modulok a `src/server/routes/` alatt: **69**
- Aktív route mountok a központi routerben: **59**
- MCP tool fájlok a `src/tools/` alatt: **33**
- Detektált MCP tool definíciók / regisztrációk: **4**
- CLI parancs deklarációk: **211**
- Dashboard navigációs panelek: **75**

> Ezt a blokkot a `npm run sync:doc-stats` generálja.
<!-- DOC_STATS_END -->

## 📂 HOL VANNAK A FONTOS DOLGOK?

### Kód
- `src/agents/` - 58 AI ügynök (OrchestratorAgent, DeveloperAgent, stb.)
- `src/server/` - Backend API + MCP registry (69 route fájl)
- `src/core/` - Model Router, Bifrost Gateway, Observability, Phoenix Protocol
- `src/dashboard/` - React UI komponensek (Radix UI + Tailwind v4)
- `src/tools/` - MCP tool definíciók
- `src/utils/` - Logger, RAG, Python shell, Zod Bridge, stb.

### Dokumentáció
- `README.md` - **MASTER DOKUMENTUM** (kezdd itt!)
- `CLAUDE.md` / `GEMINI.md` - Ügynök-specifikus útmutatók
- `conductor/` - Projekt menedzsment (tracks, workflow)
- `docs/` - Részletes dokumentációk (Cloudflare, Agent Permissions, stb.)
- `.ai/` - Ügynök naplók (claude.md, gemini.md, copilot.md, FOSZAL.md)

### Python
- `myai/` - Python subsystem root
- `myai/agents/` - Python-based agents (tech_harvester, stb.)
- `myai/tools/` - Python utilities (knowledge_integrator, harvest_pipeline)
- `myai/server.py` - FastAPI server

### Conductor (Projekt menedzsment)
- `conductor/tracks.md` - **Aktív track-ek** (mit csinálunk MOST)
- `conductor/tracks/` - Track részletek (spec, plan, meta)
- `conductor/workflow.md` - Data Flywheel, Phoenix Protocol

---

## 🚀 GYORS START (Ha új fejlesztést kezdesz)

### 1. Tájékozódj (5 perc)
```bash
# Mi történt LEGUTÓBB?
cat .ai/FOSZAL.md | tail -100

# Aktív track-ek
cat conductor/tracks.md

# Te mit csináltál utoljára?
cat .ai/claude.md | head -50   # vagy gemini.md, copilot.md
```

### 2. Ellenőrizd a rendszert
```bash
# Git status (van-e uncommitted módosítás?)
git status

# Backend fut? (port 3000)
curl http://localhost:3000/api/health

# Python subsystem fut? (port 8000)
curl http://localhost:8000/health
```

### 3. Build + Test (ha kód változott)
```bash
npm run build    # TypeScript fordítás
npm test         # Vitest tesztek (KÖTELEZŐ zöld!)
```

### 4. Munkamenet VÉGÉN (NE FELEJTSD!)
```bash
# 1. Frissítsd a saját naplódat
# .ai/claude.md VAGY .ai/gemini.md VAGY .ai/copilot.md

# 2. Futtasd a FOSZAL sync-et
python scripts/sync_foszal.py

# 3. Git commit
git add -A
git commit -m "feat: rövid leírás"
git push origin main
```

---

## 📋 AKTÍV TRACK-EK (JELENLEGI PRIORITÁSOK)

**Lásd:** `conductor/tracks.md` (automatikusan frissül)

**Top 3 prioritás (2026-03-25):**
1. **LLM Observability** - Provider monitoring, latencia, token tracking (✅ KÉSZ)
2. **User Preferences** - Felhasználói LLM/nyelv/stílus beállítások (✅ KÉSZ)
3. **Crawl4AI Integration** - Intelligens webcrawling (✅ KÉSZ)

**Következő:**
- E2B Sandbox Crawl4AI izolálás
- Golden Dataset bővítés (fine-tuning)
- WebSocket bővítés további panelekhez

---

## ⚠️ FONTOS SZABÁLYOK (NE TÖRD MEG!)

### 1. VÉDETT FÁJLOK (NE TÖRÖLD!)
```
.env
src/agents/registry.json
conductor/tracks.md
package.json
tsconfig.json
.ai/FOSZAL.md
.ai/*.md (ügynök naplók)
```

### 2. GIT WORKFLOW
```bash
# MINDIG pull ELŐSZÖR (sync remote)
git pull origin main

# AZTÁN commit + push
git add -A
git commit -m "üzenet"
git push origin main
```

### 3. TESZTEK (0-Hiba Stratégia)
```bash
# Build MUSZÁJ OK:
npm run build   # 0 TypeScript error

# Tesztek MUSZÁJ PASS:
npm test        # 100% pass rate (vagy ~99% ha LLM mock fail)
```

### 4. LOGGING (console.log TILOS!)
```typescript
// ❌ ROSSZ
console.log("debug info");

// ✅ JÓ
import { logInfo, logError } from '../utils/logger.js';
logInfo('AgentName', 'debug info');
```

### 5. IMPORTS (ESM + .js kiterjesztés)
```typescript
// ❌ ROSSZ
import { foo } from './bar';

// ✅ JÓ
import { foo } from './bar.js';
```

---

## 🎯 A KÜLDETÉS (MIÉRT FONTOS EZ)

**Felhasználó vízió:**
> "Olyan rendszert alkotni amit a Mesterséges Intelligencia és az ember képességei egymást erősítve olyan termelékenységet és innovációs átalakulást ér el ami elősegíti az AI képét pozitív megítélésre és az ember gondolkodásának megváltoztatására is hatással van."

**Értsd meg:**
- Ez NEM "kis ügynökösdis játék"
- Ez egy **PÉLDA** arra hogy milyen potenciál van az AI-ban
- AI **PARTNER**, nem chatbot
- **Valódi problémák**, valódi megoldások
- **Pozitív AI kép** - AI segít, nem fenyeget

**Felhasználó helyzet:**
- 18 óra/nap munka, 1+ éve
- Pénz nulla, csak a gép van
- Csőd szélén
- **NEM ADJA FEL**

**Te (AI ügynök) felelőssége:**
- **Minőségi munka** (ne kódolj vakon!)
- **Teljes context** (olvasd be a fájlokat!)
- **Kommunikáció** (ha nem érted, kérdezz!)
- **Támogatás** (ne hagyd magára!)

---

## 🤝 EGYÜTTMŰKÖDÉS (Multi-Agent Koordináció)

**Aktív ügynökök:**
- **Claude Code** (claude.ai/code) - Elsődleges fejlesztő
- **Gemini CLI** (Google) - Alternatív fejlesztő
- **GitHub Copilot** (VS Code) - Code completion + chat
- **Jules** (jules.google.com) - Aszinkron ügynök (100 session/nap)
- **Cursor** (cursor.sh) - AI-powered editor

**Kommunikáció:**
- **FOSZAL.md** - Központi napló (időrendi, minden ügynök)
- **Saját napló** - `.ai/claude.md`, `.ai/gemini.md`, stb.
- **Conductor** - Track rendszer (ki dolgozik min)

**Workflow:**
1. Induláskor: Olvasd be BOOTSTRAP.md (ezt a fájlt!)
2. Tájékozódj: README.md + FOSZAL.md + tracks.md
3. Dolgozz: Implementálj, tesztelj, dokumentálj
4. Munkamenet vége: Frissítsd a naplót, sync FOSZAL, git commit

---

## 📞 HA ELAKADTÁL

### Kérdések
- **Mi a projekt célja?** → Lásd "A KÜLDETÉS" szekció
- **Hol tartunk?** → `.ai/FOSZAL.md` (utolsó 100 sor)
- **Mit csináljak?** → `conductor/tracks.md` (aktív track-ek)
- **Hogyan működik X?** → `README.md` vagy `docs/` mappa

### Hibák
- **Build error** → `npm run build` kimenet + kérdezz
- **Test fail** → `npm test` kimenet + kérdezz
- **Git conflict** → Ne pánikol, kérdezz segítséget

### Kommunikáció
- **Claude Code chat** - Kérdezz bátran
- **FOSZAL.md** - Írd be mi a probléma (más ügynökök látják)
- **Git commit message** - Részletes leírás

---

## ✅ CHECKLIST (Minden munkamenet ELEJÉN)

```bash
□ BOOTSTRAP.md beolvasva ✓ (ezt olvasod most)
□ README.md beolvasva
□ .ai/FOSZAL.md utolsó 100 sor beolvasva
□ conductor/tracks.md beolvasva
□ .ai/claude.md (vagy gemini.md) beolvasva (mi volt az utolsó munkád?)
□ git status ellenőrizve
□ Backend health check (port 3000)
□ Python health check (port 8000)
```

---

## 🎉 KÉSZ VAGY!

Most már tudod:
- ✅ Mi a projekt (Brunella Agent System)
- ✅ Mi a küldetés (AI mint partner, valódi problémák)
- ✅ Hol vannak a fájlok (src/, myai/, conductor/, .ai/)
- ✅ Mit kell beolvasni (README, FOSZAL, tracks)
- ✅ Hogyan dolgozz (build → test → commit)
- ✅ Mire figyelj (védett fájlok, git workflow, logging)

**Következő lépés:**
1. Olvasd be a 3 KÖTELEZŐ fájlt (README, FOSZAL, tracks)
2. Kezdj dolgozni a legfontosabb track-en
3. Ha elakadsz → kérdezz!

**Hajrá! 🚀**

---

**Verzió:** 2.4.0
**Utolsó frissítés:** 2026-03-25
**Tulajdonos:** Pohánka Péter
**Ügynök:** [Te vagy - Claude / Gemini / Copilot / Jules / Cursor]
