# Plan: Napi AI Agent Összefoglaló Implementáció

## Fázisok

### 1. Agent réteg
- [x] `src/agents/DailyAgentBriefingAgent.ts` — AIResearchWeeklyAgent alapján, napi fókusz, asztali másolással

### 2. Szerviz réteg
- [x] `src/server/services/briefingService.ts` — SQLite séma + perzisztencia + futtatás

### 3. API réteg
- [x] `src/server/routes/briefing.ts` — 3 endpoint (list, latest, run)
- [x] `src/server/routes/index.ts` szerkesztve — `/briefing` mount

### 4. Frontend réteg
- [x] `src/dashboard/lib/apiService.ts` hozzáfűzve — PM típusok + briefing típusok/függvények
- [x] `src/dashboard/components/dashboard/AIAgentBriefingPanel.tsx` — React panel
- [x] `src/dashboard/lib/navigation.tsx` szerkesztve — import + nav item + csoport bejegyzés

### 5. CLI réteg
- [x] `src/cli/briefingCommands.ts` — `brunella briefing` alparancs csoport
- [x] `src/cli.ts` szerkesztve — import + regisztrálás

### 6. Scheduler
- [x] `src/server/schedulers/scheduledTasksRunner.ts` szerkesztve — `ensureDailyAgentBriefingTask()` metódus

### 7. Registry
- [x] `src/agents/registry.json` szerkesztve — DailyAgentBriefing bejegyzés

### 8. Tesztek
- [x] `tests/briefingService.test.ts`
- [x] `src/dashboard/components/dashboard/AIAgentBriefingPanel.test.tsx`

### 9. Build ellenőrzés
- [x] `npm run build` — TypeScript hibák javítása

## Döntések

- `lookbackDays=1` (napi riport)
- Cron: `0 11 * * *`
- Fallback markdown ha az LLM nem érhető el
- A `WeeklyResearchTaskMetadata` interfész újrahasználva a schedulerben
- `Brain` ikon a navigációban (kompatibilis a meglévő lucide-react verzióval)
