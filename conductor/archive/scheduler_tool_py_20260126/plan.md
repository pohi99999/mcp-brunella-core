# Implementation Plan - Feladatütemező (Scheduler) Python Tool

## Phase 1: Setup
- [x] Task: Dependency Installation
    - [x] Telepítsd a szükséges csomagokat: `pip install apscheduler sqlalchemy`.
    - [x] Frissítsd a `requirements.txt`-t.

## Phase 2: Implementation
- [x] Task: Update Automation Server
    - [x] Módosítsd az `src/servers/automation.py` fájlt.
    - [x] Inicializáld a `BackgroundScheduler`-t `SQLAlchemyJobStore`-ral.
    - [x] Implementáld az életciklus kezelést (start/shutdown).
- [x] Task: Define Jobs
    - [x] Hozz létre egy "dummy" végrehajtó függvényt (pl. `execute_reminder`), amit az ütemező meghív.
- [x] Task: Create MCP Tools
    - [x] Implementáld a `schedule_reminder` eszközt (dátum/idő parsere-vel).
    - [x] Implementáld a `list_scheduled_jobs` eszközt.
    - [x] Implementáld a `remove_scheduled_job` eszközt.

## Phase 3: Integration & Testing
- [x] Task: Manual Testing
    - [x] Hozz létre egy teszt scriptet, ami beütemez egy feladatot 1 perccel későbbre, és figyeli a kimenetet.
- [x] Task: Conductor - User Manual Verification 'Scheduler' (Protocol in workflow.md)
- [x] Task: Update Documentation
    - [x] Frissítsd a `mag.md`-t az új modullal.
    - [x] Frissítsd az `INTEGRATION_PLAN.md` státuszát. (Megjegyzés: A Scheduler funkció beépült az automation modulba).
