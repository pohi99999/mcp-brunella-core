# Implementation Plan - Feladatütemező (Scheduler) Python Tool

## Phase 1: Setup
- [x] Task: Dependency Installation
    - [x] Telepítsd a szükséges csomagokat: `pip install apscheduler sqlalchemy`.
    - [x] Frissítsd a `requirements.txt`-t.

## Phase 2: Implementation
- [ ] Task: Update Automation Server
    - [ ] Módosítsd az `src/servers/automation.py` fájlt.
    - [ ] Inicializáld a `BackgroundScheduler`-t `SQLAlchemyJobStore`-ral.
    - [ ] Implementáld az életciklus kezelést (start/shutdown).
- [ ] Task: Define Jobs
    - [ ] Hozz létre egy "dummy" végrehajtó függvényt (pl. `execute_reminder`), amit az ütemező meghív.
- [ ] Task: Create MCP Tools
    - [ ] Implementáld a `schedule_reminder` eszközt (dátum/idő parsere-vel).
    - [ ] Implementáld a `list_scheduled_jobs` eszközt.
    - [ ] Implementáld a `remove_scheduled_job` eszközt.

## Phase 3: Integration & Testing
- [ ] Task: Manual Testing
    - [ ] Hozz létre egy teszt scriptet, ami beütemez egy feladatot 1 perccel későbbre, és figyeli a kimenetet.
- [ ] Task: Conductor - User Manual Verification 'Scheduler' (Protocol in workflow.md)
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md`-t az új modullal.
    - [ ] Frissítsd az `INTEGRATION_PLAN.md` státuszát (bár a SchedulerGem nem volt explicit része, de kapcsolódik).
