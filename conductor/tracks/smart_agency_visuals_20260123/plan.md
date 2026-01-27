# Megvalósítási Terv: Smart Agency & Visuals

## 1. Fázis: Backend - A Tervező (The Planner)
- [x] **Task:** `AgentManager` bővítése `plan()` metódussal (Ollama hívás: "Break down this task...").
- [x] **Task:** `executePlan()` logika implementálása (szekvenciális végrehajtás).
- [x] **Task:** Események (`plan_created`, `plan_step_start`, `plan_step_complete`) definiálása és küldése Socket.IO-n.

## 2. Fázis: Frontend - A Látnok (The Viewer)
- [x] **Task:** Új `PlanViewer` komponens a Dashboard-ra (Collapsible lista a lépésekről).
- [x] **Task:** `useMCP` hook bővítése a `plan_update` események fogadására.
- [x] **Task:** Chat buborékok okosítása: Ha `tool_result` érkezik, rendereljen JSON nézőt.

## 3. Fázis: Finomhangolás és Integráció (KÉSZ)
- [x] **Task:** UI Finomhangolás: Animációk és sötét mód támogatás a `PlanViewer` számára.
- [x] **Task:** Python Bridge: A `myai` mappa szorosabb integrációja a Developer ügynökkel (pl. script lista lekérése).
- [x] **Task:** Éles Teszt: Összetett log elemzési feladat verifikációja.


