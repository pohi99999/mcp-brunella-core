# Specification: Feladatütemező (Scheduler) Python Tool

## 1. Overview
Ez a track egy robusztus feladatütemező rendszert hoz létre a Brunella Core számára, amely lehetővé teszi az ágenseknek, hogy feladatokat (pl. függvényhívásokat, emlékeztetőket) ütemezzenek be későbbi vagy ismétlődő végrehajtásra. A megoldás a Python `APScheduler` könyvtárára épül, és az `src/servers/automation.py` modult bővíti ki.

## 2. Goals
- `APScheduler` integrálása a Python környezetbe.
- Háttérben futó ütemező szolgáltatás (BackgroundScheduler) implementálása az `automation` modulban.
- Perzisztens adattárolás (SQLite) a feladatokhoz, hogy újraindítás után is megmaradjanak.
- MCP eszközök implementálása:
    - `schedule_reminder`: Egyszeri emlékeztető ütemezése.
    - `list_scheduled_jobs`: Aktív feladatok listázása.
    - `remove_scheduled_job`: Feladat törlése.

## 3. Requirements
- **Dependencies:** `APScheduler`, `sqlalchemy` (az APScheduler tárolójához).
- **Core Logic:**
    - A szerver indulásakor el kell indítani az ütemezőt (`scheduler.start()`).
    - A szerver leállításakor le kell állítani (`scheduler.shutdown()`).
- **Persistence:**
    - A feladatokat egy helyi SQLite adatbázisban (`scheduler.db`) kell tárolni.
- **Functionality:**
    - A `schedule_reminder` egy egyszerű szöveges üzenetet logoljon (vagy printeljen) a megadott időpontban, demonstrálva a működést. (Később ez bővíthető pl. email küldéssel).

## 4. Out of Scope
- Komplex, több lépéses workflow-k (DAG) kezelése.
- Elosztott ütemezés (több szerver).
- UI felület az ütemezéshez.
