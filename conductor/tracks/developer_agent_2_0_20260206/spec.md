# Spec: Developer Agent 3.0 — Unified Development Platform

**Track ID:** `developer_agent_2_0_20260206`
**Version:** 3.1.0
**Last Updated:** 2026-02-09
**Status:** `approved` ✅

---

## 🎯 Vízió

A Developer Agent, a CLI és a Dashboard **szinkronban fejlődik** — minden új képesség egyszerre elérhető mindhárom felületen: programozottan (agent), parancssorból (CLI), és vizuálisan (Dashboard).

**Aranyszabály:** Minden új fejlesztői képesség EGYSZERRE kerül be:

1. 🤖 Agent handler a `DeveloperAgent.ts`-ben
2. 💻 CLI parancs a `devCommands.ts`-ben
3. 🖥️ Dashboard UI elem a `DeveloperPanel.tsx`-ben
4. 🌐 REST végpont a `developer.ts` route-ban
5. 🧪 Vitest teszteset a `test/` mappában

---

## 📊 Fázisok Összefoglalása

| Fázis | Feladatok | Prioritás | Státusz |
|-------|-----------|-----------|---------|
| **Fázis 1** | P1 Pipeline, P2 CLI, P3 Dashboard | 🔴 CRITICAL | `DONE ✅` |
| **Fázis 2** | P4 Review, P5 Context, P6 Coverage | 🟠 HIGH | `DONE ✅` |
| **Fázis 3** | P7 Queue, P8 Git, P9 Scaffold | 🟡 MEDIUM | `DONE ✅` |
| **Fázis 4** | P10 Metrics, P11 Approval, P12 Feed | 🟡 MEDIUM | `DONE ✅` |

---

## 🏗️ FÁZIS 1: Alapok & Architektúra (P1–P3) [DONE ✅]

### P1: Task Pipeline & Progress Streaming [DONE ✅]

**Fájlok:**

- `src/agents/developerPipeline.ts` — Pipeline interfészek + `PipelineRunner` osztály
- `src/agents/DeveloperAgent.ts` — Pipeline integráció az execute()-ba
- `src/server/routes/developer.ts` — REST API végpontok

**Működés:**

- Minden feladat fázisokra bomlik: `plan → generate → validate → save → test`
- `ProgressEvent` emit Socket.IO-n keresztül
- Feladat-állapot: `queued → planning → generating → validating → saving → testing → done/error`

**API végpontok:**

- `GET /api/v1/developer/pipeline/:taskId` — Pipeline állapot lekérdezés
- `GET /api/v1/developer/history` — Utolsó N feladat
- `POST /api/v1/developer/execute` — Feladat indítás progress streaming-gel

### P2: CLI Developer Commands [DONE ✅]

**Fájl:** `src/cli/devCommands.ts`

**Parancsok:**

```bash
brunella dev generate <prompt>     # Kód generálás
brunella dev test <file>           # Teszt generálás
brunella dev fix [--auto]          # Hiba javítás
brunella dev heal                  # Self-heal futtatás
brunella dev review <file>         # Kód review
brunella dev status                # Pipeline állapot
brunella dev history               # Feladat történet
```

### P3: Dashboard Developer Panel [DONE ✅]

**Fájlok:**

- `src/dashboard/components/dashboard/DeveloperPanel.tsx` — Fő panel
- `src/dashboard/components/dashboard/DeveloperPipeline.tsx` — Pipeline vizualizáció

**Tartalom:**

1. Prompt input + „Generálj" gomb
2. Pipeline progress bar (fázisonkénti vizualizáció)
3. One-Click műveletek (Generate, Test, Fix, Heal)
4. Feladat történet táblázat
5. Self-Heal log timeline

---

## 🧠 FÁZIS 2: Intelligens Képességek (P4–P6)

### P4: Code Review & Refactoring [DONE ✅]

- `handleCodeReview(filePath)` — LLM review, severity szintek
- `handleRefactoring(filePath, instruction)` — irányított refaktorálás
- CLI: `brunella dev review <file>`
- Dashboard: Review Panel, kódsoronkénti annotáció

### P5: Multi-File Kontextus & Project-Aware Generation [DONE ✅]

- RAG-alapú kontextus: releváns fájlok auto-becsatolás
- `codebaseIndexer.ts` + `DependencyGraphAgent` integráció
- CLI: `brunella dev generate --context auto`
- Dashboard: Kontextus fájlválasztó panel

### P6: Teszt Lefedettség Elemzés & Auto-Test [DONE ✅]

- `analyzeCoverage()` — Vitest coverage report
- `suggestTests(file)` — lefedetlen kódrészekhez javaslatok
- CLI: `brunella dev coverage` + `brunella dev test --auto-generate`
- Dashboard: Coverage heatmap

---

## ⚡ FÁZIS 3: Workflow & Automatizáció (P7–P9)

### P7: Task Queue & Batch Operations [DONE ✅]

### P8: Git Workflow Automatizáció [IDEA]

### P9: Scaffold & Template Rendszer [DONE ✅]

**Fájlok:**

- `src/agents/codeScaffold.ts` — TemplateEngine osztály (4 beépített template)
- `src/server/routes/developer.ts` — API végpontok (`/scaffold`)
- `src/cli/devCommands.ts` — CLI parancsok (`scaffold list`, `scaffold generate`)

**Működés:**

- Beépített sablonok: `react-component`, `rest-api`, `agent`, `test-file`
- Változó helyettesítés: `{{VariableName}}` szintaxis
- Preview mód: `--dry-run` flag support

**CLI:**

```bash
brunella dev scaffold list
brunella dev scaffold generate <template> -v Name=MyComponent
```

---

## 📊 FÁZIS 4: Monitoring & Kontroll (P10–P12)

### P10: Developer Metrics & Analytics [DONE ✅]

- Perzisztens tárolás: `data/developer_metrics.json`
- Automatikus rögzítés a `PipelineRunner`-ben.
- CLI: `brunella dev metrics`
- API: `GET /api/v1/developer/metrics`
- Interaktív menü integráció.

### P11: Approval & Confirmation Flow [DONE ✅]

**Fájlok:**

- `src/utils/approvalManager.ts` (ÚJ) — Singleton approval state machine
- `src/server/routes/developer.ts` — API végpontok (`/approval/*`)
- `src/cli/devCommands.ts` — CLI parancsok (`brunella dev approval`)

**Működés:**

- Kérések (`ApprovalRequest`) kezelése: pending → approved/rejected/expired
- Időzített lejárat (timeout)
- CLI polling (`waitForResult`) támogatás

**API:**

- `GET /approval` — List pending
- `POST /approval/request` — Create request
- `POST /approval/:id/respond` — Válasz küldése

**CLI:**

- `brunella dev approval list`
- `brunella dev approval approve <id>`
- `brunella dev approval reject <id>`

### P12: Unified Activity Feed [DONE ✅]

**Fájlok:**

- `src/utils/activityFeed.ts` (ÚJ) — Singleton feed manager
- `src/server/routes/developer.ts` — `GET /feed` végpont
- `src/cli/devCommands.ts` — `brunella dev feed [--watch]`

**Működés:**

- Centralizált esemény-folyam (Info, Success, Error, Approval)
- Források: Pipeline, ApprovalManager, System
- CLI-ben `tail -f` stílusú figyelés támogatása (--watch)

---

## 📁 Fájlstruktúra

```
src/
├── agents/
│   ├── DeveloperAgent.ts          # Bővített (Pipeline integráció)
│   └── developerPipeline.ts       # Pipeline & Progress (P1)
├── cli/
│   ├── goldCommands.ts            # Meglévő
│   └── devCommands.ts             # Developer CLI modul (P2)
├── dashboard/components/dashboard/
│   ├── DeveloperPanel.tsx         # Fő developer panel (P3)
│   └── DeveloperPipeline.tsx      # Pipeline vizualizáció (P3)
├── server/routes/
│   └── developer.ts               # /api/v1/developer/* végpontok
└── utils/
    └── developerMetrics.ts        # Metrika gyűjtés (P10, későbbi)

test/
├── developer_pipeline.test.ts     # Pipeline tesztek
├── dev_commands.test.ts           # CLI tesztek
└── routes_developer.test.ts       # API végpont tesztek
```

---

## 🔗 Korábbi v2.0 referencia

A v2.0 handler-ek (handleCodeGeneration, handleTestGeneration, handleErrorFix,
handlePythonExecution, handleGitOperation, handleGenericTask, selfHealBuild)
továbbra is megmaradnak — a v3.0 ezeket burkolja pipeline-ba.

---

## 📝 Change Log

### v3.0.0 (2026-02-10) — Fázis 1

- Pipeline architektúra (TaskPipeline, PipelineRunner)
- CLI `brunella dev` alparancs-csoport (7 parancs)
- Dashboard DeveloperPanel + DeveloperPipeline vizualizáció
- REST API: `/api/v1/developer/*` végpontok
- Socket.IO progress streaming integráció

### v2.0.0 (2026-02-06) — Alapok

- Complete rewrite from v1.0
- GPT-4o integráció, teszt generálás, self-healing pipeline, git műveletek

---

**Status:** ✅ Fázis 1 Implementálva
**Next:** Fázis 2 (P4–P6) — Code Review, Project Context, Coverage
