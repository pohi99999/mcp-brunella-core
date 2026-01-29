# Projekt Nyomkövetés (Tracks)

Ez a fájl követi nyomon a fő fejlesztési szálakat (tracks). Minden szál független egységként működik saját tervvel.

### ✅ Lezárt Szálak (Completed Tracks)

- [x] **Agent Swarm Core Implementation (2026-01-29):**
  - **Eredmény:** `AgentManager` refaktorálva. `DataScientist` és `Researcher` ügynökök implementálva és regisztrálva. A rendszer képes a "Swarm" logikára.
  - 📂 *[./tracks/agent_swarm_core_20260129/](./tracks/agent_swarm_core_20260129/)*

- [x] **Brunella CLI Verification & Parity (2026-01-29):**
  - **Eredmény:** `src/cli.ts` javítva, `package.json` bin korrigálva. Conductor parancsok (`status`, `setup`) implementálva. Memória és Tools funkciók tesztelve. Dokumentáció frissítve.
  - 📂 *[./tracks/cli_verification_20260129/](./tracks/cli_verification_20260129/)*

- [x] **Documentation & Infrastructure Synchronization (2026-01-29):**
  - **Eredmény:** Teljes rendszer-dokumentáció (`konyvtarfa.md`, `Toolskeszlet.md`, `mag.md`) automatizálva. GitHub szinkronizáció helyreállítva. `start.bat` integrálva Ollama/AnythingLLM-mel.
  - 📂 *[./tracks/docs_infra_sync_20260129/](./tracks/docs_infra_sync_20260129/)*

- [x] **Swarm Ingestion Foundation (2026-01-28):**
  - **Eredmény:** Harvester Swarm alapok kész. `swarm_ingest` tool implementálva (Playwright -> Python Refiner -> Knowledge Store). POC sikeresen lefutott.
  - 📂 *[./tracks/swarm_ingestion_20260128/](./tracks/swarm_ingestion_20260128/)*

- [x] **Comprehensive Testing & Fix (2026-01-28):**
  - **Eredmény:** Szigorú tesztelés sikeres. Javított hibák: `__dirname` ES modul hiba, hiányzó agent regisztráció, Ollama connectivity és .env betöltés.
  - 📂 *[./tracks/comprehensive_testing_20260128/](./tracks/comprehensive_testing_20260128/)*

- [x] **System Recovery & Refactor (2026-01-28):**
  - **Eredmény:** Build sikeres (0 hiba). Szerver elindul. Hiányzó modulok (LLM, ToolManager) stub-olva.
  - **Következő lépés:** Funkcionalitás visszaépítése (LLM kliens, MCP integráció).
  - 📂 *[./tracks/system_recovery_20260128/](./tracks/system_recovery_20260128/)*

- [x] **System Audit & Discovery (2026-01-28):**
  - **Eredmény:** 🔴 KRITIKUS HIBA feltárva. A build nem futott le, fájlstruktúra inkonzisztens volt.
  - 📂 *[./tracks/system_audit_20260128/](./tracks/system_audit_20260128/)*

### 🔧 Aktív Szálak (Active Tracks)

---

### ⏳ Szüneteltetett / Integrált Szálak

- [ ] **Dashboard & CLI SSE Fix (2026-01-27/28):**
  - *Átvezetve az Audit és Recovery szálakba.*
