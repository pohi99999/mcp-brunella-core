# Jules PR Integration — Specifikáció

**Track:** `jules_pr_integration_20260222`

---

## Mi az a Jules?

**Jules** (app/google-labs-jules) a Google Labs autonóm AI fejlesztő ügynöke. A Brunella repóban fut és folyamatosan küldi a fejlesztési PR-okat — teljesítményfejlesztéseket, UX javításokat, új feature-öket és bug fix-eket.

**A probléma:** 30 nyitott PR gyűlt össze review és merge nélkül. Ez:
- Növekvő conflict kockázatot jelent
- Értékes fejlesztési munkát hagy kihasználatlanul
- Áttekinthetetlenné teszi a repo állapotát

---

## PR Kategóriák és Értékelés

### 🔴 Kritikus — Azonnal merge

| PR | Leírás | Kockázat |
|----|--------|----------|
| #94 | Ollama silent restart (heartbeat alapú) | Alacsony |
| #92 | FastAPI silent restart (új service file) | Alacsony |
| #96 | Cron-parser pontos next_run számítás | Közepes (új pkg) |
| #66 | Audit trail permission denial logolás | Alacsony |

### 🟠 Fontos — Holnap merge

| PR | Leírás | Kockázat |
|----|--------|----------|
| #98 | Jules valódi API kliens (mock → real) | Közepes |
| #99 | GitHubModelsAgent tool execution loop | Közepes |
| #93 | pull_requests tábla + PR tracking DB | Alacsony |
| #89 | EdgeProxy KV-SQLite szinkronizáció | Közepes |

### 🟡 Performance — Batch

| PR | Leírás | Várható javulás |
|----|--------|-----------------|
| #100 | ConfigManager caching by cwd | I/O csökkentés |
| #91 | MCP async file reads | Server responsiveness |
| #90 | listSpecStatuses concurrent | ~25% gyorsítás |
| #72 | File listing async | Stateless I/O |
| #64 | memoryContext async | Blocking eltávolítás |
| #63 | codebaseIndexer pMap batch | Concurrent processing |
| #74 | myai log streaming aiofiles | Python async I/O |
| #71 | Whisper asyncio.to_thread | Audio blocking fix |

### 🟢 UX/A11y — Batch (alacsony prioritás)

| PR | Leírás | Megjegyzés |
|----|--------|------------|
| #102 | ProcessControlWidget tooltips | Legújabb, merge ez |
| #101 | ProcessControlWidget re-render fix | ⚠️ CONFLICT — useShallow már kész |
| #97 | NeuralLinkChat a11y | Safe |
| #88 | AgentStatusCard tooltips (v2) | Merge ezt |
| #77 | AgentStatusCard UX (v1) | Ha #88 merge-elve → outdated |
| #69, #59 | AgentStatusCard a11y (legrégebbi) | Valószínűleg outdated |

### ❌ Close / Skip

| PR | Ok |
|----|----|
| #81 | #89 supersedes — régebbi KV-SQLite sync |
| #101 | Conflict useShallow-val — csak tooltip rész |
| #87 | Copilot WIP, nem kész |
| #76 | Copilot bootstrap task, nem szükséges |
| #75 | Copilot analysis only, no code |
| #80, #79 | open-interpreter fájlok — nem Brunella projekt |

---

## Technikai Megfontolások

### Conflict Map

```
useSystemSignal.ts    ← #101 érinti (useShallow már kész)
globalDb.ts           ← #89/#81 érinti (edge_tasks már kész)
src/core/julesMock.ts ← #98 teljesen átírja (nagy változás)
src/server/registry.ts ← #99 módosítja (tool capture logika)
```

### Új Függőségek

```json
{
  "cron-parser": "^4.x",   // PR #96 — scheduled tasks
  "aiofiles": "x.x",       // PR #74 — Python async logging
  "os-utils": "x.x"        // PR #73 — CPU tracking (review!)
}
```

### Új Fájlok (nem conflict)

```
src/services/fastApiService.ts    // PR #92
src/services/ollamaService.ts     // PR #94 (valószínűleg)
```

---

## Sikerességi Kritériumok

1. ✅ Phase 1 (Reliability) PR-ok merge-elve, npm test PASS
2. ✅ Phase 2 (Features) PR-ok merge-elve, npm test PASS
3. ✅ Conflict PR-ok (#101, #81) dokumentáltan kezelve
4. ✅ Copilot WIP PR-ok (#87, #76, #75) lezárva
5. ✅ git log tiszta, squash commit-ok
6. ✅ npm run health — minden szolgáltatás healthy

---

## Jules Workflow — Jövőre

Hogy ne gyűljön össze megint 30 PR, javasolt folyamat:

```
Jules küld PR-t
    ↓
ProjectConductorAgent figyeli (webhook)
    ↓
GrantWatcherAgent-szerű napi digest
    ↓
Hetente 1x batch review + merge session
```

Ezt a `jules_enterprise_cicd_20260212` track fogja megvalósítani.
