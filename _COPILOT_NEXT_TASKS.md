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

## Prioritás 1: RAG Vector Embeddings Implementálása [KÉSZ]

**Fájl:** `src/utils/rag.ts`

**Státusz:** ✅ Implementálva és Tesztelve (2026-02-09)
- `getEmbedding` funkció Ollama supporttal
- `search` metódus `HybridMemory` osztályban
- `test/rag.test.ts` validálja a működést

---

## Prioritás 2: CONDUCTOR_MANIFEST.md Refaktorálás [KÉSZ]

**Fájl:** `conductor/CONDUCTOR_MANIFEST.md`

**Státusz:** ✅ KÉSZ (2026-02-09)
- `conductor/archive` létrehozva
- 25+ régi track archiválva
- Manifest v3.0.0 formátumra átírva (Green Lightning fókusz)
- AI chat logok eltávolítva a fő manifestből

---

## Prioritás 3: ProjectConductor CLI Integráció [KÉSZ]

**Fájlok:**
- `src/cli.ts`
- `src/agents/ProjectConductorAgent.ts`

**Probléma:** A `brunella conductor status` parancs nincs bekötve.

**Feladat:**
1. A CLI-ben add hozzá a `conductor` subcommand-ot
2. Delegálj a ProjectConductorAgent-nek
3. Támogatott parancsok: `status`, `sync`, `health`, `track create <name>`

**Státusz:** ✅ KÉSZ (2026-02-14)
- CLI sub-process port collision (3000) kijavítva a `mcpClient.ts`-ben.
- `conductor` subcommand implementálva.

---

## Prioritás 4: Gemini Workflow Timeout Bővítés [KÉSZ]

**Fájlok:**
- `.github/workflows/gemini-review.yml`
- `.github/workflows/gemini-triage.yml`
- `.github/workflows/gemini-scheduled-triage.yml`

**Státusz:** ✅ KÉSZ (2026-02-14)
- `timeout-minutes: 15` hozzáadva minden Gemini workflow-hoz.

---

## Prioritás 5: Secrets Validáció Workflow-kban [KÉSZ]

**Fájl:** `.github/workflows/*.yml`

**Státusz:** ✅ KÉSZ (2026-02-14)
- Secrets validáció (existence check) hozzáadva a Gemini és BAS sync workflow-khoz.

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
