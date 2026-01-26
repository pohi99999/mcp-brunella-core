# Implementation Plan - Google Workspace Integráció (Python)

## Phase 1: Setup & Authentication
- [x] Task: Dependency Installation
    - [x] Telepítsd a szükséges csomagokat: `pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib`.
    - [x] Frissítsd a `requirements.txt`-t.
- [x] Task: Auth Module
    - [x] Hozz létre egy `src/utils/google_auth.py` modult.
    - [x] Implementáld a hitelesítési logikát (Service Account vagy OAuth2 flow).
    - [x] Hozz létre placeholder credentials fájlt vagy dokumentáld a beállítást.

## Phase 2: MCP Server Implementation
- [x] Task: Create Server File
    - [x] Hozz létre egy `src/servers/google_workspace.py` fájlt.
    - [x] Inicializáld a FastMCP szervert.
- [x] Task: Gmail Tools
    - [x] Implementáld a `gmail_read_emails` eszközt.
    - [x] Implementáld a `gmail_send_email` eszközt.
- [x] Task: Drive Tools
    - [x] Implementáld a `drive_list_files` eszközt.

## Phase 3: Integration & Testing
- [ ] Task: Manual Testing
    - [ ] Teszteld a funkciókat a FastMCP inspector vagy script segítségével.
- [ ] Task: Conductor - User Manual Verification 'Google Auth' (Protocol in workflow.md)
- [ ] Task: Update Documentation
    - [ ] Frissítsd a `mag.md`-t az új modullal.
    - [ ] Frissítsd az `INTEGRATION_PLAN.md` státuszát.
