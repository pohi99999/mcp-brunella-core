# Implementációs Terv: Chrome ACP integráció
**Track ID:** `chrome_acp_integration_20260323`

---

## Phase 1: Track + Setup Blueprint

* [x] **Task 1.1** — Track létrehozása a conductor rendszerben
* [x] **Task 1.2** — Quickstart parancsok és manuális extension lépések összegyűjtése
* [x] **Task 1.3** — Integrációs scope definiálása (dashboard + CLI + scripts + docs)

## Phase 2: Dashboard + Scripts

* [x] **Task 2.1** — Dashboard navigation bejegyzés
  - új `chrome-acp` menüpont
  - `EmbeddedWorkflow` panel `http://localhost:9315` URL-lel
  - same-origin engedélyezés csak localhostra

* [x] **Task 2.2** — Windows indítóscript
  - `scripts/start-chrome-acp.bat`
  - `scripts/start-chrome-acp.ps1`
  - bináris ellenőrzés: `acp-proxy`, `claude-code-acp`
  - opcionális böngészőmegnyitás a végén

## Phase 3: CLI Integration

* [x] **Task 3.1** — `src/cli/chromeAcpCommands.ts`
  - `brunella chrome-acp` interaktív menü
  - `doctor`, `status`, `start`, `install` alparancsok
  - magyar üzenetek, hibakezelés

* [x] **Task 3.2** — `src/cli.ts` regisztráció
  - új import és command bekötés

## Phase 4: Docs + Validation

* [x] **Task 4.1** — `docs/CHROME_ACP_SETUP.md`
  - globális npm install
  - proxy indítás
  - Chrome extension setup
  - dashboard / CLI használat

* [x] **Task 4.2** — Validáció
  - `npm run build`
  - `npm run build:ui`
  - ha lehetséges: proxy indítás + `http://localhost:9315` ellenőrzés

---

## 🎯 Sikerességi Kritériumok

1. A dashboardban külön Chrome ACP panel jelenik meg
2. A CLI képes ellenőrizni és elindítani a lokális Chrome ACP proxyt
3. Windows alatt van dedikált indítóscript
4. A setup teljesen dokumentált
5. A build és UI build zöld
