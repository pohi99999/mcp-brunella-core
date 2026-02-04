# Copilot CLI - Folytatandó Feladatok

**Projekt:** Brunella Agent System (BAS)
**Generálva:** 2026-02-04
**Készítette:** Claude Code (Opus 4.5)

---

## Kontextus

A Brunella Agent System egy AI multi-agent rendszer, amely automatizálja a szoftverfejlesztést lokális LLM-ekkel (Ollama), MCP protokollal és hibrid Node.js/Python architektúrával.

**Elvégzett javítások:**
- Agent interfész konzisztencia (IAgent vs BaseAgent)
- DynamicAgent konstruktor fix
- LLM client hardening (timeout, Content-Type, HTTP status check)
- Dashboard iframe security
- GitHub workflow SQL injection védelem
- Socket.IO error handlers
- API request timeouts

---

## Prioritás 1: RAG Vector Embeddings Implementálása

**Fájl:** `src/utils/rag.ts`

**Probléma:** A LanceDB jelenleg NEM használ valódi vector embedding-et. Csak substring keresés van implementálva, ami nem igazi RAG.

**Feladat:**
1. Integrálj Ollama embedding API-t (`/api/embeddings` endpoint)
2. Az `addToIndex()` függvényben generálj embedding-et a szöveghez
3. A `searchRAG()` függvényben vector similarity search-öt használj

**Példa implementáció:**
```typescript
// Ollama embedding hívás
async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'nomic-embed-text', prompt: text })
  });
  const data = await response.json();
  return data.embedding;
}

// addToIndex módosítás
export async function addToIndex(title: string, content: string, metadata?: Record<string, any>): Promise<void> {
  const db = await lancedb.connect(LANCEDB_PATH);
  const embedding = await getEmbedding(content);
  // ... LanceDB insert with embedding vector
}
```

**Teszt:** `npm test -- test/rag.test.ts`

---

## Prioritás 2: CONDUCTOR_MANIFEST.md Refaktorálás

**Fájl:** `conductor/CONDUCTOR_MANIFEST.md`

**Probléma:** A fájl 1200+ soros, kaotikus AI chat history keveredik benne formális dokumentációval.

**Feladat:**
1. Hozz létre `conductor/archive/` mappát
2. Mozgasd az AI chat history-t `conductor/archive/ai_session_notes_2026.md`-be
3. Tisztítsd meg a CONDUCTOR_MANIFEST.md-t:
   - Csak aktuális állapot
   - Strukturált szekciók (Célok, Komponensek, Változások)
   - Maximum 200 sor

**Struktúra minta:**
```markdown
# Conductor Manifest

## Aktív Komponensek
- ProjectConductorAgent (80% kész)
- Track rendszer (működik)

## Következő Lépések
1. CLI integráció befejezése
2. Pre-commit hook beállítása

## Változásnapló
- 2026-02-04: Manifest refaktorálás
```

---

## Prioritás 3: ProjectConductor CLI Integráció

**Fájlok:**
- `src/cli.ts`
- `src/agents/ProjectConductorAgent.ts`

**Probléma:** A `brunella conductor status` parancs nincs bekötve.

**Feladat:**
1. A CLI-ben add hozzá a `conductor` subcommand-ot
2. Delegálj a ProjectConductorAgent-nek
3. Támogatott parancsok: `status`, `sync`, `health`, `track create <name>`

**Kód helye:** `src/cli.ts` ~150. sor körül, a parancs routing résznél

---

## Prioritás 4: Gemini Workflow Timeout Bővítés

**Fájlok:**
- `.github/workflows/gemini-review.yml`
- `.github/workflows/gemini-triage.yml`
- `.github/workflows/gemini-scheduled-triage.yml`

**Feladat:** Add hozzá `timeout-minutes: 15` mindegyik job-hoz (mint a gemini-invoke.yml-ben már megvan).

---

## Prioritás 5: Secrets Validáció Workflow-kban

**Fájl:** `.github/workflows/*.yml`

**Feladat:** Add hozzá secrets létezés ellenőrzést a workflow-k elejére:

```yaml
- name: Validate secrets
  run: |
    if [ -z "${{ secrets.CLOUDFLARE_API_TOKEN }}" ]; then
      echo "::error::CLOUDFLARE_API_TOKEN secret is not set"
      exit 1
    fi
```

---

## Ellenőrzés

Minden változtatás után:
```bash
npm run build          # TypeScript compile
npm test               # Vitest tesztek
npm run dev            # Funkcionális teszt
```

---

## Kapcsolódó Dokumentáció

- `CLAUDE.md` - Projekt áttekintés
- `conductor/workflow.md` - Fejlesztési protokollok
- `.github/copilot-instructions.md` - Részletes kódolási minták

---

*Generálta: Claude Code (Opus 4.5) - 2026-02-04*
