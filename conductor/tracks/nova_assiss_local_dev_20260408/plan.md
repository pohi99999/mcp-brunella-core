# Nova Local Dev Hub — Implementációs Terv

## Phase 1: Fejlesztői környezet beállítás ✅ KÉSZ

- [x] `.worktrees/Nova_Assiss/` klónozva (github.com/pohi99999/Nova_Assiss)
- [x] `.gitignore` védi a `.worktrees/` mappát — brunella push-ban nem szerepel
- [x] Conductor track létrehozva (`nova_assiss_local_dev_20260408`)
- [x] Meglévő Nova subtracks összekapcsolva
- [x] `.adal/skills/nova-feature-dev/SKILL.md` skill létrehozva
- [x] `.worktrees/Nova_Assiss/.env` beállítva (OPENAI_API_KEY, TAVILY_API_KEY, GEMINI, GOOGLE)
- [x] `agent/.env` beállítva (OPENAI_API_KEY, OPENAI_CHAT_MODEL_ID)
- [x] `npm install` lefuttatva (968 csomag)

## Phase 2: Architektúra átvizsgálás + kritikus javítások ✅ KÉSZ

- [x] Teljes kódbázis átvizsgálva (2026-04-08)
- [x] **BUG JAVÍTVA:** ChatInterface.tsx thread POST — hiányzó `Content-Type: application/json`
- [x] **E2E TESZTEK JAVÍTVA:** chat.spec.ts, history.spec.ts, ui.spec.ts — törött selectorok javítva
- [x] **ÚJ ENDPOINT:** `/api/documents` (GET: lista forrás szerint; DELETE: összes törlése)
- [x] **KnowledgeModal JAVÍTVA:** valóban listázza a dokumentumokat, törlés gombbal
- [x] **Unit tesztek bővítve:** db.test.ts (9 teszt), embeddings.test.ts (5 teszt)
- [x] Unit tesztek zöldek: `db.test.ts` ✅, `config.test.ts` ✅, `embeddings.test.ts` ✅
- [ ] Python agent üres (`agent/` mappa csak `.env`-t tartalmaz) — következő lépés
- [ ] RAG pipeline end-to-end teszt (`/api/ingest` → `/api/chat`) — `npm run dev` kell

## Phase 3: Feature fejlesztés (subtracks szerint)

- [ ] `nova_knowledge_workflows_20260404` subtrack feladatai
- [ ] `nova_multiagent_gatekeeper_20260404` subtrack feladatai

## Phase 4: Tesztelés

- [ ] `npx tsx src/__tests__/db.test.ts` — LocalVectorDB
- [ ] `npx tsx src/__tests__/config.test.ts` — profile + system-prompt
- [ ] `npx tsx src/__tests__/search.test.ts` — Tavily
- [ ] `npm run test:e2e` — Playwright alap chat flow

## Phase 5: Docker deploy

- [ ] `docker-compose build` — image build
- [ ] `docker-compose up -d` — teljes stack
- [ ] Volume perzisztencia ellenőrzés (documents.json, memories.json megmarad restart után)
- [ ] Production env vars beállítás

---

## Fejlesztési gyors referencia

```bash
# Nova fejlesztés indítása (2 terminál):
cd .worktrees/Nova_Assiss
npm install
npm run dev              # Next.js :3005

# Python agent:
cd .worktrees/Nova_Assiss/agent
uv sync
uv run src/main.py       # Agent :8000

# Teszt:
npx tsx src/__tests__/db.test.ts

# Git műveletek (CSAK Nova remote-ra!):
cd .worktrees/Nova_Assiss
git add .
git commit -m "feat: ..."
git push origin main     # → github.com/pohi99999/Nova_Assiss (NEM brunella!)

# Docker:
docker-compose up -d
```

---

## Subtracks összekötés

A következő trackek mind ehhez a hub trackhez tartoznak:

| Track | Fókusz |
|-------|--------|
| `nova_knowledge_workflows_20260404` | RAG, n8n workflow-k, voice, tudásbázis |
| `nova_multiagent_gatekeeper_20260404` | Multi-agent routing, shared memory, gatekeeper |
