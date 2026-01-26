# Megvalósítási Terv: Smart Agency & Visuals

## 1. Fázis: Backend - A Tervező (The Planner)
- [ ] **Task:** `AgentManager` bővítése `plan()` metódussal (Ollama hívás: "Break down this task...").
- [ ] **Task:** `executePlan()` logika implementálása (szekvenciális végrehajtás).
- [ ] **Task:** Események (`plan_created`, `plan_step_start`, `plan_step_complete`) definiálása és küldése Socket.IO-n.

## 2. Fázis: Frontend - A Látnok (The Viewer)
- [ ] **Task:** Új `PlanViewer` komponens a Dashboard-ra (Collapsible lista a lépésekről).
- [ ] **Task:** `useMCP` hook bővítése a `plan_update` események fogadására.
- [ ] **Task:** Chat buborékok okosítása: Ha `tool_result` érkezik, rendereljen JSON nézőt.

## 3. Fázis: Integráció és Teszt
- [ ] **Task:** Teszt: "Elemezd a tegnapi logokat és foglald össze a hibákat".
- [ ] **Task:** Finomhangolás: Az Ollama promptok optimalizálása (hogy JSON formátumban adja a tervet).
