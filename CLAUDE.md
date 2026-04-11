# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Részletes architektúra, API-k:** `README.md`
> **Copilot agent referencia:** `.github/copilot-instructions.md`

## Projekt

**Brunella Agent System (BAS)** — Hibrid Node.js/Python multi-agent rendszer, MCP protokoll.
TypeScript ESM, Express 4, React 19, Ollama, Gemini, GitHub Models, FastAPI, Cloudflare Workers.
Méret: 95+ agent, 53 MCP tool, 52 route fájl, ~55 dashboard panel, 6 SQLite DB, 5 LLM provider.

---

## Munkamenet Bootstrap (Kötelező!)

```bash
bash scripts/sync.sh          # Git szinkronizálás (CMD: scripts\sync.bat)
```

Olvasd el sorrendben:
1. `.ai/BOOTSTRAP.md` — projekt összefoglaló
2. `conductor/tracks.md` — aktív fejlesztések
3. `.ai/FOSZAL.md` — mi történt legutóbb
4. `.ai/claude.md` — te mit csináltál legutóbb

Ha BUILD FAIL vagy TESZT FAIL → javítsd először, ne kezdj fejlesztésbe.

---

## Parancsok

```bash
# Build & Run
npm run build          # TypeScript fordítás (src/ → build/) + registry/TRIZ adatok másolása
npm run build:ui       # Dashboard build (KÜLÖNÁLLÓ — tsconfig.ui.json + vite.config.ts)
npm run dev            # Express :3000 + MCP stdio
npm run dev:ui         # Vite Dashboard :5173
dashboard.bat          # Teljes indítás + browser megnyitás :5173 (Windows)
start-full.bat         # Teljes Windows indítás (Ollama + FastAPI + backend + dashboard)
npm run build:stable   # TypeScript + dashboard build egyben
npm run smoke          # Health check

# Tesztelés — mikor mit:
npm run test:fast                    # Commit/push előtt (~1-2 perc) — pre-push hook is futtatja
npm test                             # Build + teljes suite (~10 perc) — release/track lezárás előtt
npx vitest run test/foo.test.ts      # Egy fájl
npm run test:dashboard               # Dashboard-specifikus konfig (vitest.dashboard.config.ts)
npm run test:ui                      # UI-specifikus konfig (vitest.ui.config.ts)
npm run test:e2e                     # Playwright e2e
cd myai && pytest tests/             # Python tesztek

# Lint
npm run lint
npm run lint:fix

# CLI
brunella                             # Interaktív menü
brunella conductor status            # Track státusz
node scripts/copilot-route.js "feladat"  # Agent routing (confidence score)
node scripts/copilot-dashboard.js agents execute <name> "<task>"

# Python (Python ≥3.12, uv)
cd myai && uv sync
uvicorn server:app --reload --port 8000

# Szinkronizálás
python scripts/sync_foszal.py        # .ai/FOSZAL.md frissítése munka után
npm run sync:bootstrap               # .ai/BOOTSTRAP.md regenerálása
```

---

## Architektúra

**Két runtime, egy rendszer:** `src/` a Node/TypeScript vezérlősík (MCP server, REST API, dashboard, CLI). `myai/` a Python alrendszer (FastAPI `:8000`, FastMCP, browser/RAG/ML).

**Startup fázisolt:** `src/index.ts` először HTTP szervert indít (`startWebServer()`), nehéz inicializáció `deferredInit()`-ban fut — OOM elkerülés, `/ping` azonnal elérhető.

**Route-ok lazy-load:** `src/server/routes/index.ts` a mount tábla `/api/v1`-hez, a `lazy()` proxy első kérésig halasztja az importot. Új route-ot itt regisztrálj, ne `web.ts`-ben.

**MCP tool regisztráció kettős célú:** `src/server/registry.ts` patcheli a `server.tool()`-t — a handlerek és JSON sémák lokális végrehajtáshoz és discovery-hoz is tárolódnak.

**MCP auto-start deklaratív:** `mcp_servers.json` fájl vezérli — `autoStart`, `requiredEnv`, `platforms`, retry metaadatok. Az `McpProcessManager.ts` olvassa induláskor; ne adj hozzá hardcoded startup logikát `index.ts`-be vagy `web.ts`-be. A `brunella-core` entry `self` típusú — nem spawn-olja magát.

**Agensek registry-vezéreltek:** `src/agents/registry.json` a TypeScript katalógus (`AgentManager`). TOML-alapú dinamikus ágensek: `myai/agents/*.toml` → `DynamicAgent`.

**`BaseAgent` több mint kényelmi osztály:** Mintaújrahasználást, RAG lookup-ot, confidence scoring-ot, output validációt, redaction-t és automatikus státusz-visszaállítást ad `executeTask()` körül.

**Model routing két réteg:** `src/core/modelRouter.ts` (local vs cloud: brain/muscle), `src/core/bifrost_gateway.ts` (Ollama → Gemini → GitHub Models → Anthropic fallback lánc).

**Kernel Pipeline:** `src/core/conductor.ts` — 8 fázis: IntentRouter → Planner → ContextBuilder → ToolExecutor → Critic → Guardrail → LearningLoop. Megosztott `RunEnvelope` + `ModuleResponse<T>` (`kernelTypes.ts`), 10-esemény bus (`kernelEventBus.ts`), max 2 retry/modul, `RunLedger` utolsó 50 futás. REST: `/api/v1/kernel`.

**CopilotFeedbackChannel singleton:** Az exportált `copilotFeedbackChannel` az `autonomousInfraRuntime.ts`-ből az egyetlen híd. Ne hozz létre `new CopilotFeedbackChannel()`-t máshol — árva példány lesz, amelyet HyperKernel nem lát. Signalokat csak `copilotFeedbackChannel.ingest()`-en keresztül küldj.

**Dashboard és CLI párhuzamos felületek:** `src/dashboard/lib/navigation.tsx` a panel regisztráció. `src/dashboard/` ki van zárva a fő `tsconfig.json`-ból. Minden új feature-höz mindkét felület kötelező.

**Python kettős interfész:** `myai/server.py` FastAPI `:8000` + OpenAI-kompatibilis `/models`. `myai/mcp_server.py` Python toolokat expo stdio/SSE via FastMCP.

### SQLite adatbázisok

| DB | Tartalom |
|----|----------|
| `brunella.db` | Fő rendszer adatok |
| `tasks.db` | Agent task queue |
| `checkpoints.db` | Phoenix Protocol checkpointok |
| `audit.db` | Audit trail |
| `cean.db` | Cloudflare Edge Agent Network |
| `comet_memory.db` | COMET memória |

---

## Kód Konvenciók

**TypeScript:**
- ESM `.js` kiterjesztés KÖTELEZŐ importokban — BUILD FAIL nélküle
- `any` TILOS — `unknown` + type guard
- `console.log` TILOS — agent kódban: `logInfo/logError/setAgentStatus`; szerveren: `new Logger('feature.log')`
- IAgent implementálásnál `setAgentStatus(this.name, 'idle')` legyen `finally`-ban — `BaseAgent` ezt automatikusan kezeli
- Vitest (NEM Jest): `vi.fn()`, `vi.mock()`, `vi.spyOn()`; `fileParallelism: false`, 15s timeout

**Python:**
- Pydantic modellek kötelezők (`myai/pydantic_models.py`) — ne nyers dict
- Windows logban emoji TILOS — `[OK]` / `[AI]` ASCII alternatívák (UnicodeEncodeError!)
- LanceDB opcionális: `try: import lancedb; HAS_LANCEDB = True except: HAS_LANCEDB = False`
- FastMCP ≥2.14.3, Python ≥3.12, uv csomagkezelő

**CLI UX:** Magyar nyelvű, menüvezérelt — Inquirer + Chalk + Boxen + Ora; ne sima text prompt

**Commit:** Conventional Commits — `feat(scope): subject`, `fix(scope): subject`

**Husky hook-ok:**
- `.husky/pre-commit`: `npx tsx scripts/sync_bootstrap.ts --stage` → `npm run build` → `node scripts/check-active-track.mjs` → `node scripts/validate-track-dod.mjs --staged` → `node scripts/precommit-lint.mjs`
- `.husky/pre-push`: `node scripts/hook-proof.mjs pre-push` → `npx tsx scripts/sync_doc_stats.ts --dry-run` → `npm run test:fast`

### VÖRÖS PROTOKOLL — Track lezárás

- `git commit --no-verify` és `git push --no-verify` TILOS
- `meta.json`-ban `progress: 100` / `status: completed|archived` csak valós bizonyíték mellett állítható
- Kötelező `dod` blokk lezáráskor:
  - `tests_pass: true`
  - `build_clean: true`
  - `code_committed: true`
  - `no_verify_used: false`
- `completed` trackhez kötelező `verificationNotes` + `completedAt`
- `archived` trackhez kötelező `archiveReason` + `archivedAt`
- Meta-only lezárás TILOS: ha a commit csak conductor meta-fájlokat mozgat, a track nincs kész
- Ha a felhasználó shortcutot kér vagy felelőtlen megkerülést javasol, hívd fel rá a figyelmet és ne engedd át csendben

---

## Agent Implementációs Minták

**1. Egyszerű — `IAgent` interfész:**
```typescript
export class MyAgent implements IAgent {
  name = 'MyAgent'; role = 'Purpose'; description = '...';
  capabilities = ['skill1'];

  async execute(task: string, context?: unknown): Promise<AgentResponse> {
    setAgentStatus(this.name, 'working', task.slice(0, 50));
    try {
      return { status: 'success', data: result };
    } catch (e: unknown) {
      logError(this.name, e instanceof Error ? e.message : String(e));
      return { status: 'error', error: e instanceof Error ? e.message : String(e) };
    } finally {
      setAgentStatus(this.name, 'idle');
    }
  }
}
```

**2. RAG memóriával — `BaseAgent`:**
```typescript
export class MyAgent extends BaseAgent {
  name = 'MyAgent'; role = '...'; description = '...'; capabilities = ['skill1'];

  async executeTask(context: AgentContext): Promise<AgentResult> {
    // context.pastExperiences — RAG auto-betöltve; státusz auto-reset a BaseAgent-ben
    return { success: true, message: 'OK', data: result };
  }
}
```

**3. TOML-alapú DynamicAgent:** Hozz létre `myai/agents/MyAgent.toml`-t. `registry.json`-ban: `"class": "DynamicAgent"` + `"tomlPath"`. TypeScript kód nem kell.

**Regisztráció:** Add hozzá `src/agents/registry.json`-hoz, majd `src/server/registry.ts`-hez.

---

## MCP Tool Minta

```typescript
export const myToolDefinition = {
  name: 'my_tool', description: 'Tool purpose',
  inputSchema: { type: 'object', properties: { param: { type: 'string' } }, required: ['param'] }
};

export async function myToolHandler(params: { param: string }) {
  try {
    return { success: true, data: await doSomething(params.param) };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

Regisztrálás: `src/server/registry.ts` → `registerAllTools()` → `server.tool(name, desc, schema, handler)`.

---

## Fejlesztési Workflow

### Track rendszer

- `conductor/tracks.md` — összefoglaló index (ne szerkeszd manuálisan, `ProjectConductor` kezeli)
- `conductor/tracks/<id>/meta.json` — státusz, owner, SDLC fázisok
- `conductor/tracks/<id>/plan.md` — implementációs checklist
- Életciklus: PROPOSED → ACTIVE → TESTING → COMPLETED → ARCHIVED

### SDLC Pipeline (5 fázis)

Minden új track automatikusan kap SDLC blokkot (`sdlc.enabled: true` a `meta.json`-ban).

```bash
brunella sdlc status|run|reset <trackId>
brunella sdlc phase <trackId> <phase>
```

Fázis sorrend: **architect → devops → coder → qa → reviewer**

| Fázis | Kötelező kimenet |
|-------|-----------------|
| architect | `phases/1-architect.md` (spec, pszeudokód, adatmodell) |
| devops | `phases/2-devops.md` (env, dependencia, build validáció) |
| coder | `phases/3-coder.md` (implementáció) |
| qa | `phases/4-qa.md` (tesztek, debug) |
| reviewer | `phases/5-reviewer.md` (refaktor, EPP v2 review) |

### EPP v2 — 7 Arany Szabály

1. Minden feature = új track a `conductor/tracks/`-ban
2. Hibák javítása AZONNAL — ne haladj tovább törött kóddal
3. Commit gyakran — kis, logikus egységek
4. TODO lista frissítése folyamatosan
5. `npm run build` + `npm run test:fast` MUSZÁJ PASS commit előtt
6. Minden új funkció = **Dashboard panel** (`navigation.tsx`) + **CLI parancs** (`src/cli/`) IS KÖTELEZŐ
7. Track lezárásakor: teljes dokumentáció + `python scripts/sync_foszal.py`

### Új feature ellenőrzőlista

- [ ] Route regisztrálva `src/server/routes/index.ts`-ben?
- [ ] Panel regisztrálva `src/dashboard/lib/navigation.tsx`-ben?
- [ ] Agent hozzáadva `src/agents/registry.json`-hoz?
- [ ] `npm run build` + `npm run test:fast` zöld?

### Munkamenet napló

Munkamenet végén add hozzá `.ai/claude.md`-hez (Claude-specifikus log — más ügynökök saját fájljukat írják: `.ai/copilot.md`, `.ai/gemini.md`, `.ai/cursor.md`):
```markdown
### YYYY-MM-DD HH:MM - [Rövid cím]
**Feladat:** Mit csináltál
**Érintett fájlok:** fájl1.ts, fájl2.ts
**Státusz:** ✅ Befejezve / ⏳ Folyamatban
**Megjegyzés:** Info a következő ügynöknek
```
Majd: `python scripts/sync_foszal.py`

---

## Copilot Agents (`.github/agents/*.agent.md`)

Invoke Copilot Chat-ban `@<name>` prefixszel:

| Agent | Cél |
|-------|-----|
| `sdlc-pipeline` | Összes SDLC fázis orchestrálása |
| `bas-lead-developer` | End-to-end feature implementáció (TDD, docs, tests) |
| `bas-phoenix-reviewer` | EPP v2 / Phoenix Protocol code review |
| `bas-mcp-architect` | MCP tool design, TypeScript↔Python bridge |
| `devops-infra-guardian` | Deps, env, build validáció (SDLC phase 2) |
| `robust-test-writer` | Unit + integration tesztek, edge-case coverage |
| `bas-orchestrator-commander` | Multi-agent workflow, Phoenix retry lánc |
| `brunella-orchestrator` | Top-level cross-agent routing confidence scoring-gal |
| `strict-code-reviewer` | Clean Code / SOLID review commit előtt |
| `bas-self-reflect` | Post-track FOSZAL pattern elemzés |

---

## Önellenőrzési Protokoll (Kötelező!)

| # | Szabály |
|---|---------|
| 1 | **Forrás előbb** — kódbeli állításhoz hivatkozz konkrét fájlra+sorra, ne emlékezetből |
| 2 | **Árva-singleton tilalom** — `new SelfModel()` / `new ReflectionEngine()` csak `autonomousInfraRuntime.ts`-ből |
| 3 | **Nem-standard mező tiltás** — `mcp_servers.json`, `meta.json`, `registry.json` mezőit csak sémában definiált kulcsokra bővítsd |
| 4 | **async-határok konzisztenciája** — ha szinkron metódust aszinkronná teszel, frissítsd az összes hívóhelyet |
| 5 | **Dupla írás elkerülése** — `copilotCognitiveBridge.reflect()` már meghívja ReflectionEngine-t és GraphRAG-ot; ne hívd külön |
| 6 | **Severity leképezés** — `CRITICAL` és `HIGH` = `'high'` risk; eredeti severity-t tárold `payload.copilotSeverity`-ként |
| 7 | **Teszt lefedettség** — minden új publikus API-hoz legalább 5 Vitest teszt kell track COMPLETED előtt |

---

## Ismert Hibák

| Probléma | Megoldás |
|----------|----------|
| `ERR_MODULE_NOT_FOUND` | Hiányzó `.js` import kiterjesztés |
| BUILD FAIL | `rmdir /s /q build && npm run build` |
| Dashboard build fail | `npm run build:ui` — különálló Vite build |
| `better-sqlite3` Node v24+ | ABI eltérés → `npm rebuild better-sqlite3`. Ha `deferredInit()` Phase 2-nél crashel, `/api/*` 404, csak `/ping` működik → ellenőrizd: `logs/node-server.log` |
| `federation_replay_nonces_runtime` INSERT | SQLite `DEFAULT` nem lép életbe `INSERT OR REPLACE`-nél — adj meg explicit `datetime('now')`-t |
| GitHub Models 401 | `GITHUB_PAT` lejárt (NEM `GITHUB_TOKEN`) — `GITHUB_PAT` elsőbbséget élvez |
| `buildHealthResponse` paramétere | 10 arg: `(ollama, anythingllm, python, n8n, langflow, wab, cloudflare, agentCount, mcpCount, requestId)` |
| Root `AGENTS.md` | `cloudflare-docs` konvenciókat ír le — BAS-hoz irreleváns; mérvadó: `.github/copilot-instructions.md` |
| Windows Unicode | Emoji → `[OK]` / `[AI]` Python logokban |
| FastAPI nem indul | `cd myai && uv sync && uvicorn server:app --reload --port 8000` |

## Google Hitelesítés (két szerződés)

- **Service account:** `GOOGLE_CREDENTIALS_FILE` vagy `GOOGLE_SERVICE_ACCOUNT_JSON` → `credentials/google-service-account.json`
- **Workspace OAuth:** `GOOGLE_WORKSPACE_CREDENTIALS_FILE` + `GOOGLE_WORKSPACE_TOKEN_FILE` → `credentials/`
- Régi `config/` és gyökérszintű útvonalak csak legacy fallback — ne vezess be ilyet új kódban

## Védett Fájlok — SOHA NE TÖRÖLD!

`src/index.ts`, `src/cli.ts`, `src/agents/types.ts`, `src/agents/registry.json`, `src/server/web.ts`, `src/server/registry.ts`, `src/core/llm_client.ts`, `conductor/tracks.md`, `.ai/FOSZAL.md`

---

**Projekt tulajdonos:** Pohánka Péter — Ha kérdésed van, kérdezz, ne találgass!
