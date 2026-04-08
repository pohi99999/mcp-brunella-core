# Nova Feature-Dev Skill — Design Doc

**Dátum:** 2026-04-08  
**Track:** `nova_assiss_local_dev_20260408`  
**Státusz:** Jóváhagyott

---

## Összefoglalás

Egy Claude Code skill fájl (`.adal/skills/nova-feature-dev/SKILL.md`), amely végigvezeti a fejlesztőt a Nova Irodai Asszisztens feature-fejlesztési ciklusán. Fókusz: lokális fejlesztés, spec → implementáció → teszt → commit a Nova saját remote-jára.

---

## Megközelítés

**A) Claude Code skill fájl** — kiválasztva.

Indoklás: egyszerű, azonnal használható, könnyen karbantartható. A "local-first" prioritáshoz tökéletesen illeszkedik. Deploy/hosting fázisra bővíthető később.

---

## Skill struktúra

**Fájl:** `.adal/skills/nova-feature-dev/SKILL.md`

### 1. Kontextus betöltés (session start)

Minden session elején ellenőrzendő:
- Working directory: `.worktrees/Nova_Assiss/`
- `.env.local` megvan: `OPENAI_API_KEY`, `TAVILY_API_KEY`
- `npm run dev` fut `:3005`-ön
- Python agent fut `:8000`-en (`uv run src/main.py`)

### 2. Feature fejlesztési ciklus

```
1. Spec  →  2. Implementáció  →  3. Lokális teszt  →  4. Commit (Nova remote!)
```

### 3. Nova-specifikus szabályok

- **Magyar nyelv:** minden user-facing szöveg, log, prompt magyarul
- **RAG pipeline integritás:** `src/lib/db.ts` LocalVectorDB contract nem törhet el
- **LocalVectorDB séma:** `data/documents.json` + `data/memories.json` formátum stabil
- **API route konvenciók:** `src/app/api/` — minden route TypeScript, streaming response ahol kell
- **Git izoláció:** CSAK `git push origin main` a Nova remote-ra (`github.com/pohi99999/Nova_Assiss`) — SOHA nem a brunella repóba!
- **Portok:** Next.js `:3005`, Python agent `:8000`

### 4. Teszt checklist

Feature-nként kötelező futtatni (sorrend szerint):
1. `npx tsx src/__tests__/db.test.ts` — LocalVectorDB
2. `npx tsx src/__tests__/config.test.ts` — profile + system-prompt
3. `npx tsx src/__tests__/search.test.ts` — Tavily
4. `npm run test:e2e` — Playwright alap chat flow

### 5. Commit template

```
feat(nova): <mit csináltál magyarul>
```

```bash
cd .worktrees/Nova_Assiss
git add .
git commit -m "feat(nova): ..."
git push origin main   # → github.com/pohi99999/Nova_Assiss (NEM brunella!)
```

---

## Scope (nem fedi le)

- Docker deploy / production hardening (deferred)
- Hosting / cloud deploy (deferred)
- Multi-agent gatekeeper workflow (külön subtrack: `nova_multiagent_gatekeeper_20260404`)
- n8n workflow integráció (külön subtrack: `nova_knowledge_workflows_20260404`)

---

## Bővítési irányok (later)

- B) brunella CLI parancsok (`brunella nova dev`, `brunella nova test`)
- C) ADAL plugin + agent orchestráció (Phase 3-4 után)
