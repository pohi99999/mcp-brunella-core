# SDLC Pipeline Design
**Dátum:** 2026-04-06  
**Státusz:** Approved  
**Branch:** feature/kkv-crm-skeleton-20260404

---

## Összefoglaló

Az SDLC Pipeline egy 5-fázisú automatikus fejlesztési workflow, amely minden új conductor track létrehozásakor elindul. A meglévő `.github/agents/` agenteket kiterjeszti `sdlc_phase:` metaadattal, és a `ProjectConductorAgent` vezérli TypeScript oldalon. Elérhető Copilot CLI-ből, VS Code Insiders Copilot Chat-ből és a `brunella sdlc` CLI parancsokból.

---

## Architektúra

```
Új conductor track létrehozás
         │
         ▼
ProjectConductorAgent
  detektálja: meta.json-ban nincs sdlc mező
  → sdlcPipeline.init(trackId)
         │
    ┌────▼─────────────────────────────────────────┐
    │           SDLC PIPELINE                       │
    │                                              │
    │  [1] ARCHITECT  ──►  bas-mcp-architect       │
    │        │              + SpecWriterAgent       │
    │        │  output: phases/1-architect.md       │
    │        ▼                                      │
    │  [2] DEVOPS     ──►  devops-infra-guardian    │
    │        │              + DependencyGraphAgent  │
    │        │  output: phases/2-devops.md          │
    │        ▼                                      │
    │  [3] CODER      ──►  bas-lead-developer       │
    │        │              + DeveloperAgent        │
    │        │  output: phases/3-coder.md           │
    │        ▼                                      │
    │  [4] QA         ──►  robust-test-writer       │
    │        │              + EvaluatorAgent        │
    │        │  output: phases/4-qa.md              │
    │        ▼                                      │
    │  [5] REVIEWER   ──►  bas-phoenix-reviewer     │
    │                       + strict-code-reviewer  │
    │        │  output: phases/5-reviewer.md        │
    │        ▼                                      │
    │   ✅ SDLC COMPLETE → track status: TESTING    │
    └──────────────────────────────────────────────┘
         │
         ▼
    Socket.IO broadcast + CLI notification
    phoenixEventBus.emit('sdlc:complete', { trackId })
```

### Két réteg

| Réteg | Fájlok | Felület |
|---|---|---|
| `.github/agents/` | `sdlc-pipeline.agent.md` + meglévők `sdlc_phase:` metaadattal | Copilot CLI, VS Code Insiders |
| `src/agents/` + `src/core/` | `sdlcPipeline.ts`, `ProjectConductorAgent` kiterjesztés | Automatikus track trigger, brunella CLI |

---

## Fázis–Agent leképezés

| # | Fázis | `.github/agents/` | TypeScript agent | Superpowers skill |
|---|---|---|---|---|
| 1 | Architect | `bas-mcp-architect` | `SpecWriterAgent` | `superpowers:writing-plans` |
| 2 | DevOps | `devops-infra-guardian` | `DependencyGraphAgent` | — |
| 3 | Coder | `bas-lead-developer` | `DeveloperAgent` | `superpowers:test-driven-development` |
| 4 | QA | `robust-test-writer` | `EvaluatorAgent` | `superpowers:systematic-debugging` |
| 5 | Reviewer | `bas-phoenix-reviewer` + `strict-code-reviewer` | — | `superpowers:requesting-code-review` + `superpowers:verification-before-completion` |

---

## meta.json kiterjesztés

Az `sdlc.enabled` mező alapértéke `true` minden új track-nél — a `ProjectConductorAgent` automatikusan hozzáadja. Meglévő track-ekhez nem adódik hozzá (backward compatible). Kikapcsolható: `"enabled": false` a `meta.json`-ban a track létrehozása előtt.

```json
{
  "id": "my-track-20260406",
  "status": "active",
  "progress": 0,
  "sdlc": {
    "enabled": true,
    "current_phase": "architect",
    "auto_advance": true,
    "phases": {
      "architect": {
        "status": "pending",
        "agent": "bas-mcp-architect + SpecWriterAgent",
        "output": "phases/1-architect.md"
      },
      "devops": {
        "status": "pending",
        "agent": "devops-infra-guardian + DependencyGraphAgent",
        "output": "phases/2-devops.md"
      },
      "coder": {
        "status": "pending",
        "agent": "bas-lead-developer + DeveloperAgent",
        "output": "phases/3-coder.md"
      },
      "qa": {
        "status": "pending",
        "agent": "robust-test-writer + EvaluatorAgent",
        "output": "phases/4-qa.md"
      },
      "reviewer": {
        "status": "pending",
        "agent": "bas-phoenix-reviewer + strict-code-reviewer",
        "output": "phases/5-reviewer.md"
      }
    }
  }
}
```

---

## Track fájlstruktúra

```
conductor/tracks/<trackId>/
├── meta.json              ← sdlc blokk hozzáadva
├── spec.md                ← ArchitectAgent írja
├── plan.md                ← ArchitectAgent írja
└── phases/
    ├── 1-architect.md     ← pszeudokód, adatmodell, interfészek, folyamatábra
    ├── 2-devops.md        ← deps check, env validáció, build eredmény
    ├── 3-coder.md         ← implementáció összefoglaló, érintett fájlok
    ├── 4-qa.md            ← teszt eredmények, bugok, teljesítmény
    └── 5-reviewer.md      ← refactor javaslatok, EPP v2 report, final docs
```

---

## Új fájlok

### `.github/agents/sdlc-pipeline.agent.md`
Orchestrátor agent. Koordinálja a fázisokat, olvassa/írja a `meta.json` `sdlc` blokkját, delegál a phase-specifikus agenteknek. Mindig meghívja a releváns superpowers skill-t minden fázis előtt.

**Copilot Chat használat:**
```
@sdlc-pipeline /start <trackId>
@sdlc-pipeline /status <trackId>
@sdlc-pipeline /phase architect <trackId>
```

### `src/core/sdlcPipeline.ts`
TypeScript modul. Felelős:
- `init(trackId)` — `sdlc` blokk írása `meta.json`-ba
- `advance(trackId)` — következő fázis indítása
- `getStatus(trackId)` — aktuális fázis lekérdezése
- Phoenix Event Bus integráció (`sdlc:phase:start`, `sdlc:phase:complete`, `sdlc:complete`)
- `AgentManager.executeWithRecovery()` hívása minden fázishoz

---

## Módosított meglévő fájlok

### `.github/agents/*.agent.md` — frontmatter bővítés

Minden érintett fájl YAML frontmatterébe kerül:
```yaml
sdlc_phase: architect   # vagy devops / coder / qa / reviewer
sdlc_output: phases/1-architect.md
sdlc_superpowers:
  - superpowers:writing-plans
```

### `src/agents/ProjectConductorAgent.ts`
- Track létrehozás detektáláskor: `sdlcPipeline.init(trackId)` hívás
- `sdlc:phase:complete` event figyelése → következő fázis indítása
- `sdlc:complete` event → track status `testing`-re állítása

### `.github/copilot-instructions.md` — 3 additive változtatás
1. Új `## SDLC Pipeline` szekció a "Session bootstrap" után
2. 6 sor az agent routing táblában
3. 1 bekezdés a "Key repository conventions" alatt

### `src/cli.ts` — új parancsok
```bash
brunella sdlc status <trackId>
brunella sdlc run <trackId>
brunella sdlc phase <trackId>
brunella sdlc reset <trackId>
```

---

## Superpowers integráció

| Esemény | Meghívott skill |
|---|---|
| Architect fázis előtt | `superpowers:writing-plans` |
| Coder fázis előtt | `superpowers:test-driven-development` |
| QA fázis előtt | `superpowers:systematic-debugging` |
| Reviewer fázis előtt | `superpowers:requesting-code-review` |
| Reviewer fázis végén | `superpowers:verification-before-completion` |
| Bármilyen hiba esetén | `superpowers:systematic-debugging` |

A `sdlc-pipeline.agent.md` instrukciói kötelezővé teszik a superpowers skill meghívását minden fázis elején — az agent nem folytathat implementációt a skill betöltése nélkül.

---

## Adatfolyam

```
1. ProjectConductorAgent detektál új track-et
2. sdlcPipeline.init() → meta.json sdlc blokk
3. phoenixEventBus.emit('sdlc:phase:start', { phase: 'architect' })
4. AgentManager.executeWithRecovery('SpecWriterAgent', task)
   └── superpowers:writing-plans meghívva
   └── output → phases/1-architect.md
   └── meta.json frissítés: architect.status = 'completed'
5. phoenixEventBus.emit('sdlc:phase:complete', { phase: 'architect' })
6. sdlcPipeline.advance() → következő fázis: devops
7. [ismétlés fázisonként]
8. Reviewer fázis végén:
   └── superpowers:verification-before-completion
   └── phoenixEventBus.emit('sdlc:complete')
   └── track.status = 'testing'
   └── Socket.IO → Dashboard értesítés
   └── CLI: "✅ SDLC pipeline kész"
```

---

## Elfogadási kritériumok

- [ ] Új conductor track létrehozásakor automatikusan létrejön a `sdlc` blokk a `meta.json`-ban
- [ ] Mind az 5 fázis sorban lefut, kimenetük a `phases/` mappában jelenik meg
- [ ] `@sdlc-pipeline /start <trackId>` működik VS Code Insiders Copilot Chat-ben
- [ ] `brunella sdlc status <trackId>` helyes fázisállapotot mutat
- [ ] Minden fázis előtt a megfelelő superpowers skill meghívásra kerül
- [ ] A meglévő `.github/agents/*.agent.md` tartalom érintetlen marad
- [ ] A `copilot-instructions.md` meglévő tartalma érintetlen marad
- [ ] `npm run build` és `npm run test:fast` zöld marad

---

## Nem változik

- Meglévő agent implementációk logikája
- `registry.json` struktúra
- Meglévő conductor track-ek (csak új track-eknél indul az SDLC)
- `copilot-instructions.md` jelenlegi tartalma (csak bővítés történik)
