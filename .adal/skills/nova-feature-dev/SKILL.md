---
name: nova-feature-dev
description: Nova Irodai Asszisztens feature fejlesztési útmutató. Használd amikor Nova_Assiss projektben új feature-t fejlesztesz, bug-ot javítasz, vagy a RAG pipeline-t módosítod. Végigvezet a spec → implementáció → teszt → commit cikluson, Nova-specifikus szabályokkal.
---

# Nova Feature-Dev

Nova Irodai Asszisztens (Next.js 15 + Python FastAPI) feature fejlesztési workflow.

**Repo:** `.worktrees/Nova_Assiss/` — KÜLÖN git repo, NEM a brunella!

---

## 1. Session Indítás — Kötelező Ellenőrzések

Mielőtt bármit csinálsz, ellenőrizd:

```bash
# Working directory
cd F:/mcp-brunella-core/.worktrees/Nova_Assiss

# .env.local megvan?
ls .env.local  # Ha nincs → hozd létre (lásd lent)

# Függőségek telepítve?
ls node_modules || npm install

# Python agent függőségek?
cd agent && ls .venv || uv sync && cd ..
```

**.env.local minimális tartalom:**
```env
OPENAI_API_KEY=sk-...
TAVILY_API_KEY=tvly-...
```

**Szerverek indítása (2 terminál):**
```bash
# 1. terminál — Next.js :3005
npm run dev

# 2. terminál — Python agent :8000
cd agent && uv run src/main.py
```

**Gyors egészség-ellenőrzés:**
```bash
curl http://localhost:3005/api/health 2>/dev/null || echo "Next.js nem fut!"
curl http://localhost:8000/health 2>/dev/null || echo "Python agent nem fut!"
```

---

## 2. Feature Fejlesztési Ciklus

```
SPEC → IMPLEMENTÁCIÓ → TESZT → COMMIT
```

### Lépés 1 — Spec

Mielőtt kódot írsz, rögzítsd:
- Mit csinál az új feature?
- Melyik fájl(oka)t érinti? (`src/app/api/`, `src/lib/`, `src/components/`)
- Érinti-e a RAG pipeline-t? (ha igen → extra óvatosság!)
- Érinti-e a LocalVectorDB sémát? (ha igen → migráció kell)

### Lépés 2 — Implementáció

**Nova architektúra gyors referencia:**

| Fájl | Felelősség |
|------|-----------|
| `src/app/api/chat/route.ts` | Fő RAG pipeline — embedding → keresés → GPT-4o stream |
| `src/app/api/ingest/route.ts` | Dokumentum betöltés (PDF/TXT/MD/CSV chunking + embedding) |
| `src/app/api/tts/route.ts` | OpenAI TTS (nova hang) |
| `src/app/api/memories/route.ts` | Tárolt tények listázása |
| `src/lib/db.ts` | LocalVectorDB singleton — cosine similarity |
| `src/lib/embeddings.ts` | OpenAI text-embedding-3-small |
| `src/lib/config.ts` | profile.json + system-prompt.md betöltés |
| `src/lib/search.ts` | Tavily web search |

**LocalVectorDB séma (NE változtasd meg törés nélkül):**
```typescript
// data/documents.json
interface Document {
  id: string;
  content: string;
  embedding: number[];
  metadata: { source: string; timestamp: string; type: string };
}

// data/memories.json
interface Memory {
  id: string;
  fact: string;
  embedding: number[];
  createdAt: string;
}
```

### Lépés 3 — Tesztek

Feature-nként kötelező (sorrendben futtatni):

```bash
# 1. LocalVectorDB
npx tsx src/__tests__/db.test.ts

# 2. Config (profile + system-prompt)
npx tsx src/__tests__/config.test.ts

# 3. Tavily web search
npx tsx src/__tests__/search.test.ts

# 4. Playwright E2E — alap chat flow
npm run test:e2e
```

**Ha bármelyik teszt piros → NE commitolj! Javítsd először.**

### Lépés 4 — Commit (FONTOS!)

```bash
cd F:/mcp-brunella-core/.worktrees/Nova_Assiss

git add .
git commit -m "feat(nova): <mit csináltál magyarul>"

# CSAK a Nova remote-ra!
git push origin main   # → github.com/pohi99999/Nova_Assiss

# ❌ SOHA nem:
# git push   (ha a brunella remote be lenne állítva)
```

---

## 3. Nova-Specifikus Szabályok

### Magyar nyelv
Minden user-facing szöveg, hibaüzenet, log **magyarul**. Kódban a változónevek/függvénynevek maradhatnak angolul.

### RAG Pipeline Integritás
A `src/lib/db.ts` `addDocument()` → `search()` → `cosine similarity` lánc **soha nem törhet el**. Ha módosítod, futtasd le az összes tesztet és manuálisan is ellenőrizd `/api/chat`-en.

### API Route Konvenciók
- Minden route-ban: `export async function POST/GET(request: Request)`
- Streaming response: `new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } })`
- Hibakezelés: mindig `try/catch`, magyar hibaüzenet a response-ban

### Git Izoláció
A `.worktrees/Nova_Assiss/` egy teljesen külön git repo. A brunella `.gitignore` védi. **Minden commit és push kizárólag a Nova remote-ra megy.**

---

## 4. Hasznos Parancsok

```bash
# Nova log figyelés (Next.js)
# → a terminálban ahol npm run dev fut

# Data fájlok ellenőrzése
cat .worktrees/Nova_Assiss/data/documents.json | python -m json.tool | head -50
cat .worktrees/Nova_Assiss/data/memories.json | python -m json.tool | head -30

# Nova git állapot
cd .worktrees/Nova_Assiss && git log --oneline -10

# Docker (ha szükséges — Phase 5)
docker-compose build
docker-compose up -d
docker-compose logs -f
```

---

## 5. Hibaelhárítás

| Probléma | Megoldás |
|----------|----------|
| `OPENAI_API_KEY` nincs | `.env.local` fájl létrehozása a projekt gyökerében |
| Port 3005 foglalt | `kill $(lsof -t -i:3005)` vagy Windows: Task Manager |
| Python agent nem indul | `cd agent && uv sync` újra, majd `uv run src/main.py` |
| LocalVectorDB üres | `curl -X POST localhost:3005/api/ingest` tesztfájllal |
| Cosine similarity 0 | Embedding API hiba — ellenőrizd az OPENAI_API_KEY-t |
| Tavily nem válaszol | `TAVILY_API_KEY` hiányzik vagy lejárt `.env.local`-ban |
| E2E teszt timeout | `npm run dev` fut? Playwright base URL `:3005`? |

---

## 6. Subtracks Referencia

Ez a skill a `nova_assiss_local_dev_20260408` hub track alatt fut.

| Subtrack | Fókusz | Mikor releváns |
|----------|--------|----------------|
| `nova_knowledge_workflows_20260404` | RAG, n8n workflow, voice, tudásbázis | Knowledge management fejlesztésnél |
| `nova_multiagent_gatekeeper_20260404` | Multi-agent routing, shared memory | Agent orchestráció fejlesztésnél |

---

## 7. Elfogadási Kritériumok (Definition of Done)

Egy feature akkor kész, ha:
- [ ] `npm run dev` + `npm run dev:agent` párhuzamosan fut
- [ ] `/api/chat` válaszol (RAG pipeline él)
- [ ] Minden teszt zöld (`db`, `config`, `search`, `e2e`)
- [ ] Commit üzenet: `feat(nova): ...` (magyarul)
- [ ] Push: Nova remote-ra ment (nem brunella!)
