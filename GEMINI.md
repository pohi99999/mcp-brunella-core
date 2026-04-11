# GEMINI.md

> Ez a fájl Gemini CLI (Google) számára tartalmaz ügynök-specifikus instrukciókat.
> **Master dokumentum: `README.md`** — architektúra, API-k, konvenciók részletei OTT vannak.

## Projekt Röviden

**Brunella Agent System (BAS)** — AI multi-agent rendszer, hibrid Node.js/Python, MCP protokoll.
Technológiák: TypeScript ESM, Express 4, React 19, Ollama, Gemini, GitHub Models, FastAPI, Cloudflare Workers.

---

## KÖTELEZŐ Bootstrap (Munkamenet Elején!)

### 1. GitHub Szinkronizálás
```bash
bash scripts/sync.sh              # Git Bash / WSL
# VAGY: scripts\sync.bat (CMD) / .\scripts\sync.ps1 (PowerShell)
```

### 2. Fájlok Beolvasása (3 FÁZIS)

**🟢 FÁZIS 1 — GYORS KONTEXTUS (MINDIG, ~5 perc)**
```
1. .ai/BOOTSTRAP.md              # Projekt összefoglaló (LEGELŐSZÖR!)
2. conductor/tracks.md            # Aktív fejlesztések (mit csinálunk MOST)
3. .ai/FOSZAL.md                  # Mi történt legutóbb? (egyesített napló)
4. .ai/gemini.md                  # Te mit csináltál legutóbb
```

**🟡 FÁZIS 2 — FELADAT-SPECIFIKUS (csak ami releváns)**
- `README.md` → szekciónként (Kód Konvenciók, Architektúra, API, stb.)
- `src/agents/registry.json` — Agent fejlesztésnél (57 agent)
- `conductor/tracks/<id>/plan.md` — Track munkánál
- `package.json` / `tsconfig.json` — Config módosításnál

**🔴 FÁZIS 3 — REFERENCIA (szükség szerint)**
- `PROJEKT_DIAGRAM.md` — Rendszer szintű változásnál
- `TEST_RESULTS.md` — Teszt probléma esetén
- `logs/` — Hiba diagnózisnál

### 3. Rendszer Validáció
```bash
npm run build                 # TypeScript fordítás (MUSZÁJ OK!)
npm run test:fast             # ⚡ Gyors tesztek (~1-2 perc) — napi munka, commit előtt
npm test                      # 🔒 Teljes suite (~10 perc) — track lezárás / push előtt
```

**Ha BUILD FAIL vagy TESZT FAIL → NE kezdj fejlesztésbe! Javítsd először!**

---

## Gyors Parancs Referencia

```bash
# Build & Run
npm run build        # TypeScript fordítás
npm run dev          # MCP stdio + Express :3000
npm run dev:ui       # Vite Dashboard :5173
npm run lint         # ESLint (max-warnings=0)
npm run smoke        # Health check (Ollama, Express, FastAPI)
start-full.bat       # Teljes rendszer (Windows)

# Tesztelés
npm run test:fast                     # Gyors tesztek (~1-2 perc)
npm test                              # Build + Vitest run (teljes)
npx vitest run test/foo.test.ts       # Egy teszt fájl
npm run test:watch                    # Watch mód
npm run test:e2e                      # Playwright e2e

# CLI
brunella                  # Interaktív menü
brunella chat             # Chat
brunella agents           # Ügynökök listája
brunella conductor status # Projekt státusz

# Python alrendszer
cd myai && uv sync                          # Függőségek
uvicorn server:app --reload --port 8000     # FastAPI

# Szinkronizálás
python scripts/sync_foszal.py  # .ai/FOSZAL.md frissítése munka után
```

> 📋 Teljes parancslista: `README.md` → "Build, Test, Lint" és "CLI Parancsok" szekciók.

---

## Kód Konvenciók (Összefoglaló)

> 📋 Részletes minták és példák: `README.md` → "Kód Konvenciók" szekció.

**Kritikus szabályok:**
- **ESM `.js` kiterjesztés KÖTELEZŐ:** `import { foo } from './bar.js'`
- **`any` TILOS** — használj `unknown` + type guard
- **`console.log` TILOS** — használd `logInfo()` / `logError()` / `Logger` osztályt
- **Agent `finally` KÖTELEZŐ:** `setAgentStatus(this.name, 'idle')` mindig legyen finally-ban
- **Vitest (NE Jest!):** `vi.fn()`, `vi.mock()`, `vi.spyOn()`
- **Track lezárásnál VÖRÖS PROTOKOLL:** `git commit --no-verify` / `git push --no-verify` TILOS; `completed` vagy `archived` státusz csak érvényes `dod` blokk mellett adható meg (`tests_pass=true`, `build_clean=true`, `code_committed=true`, `no_verify_used=false`), plusz `verificationNotes` / `archiveReason` kötelező
- **Előzmény track kiváltása:** ha egy régi scope-ot későbbi, validált track ténylegesen lefed, az előzmény maradhat `archived` `supersededByTracks` mezővel. Ez nem `completed`, és nem szabad hamis DoD-vel lezárni.

**Commit:** Conventional Commits — `feat(scope): subject`, `fix(scope): subject`

---

## Gemini-Specifikus Koordináció

### Munkamenet Napló (.ai/gemini.md)

**Munkamenet végén** add hozzá `.ai/gemini.md`-be:
```markdown
### YYYY-MM-DD HH:MM - [Rövid cím]
**Feladat:** Mit csináltál
**Érintett fájlok:** fájl1.ts, fájl2.ts
**Státusz:** ✅ Befejezve / ⏳ Folyamatban
**Megjegyzés:** Info a következő ügynöknek
```
Majd: `python scripts/sync_foszal.py`

### Glass Box Filozófia

**Magyarázd el MIÉRT** csinálsz valamit, mielőtt megteszed. Ha hibát találsz, mondd el a gyökér okát.

---

## Fejlesztési Workflow Összefoglaló

> 📋 Részletek: `README.md` → "EPP v2", "Track Rendszer", "Agent Implementáció" szekciók.

- **Track életciklus:** PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED
- **0-Hiba Stratégia:** `npm run build` + `npm run test:fast` MUSZÁJ PASS commit előtt
- **EPP v2 6. szabály:** Minden új funkció = Dashboard + CLI is KÖTELEZŐ
- **Új agent:** IAgent/BaseAgent implementáció + `registry.json` regisztráció + tesztek
- **Meta-only lezárás TILOS:** conductor metadata önmagában nem elég; a lezáró commitnak valódi repo-változást is tartalmaznia kell

---

## Környezeti Változók (.env)

> 📋 Részletes lista: `README.md` → "Environment Variables" szekció.

**KÖTELEZŐ:**
```env
OLLAMA_BASE_URL=http://localhost:11434
BRUNELLA_WORKSPACE_ROOT=.
```

**Legfontosabb LLM providerek:**
```env
OLLAMA_MODEL=qwen2.5-coder:7b    # Alapértelmezett (felülírható)
GEMINI_API_KEY=...                # Gemini
GITHUB_PAT=...                   # GitHub Models — prioritás GITHUB_TOKEN előtt!
ANTHROPIC_API_KEY=...            # Claude (Bifrost Gateway)
```

---

## Gyakori Hibák

> 📋 Teljes hibaelhárítási táblázat: `README.md` → "Hibaelhárítás" szekció.

| Probléma | Megoldás |
|----------|----------|
| `ERR_MODULE_NOT_FOUND` | Import hiányzó `.js` kiterjesztés → add hozzá |
| BUILD FAIL | `rmdir /s /q build && npm run build` |
| Ollama nem elérhető | `ollama serve` futtatása |
| Agent "stuck" | Phoenix auto-retry, kézi: `setAgentStatus(name, 'idle')` |
| GitHub Models 401 | `GITHUB_PAT` lejárt — frissítsd |

---

## Védett Fájlok — SOHA NE TÖRÖLD!

`src/index.ts`, `src/cli.ts`, `src/agents/types.ts`, `src/agents/registry.json`, `src/server/web.ts`, `src/server/registry.ts`, `src/core/llm_client.ts`

**Ha "takarítani" akarsz — KÉRDEZZ ELŐSZÖR!**

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
