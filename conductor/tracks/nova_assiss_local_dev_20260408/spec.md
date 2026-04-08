# Nova Irodai Asszisztens — Helyi Fejlesztési Hub

**Track ID:** `nova_assiss_local_dev_20260408`
**Szülő projekt:** Nova v3.0 (Sólyom Daru Kft.)
**Forráskód:** `.worktrees/Nova_Assiss/` (külön git repo: `https://github.com/pohi99999/Nova_Assiss.git`)

---

## Összefoglalás

A Nova egy proaktív, magyar nyelvű AI irodai asszisztens Next.js 15 + Python FastAPI hibrid architektúrával. Ez a conductor track a teljes helyi fejlesztési folyamatot koordinálja — az összes Nova-s subtrack ehhez tartozik.

> **Fontos:** A `.worktrees/Nova_Assiss/` mappa KÜLÖN git repo. A `.gitignore` védi, nem kerül a brunella repóba. Minden commit/push a Nova repo saját remote-jára (`github.com/pohi99999/Nova_Assiss`) megy.

---

## Jelenlegi architektúra

### Frontend (Next.js 15)
- `src/app/api/chat/route.ts` — Fő RAG pipeline (embedding → keresés → web search döntés → GPT-4o stream)
- `src/app/api/ingest/route.ts` — Dokumentum betöltés (PDF/TXT/MD/CSV chunking + embedding)
- `src/app/api/tts/route.ts` — OpenAI TTS (nova hang)
- `src/app/api/memories/route.ts` — Tárolt tények listázása
- `src/lib/db.ts` — LocalVectorDB singleton (JSON alapú, cosine similarity)
- `src/lib/embeddings.ts` — OpenAI text-embedding-3-small
- `src/lib/config.ts` — profile.json + system-prompt.md betöltés
- `src/lib/search.ts` — Tavily web search

### Python Agent (`agent/`)
- Microsoft AG-UI protokoll implementáció
- `uv` package manager (Python 3.12+)
- Port: 8000

### Deployment
- Docker Compose alapú
- LocalVectorDB adatok Docker Volume-on perzisztálva

---

## Subtracks (kapcsolódó trackek)

| Track ID | Név | Státusz |
|----------|-----|---------|
| `nova_knowledge_workflows_20260404` | Nova tudásbázis és interakciós workflow-k | active |
| `nova_multiagent_gatekeeper_20260404` | Nova multi-agent gatekeeper architektúra | active |

---

## Fejlesztési elvek (Nova-specifikus)

1. **Magyar nyelv először** — minden user-facing szöveg, log, prompt magyarul
2. **RAG pipeline integritás** — az embedding + cosine similarity lánc nem törhet el
3. **Agent/frontend izoláció** — a Python agent és a Next.js API routes között csak HTTP
4. **Nincs brunella push** — a `.worktrees/` mappa gitignore-olva, commitok a Nova remote-ra mennek
5. **Környezeti változók** — `.env.local` a Next.js-nek, `agent/.env` a Python agentnek

---

## Elfogadási kritériumok

- [ ] `npm run dev` + `npm run dev:agent` párhuzamosan fut, `/api/chat` válaszol
- [ ] RAG pipeline: PDF/TXT ingest → embedding → keresés → GPT-4o válasz
- [ ] Memories: tény kinyerés + visszakeresés működik
- [ ] TTS: OpenAI nova hang lejátszható
- [ ] Docker Compose: `docker-compose up -d` teljes stack elindítja
- [ ] Playwright E2E: alap chat flow átmegy
