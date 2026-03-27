# CLI scripting és multi-agent orchestration — Plan

Elvégzett munkák:
- CLI: `workflow run` parancs hozzáadva (JSON/YAML támogatás, egyszerű `steps` → belső DAG konverzió, elsődleges endpoint: `/api/v1/workflow/run`, fallback: `/api/v1/tasks/workflow/run`).
- Backend: `src/server/routes/workflow.ts` létrehozva — `/list`, `/status`, `/run` végpontok, delegál az `agentManager.executeWorkflow`-re és a `decomposeToDAGAsync`-re.
- Tesztek/build: `npm run build` sikeres; manuális futtatás indított példaworkflow-t (status: running).
- Todos: `copilot-cli-scripting` befejezve, `copilot-diagnostics-logging` függőben.

Következő lépések (javasolt prioritás):
1) Dashboard: `onMultiDispatch` callback összekötése backenddel, UI visszajelzés (progress, logs, result).
2) Diagnosztika/logging: agent logok és CLI diagnosztika parancsok implementálása (`agents diagnostics`, `tasks diagnostics`).
3) Async job model: `workflow/run` rövid válasszal indítsa a munkát (jobId), háttér feldolgozás + polling `/workflow/status` végpont.
4) Tesztek: unit/e2e tesztek a CLI parsing és backend futtatásra; CI integráció.

Döntés szükséges: melyik legyen a következő fókusz? (Dashboard integráció / Diagnosztika / Async job / Más)
